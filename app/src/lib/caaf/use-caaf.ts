"use client";

/**
 * useCaaF — Generic stroke dialog state machine hook.
 *
 * Manages the full stroke lifecycle:
 *   input → extracting → reviewing → (clarifying) → saving → done
 *
 * Domain logic (extraction, resolution, confirmation) is injected via CaafConfig.
 * Domain-specific item mutations use updateStrokeItems/updateStrokeProject.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { CaafConfig, Stroke, StrokeItem } from "./types";

function mergeItemStatuses<TResolved>(
  oldItems: StrokeItem<TResolved>[],
  newResolved: TResolved[],
  makeItemKey: (resolved: TResolved) => string,
  getExtractedName: (resolved: TResolved) => string,
): StrokeItem<TResolved>[] {
  const statusMap = new Map<string, "confirmed" | "skipped">();
  for (const item of oldItems) {
    if (item.status !== "confirmed" && item.status !== "skipped") continue;
    statusMap.set(makeItemKey(item.resolved), item.status);
  }

  const sameCount = oldItems.length === newResolved.length;

  return newResolved.map((r, idx) => {
    const oldStatus = statusMap.get(makeItemKey(r));
    const oldItem = sameCount ? oldItems[idx] : undefined;
    const originalExtractedName = oldItem
      ? (oldItem.originalExtractedName ?? getExtractedName(oldItem.resolved))
      : getExtractedName(r);

    if (oldStatus) {
      return { resolved: r, status: oldStatus, originalExtractedName };
    }
    return { resolved: r, status: "pending" as const, originalExtractedName };
  });
}

export function useCaaF<TExtraction, TResolved, TProject = null>(
  config: CaafConfig<TExtraction, TResolved, TProject>,
  userId: string | null,
) {
  type S = Stroke<TExtraction, TResolved, TProject>;

  const [strokes, setStrokes] = useState<S[]>([]);
  const [inputText, setInputText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const strokesRef = useRef(strokes);
  strokesRef.current = strokes;
  const composingRef = useRef(false);
  const savingRef = useRef<Set<string>>(new Set());

  const configRef = useRef(config);
  configRef.current = config;
  const userIdRef = useRef(userId);
  userIdRef.current = userId;

  // biome-ignore lint/correctness/useExhaustiveDependencies: strokes はトリガー用途（値は参照しないが、追加時に末尾へスクロール）
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [strokes]);

  const updateStroke = useCallback((id: string, patch: Partial<S>) => {
    setStrokes((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }, []);

  const saveConfirmedItems = useCallback(
    async (strokeId: string) => {
      if (savingRef.current.has(strokeId)) return;
      savingRef.current.add(strokeId);

      const stroke = strokesRef.current.find((s) => s.id === strokeId);
      if (!stroke?.extraction || !userIdRef.current) {
        savingRef.current.delete(strokeId);
        return;
      }

      const confirmed = stroke.items.filter((i) => i.status === "confirmed");
      const skippedCount = stroke.items.filter((i) => i.status === "skipped").length;

      if (confirmed.length === 0) {
        updateStroke(strokeId, {
          phase: "done",
          result: { insertedCount: 0, skippedCount, errors: [] },
        } as Partial<S>);
        savingRef.current.delete(strokeId);
        return;
      }

      updateStroke(strokeId, { phase: "saving" } as Partial<S>);

      try {
        const result = await configRef.current.confirmAction(stroke.extraction, confirmed, {
          userId: userIdRef.current,
          project: stroke.resolvedProject,
        });

        updateStroke(strokeId, {
          phase: "done",
          result: {
            insertedCount: result.insertedCount,
            skippedCount,
            errors: result.errors,
          },
        } as Partial<S>);
      } catch (err) {
        updateStroke(strokeId, {
          error: err instanceof Error ? err.message : "登録に失敗しました",
          phase: "error",
        } as Partial<S>);
      } finally {
        savingRef.current.delete(strokeId);
      }
    },
    [updateStroke],
  );

  useEffect(() => {
    for (const stroke of strokes) {
      if (stroke.phase !== "reviewing") continue;
      if (stroke.isClarifying) continue;
      const hasPending = stroke.items.some((i) => i.status === "pending");
      if (!hasPending && stroke.items.length > 0) {
        saveConfirmedItems(stroke.id);
        break;
      }
    }
  }, [strokes, saveConfirmedItems]);

  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text) return;

    setInputText("");
    if (inputRef.current) inputRef.current.style.height = "auto";

    const reviewingStroke = strokesRef.current.find(
      (s) => s.phase === "reviewing" && !s.isClarifying,
    );

    if (reviewingStroke?.extraction && configRef.current.clarifyAction) {
      const strokeId = reviewingStroke.id;
      const capturedItems = reviewingStroke.items;

      setStrokes((prev) =>
        prev.map((s) => {
          if (s.id !== strokeId) return s;
          return {
            ...s,
            isClarifying: true,
            clarifications: [...s.clarifications, { userText: text, systemMessage: "" }],
          };
        }),
      );

      try {
        const result = await configRef.current.clarifyAction(
          reviewingStroke.userText,
          reviewingStroke.extraction,
          text,
        );

        if (result.resolved.length === 0) {
          setStrokes((prev) =>
            prev.map((s) => {
              if (s.id !== strokeId) return s;
              const clarifications = [...s.clarifications];
              const last = clarifications[clarifications.length - 1];
              if (last) last.systemMessage = result.summary;
              return {
                ...s,
                extraction: result.extraction,
                signal: result.signal,
                items: [],
                isClarifying: false,
                clarifications,
                phase: "done" as const,
                result: { insertedCount: 0, skippedCount: 0, errors: [] },
                resolvedProject: result.resolvedProject,
              };
            }),
          );
          return;
        }

        const newItems = mergeItemStatuses(
          capturedItems,
          result.resolved,
          configRef.current.makeItemKey,
          configRef.current.getExtractedName,
        );

        setStrokes((prev) =>
          prev.map((s) => {
            if (s.id !== strokeId) return s;
            const clarifications = [...s.clarifications];
            const last = clarifications[clarifications.length - 1];
            if (last) last.systemMessage = result.summary;
            return {
              ...s,
              extraction: result.extraction,
              signal: result.signal,
              items: newItems,
              isClarifying: false,
              clarifications,
              resolvedProject: result.resolvedProject,
            };
          }),
        );
      } catch (err) {
        setStrokes((prev) =>
          prev.map((s) => {
            if (s.id !== strokeId) return s;
            const clarifications = [...s.clarifications];
            const last = clarifications[clarifications.length - 1];
            if (last) {
              last.systemMessage = err instanceof Error ? err.message : "修正に失敗しました";
            }
            return { ...s, isClarifying: false, clarifications };
          }),
        );
      }
    } else {
      const id = crypto.randomUUID();
      setStrokes((prev) => [
        ...prev,
        {
          id,
          userText: text,
          extraction: null,
          signal: null,
          items: [],
          phase: "extracting" as const,
          result: null,
          error: null,
          clarifications: [],
          isClarifying: false,
          resolvedProject: null,
        },
      ]);

      try {
        const result = await configRef.current.extractAction(text);
        const items: StrokeItem<TResolved>[] = result.resolved.map((r) => ({
          resolved: r,
          status: "pending" as const,
          originalExtractedName: configRef.current.getExtractedName(r),
        }));

        setStrokes((prev) =>
          prev.map((s) =>
            s.id === id
              ? {
                  ...s,
                  extraction: result.extraction,
                  signal: result.signal,
                  items,
                  phase: "reviewing" as const,
                  resolvedProject: result.resolvedProject,
                }
              : s,
          ),
        );
      } catch (err) {
        updateStroke(id, {
          error: err instanceof Error ? err.message : "抽出に失敗しました",
          phase: "error",
        } as Partial<S>);
      }
    }
  }, [inputText, updateStroke]);

  const handleConfirmItem = useCallback((strokeId: string, itemIndex: number) => {
    setStrokes((prev) =>
      prev.map((s) => {
        if (s.id !== strokeId) return s;
        const items = s.items.map((item, i) =>
          i === itemIndex ? { ...item, status: "confirmed" as const } : item,
        );
        return { ...s, items };
      }),
    );
  }, []);

  const handleSkipItem = useCallback((strokeId: string, itemIndex: number) => {
    setStrokes((prev) =>
      prev.map((s) => {
        if (s.id !== strokeId) return s;
        const items = s.items.map((item, i) =>
          i === itemIndex ? { ...item, status: "skipped" as const } : item,
        );
        return { ...s, items };
      }),
    );
  }, []);

  const handleUndoSkip = useCallback((strokeId: string, itemIndex: number) => {
    setStrokes((prev) =>
      prev.map((s) => {
        if (s.id !== strokeId) return s;
        const items = s.items.map((item, i) =>
          i === itemIndex ? { ...item, status: "pending" as const } : item,
        );
        return { ...s, items };
      }),
    );
  }, []);

  const handleConfirmAll = useCallback((strokeId: string) => {
    setStrokes((prev) =>
      prev.map((s) => {
        if (s.id !== strokeId) return s;
        const items = s.items.map((item) => {
          if (item.status !== "pending") return item;
          if (configRef.current.isConfirmable(item.resolved)) {
            return { ...item, status: "confirmed" as const };
          }
          return { ...item, status: "skipped" as const };
        });
        return { ...s, items };
      }),
    );
  }, []);

  const handleEdit = useCallback((strokeId: string) => {
    const stroke = strokesRef.current.find((s) => s.id === strokeId);
    if (!stroke) return;
    setInputText(stroke.userText);
    setStrokes((prev) => prev.filter((s) => s.id !== strokeId));
    inputRef.current?.focus();
  }, []);

  const handleRetry = useCallback(
    async (strokeId: string) => {
      const stroke = strokesRef.current.find((s) => s.id === strokeId);
      if (!stroke) return;

      updateStroke(strokeId, {
        phase: "extracting",
        error: null,
        items: [],
        clarifications: [],
        isClarifying: false,
      } as Partial<S>);

      try {
        const result = await configRef.current.extractAction(stroke.userText);
        const items: StrokeItem<TResolved>[] = result.resolved.map((r) => ({
          resolved: r,
          status: "pending" as const,
          originalExtractedName: configRef.current.getExtractedName(r),
        }));

        updateStroke(strokeId, {
          extraction: result.extraction,
          signal: result.signal,
          items,
          phase: "reviewing",
          resolvedProject: result.resolvedProject,
        } as Partial<S>);
      } catch (err) {
        updateStroke(strokeId, {
          error: err instanceof Error ? err.message : "抽出に失敗しました",
          phase: "error",
        } as Partial<S>);
      }
    },
    [updateStroke],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey && !composingRef.current && !e.nativeEvent.isComposing) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, []);

  const handleCompositionStart = useCallback(() => {
    composingRef.current = true;
  }, []);

  const handleCompositionEnd = useCallback(() => {
    setTimeout(() => {
      composingRef.current = false;
    }, 0);
  }, []);

  const updateStrokeItems = useCallback(
    (strokeId: string, updater: (items: StrokeItem<TResolved>[]) => StrokeItem<TResolved>[]) => {
      setStrokes((prev) =>
        prev.map((s) => {
          if (s.id !== strokeId) return s;
          return { ...s, items: updater(s.items) };
        }),
      );
    },
    [],
  );

  const updateStrokeProject = useCallback((strokeId: string, project: TProject) => {
    setStrokes((prev) =>
      prev.map((s) => {
        if (s.id !== strokeId) return s;
        return { ...s, resolvedProject: project };
      }),
    );
  }, []);

  const isReviewing = strokes.some((s) => s.phase === "reviewing" && !s.isClarifying);
  const isBusy = strokes.some((s) => s.isClarifying);

  return {
    strokes,
    inputText,
    setInputText,
    scrollRef,
    inputRef,
    handleSend,
    handleConfirmItem,
    handleSkipItem,
    handleUndoSkip,
    handleConfirmAll,
    handleEdit,
    handleRetry,
    handleKeyDown,
    handleTextChange,
    handleCompositionStart,
    handleCompositionEnd,
    isReviewing,
    isBusy,
    updateStrokeItems,
    updateStrokeProject,
  };
}
