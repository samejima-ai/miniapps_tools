"use client";

/**
 * Input Page — Chat UI v2 ストローク対話モデル
 *
 * 1ストローク = 入力→解析→個別確認→登録完了の対話の塊。
 * 各アイテムを個別に確定/スキップでき、全件確定で一括操作も可能。
 * ストローク完了後はリセットして次の入力へ。
 *
 * Phase 0 = 全件確認。自動 INSERT しない (D-4)。
 * LLM は抽出器、欠損補完しない (D-5)。
 */

import { StrokeItemCard } from "@/components/stroke-item-card";
import type { StrokeItem } from "@/components/stroke-item-card";
import { useUser } from "@/lib/user-context";
import {
  confirmCheckoutAction,
  clarifyAction,
  extractAction,
  type ResolvedItem,
  type ResolvedProject,
} from "./actions";
import type { CaaFExtractionResult, Signal } from "@/types";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type StrokePhase = "extracting" | "reviewing" | "saving" | "done" | "error";

type StrokeResult = {
  insertedCount: number;
  skippedCount: number;
  errors: string[];
};

type Clarification = {
  userText: string;
  systemMessage: string;
};

type Stroke = {
  id: string;
  userText: string;
  extraction: CaaFExtractionResult | null;
  signal: Signal | null;
  items: StrokeItem[];
  phase: StrokePhase;
  result: StrokeResult | null;
  error: string | null;
  clarifications: Clarification[];
  isClarifying: boolean;
  resolvedProject: ResolvedProject | null;
};

/** マスタ照合済みアイテムのキーを生成（状態マージ用） */
function makeItemKey(item: ResolvedItem): string {
  if (item.unitResolutions.length > 0) {
    const units = item.unitResolutions
      .map((u) => u.unitNumber)
      .sort((a, b) => a - b)
      .join(",");
    return `${item.matchedItemId ?? item.extractedName}:${units}`;
  }
  return `${item.matchedItemId ?? item.extractedName}:qty`;
}

/** 修正後の再解決で既存の確定/スキップ状態と originalExtractedName を保持する */
function mergeItemStatuses(
  oldItems: StrokeItem[],
  newResolved: ResolvedItem[],
): StrokeItem[] {
  const statusMap = new Map<string, "confirmed" | "skipped">();
  for (const item of oldItems) {
    if (item.status !== "confirmed" && item.status !== "skipped") continue;
    statusMap.set(makeItemKey(item.resolved), item.status);
  }

  // 修正前後で「同じユーザー意図」を表すアイテムを位置で対応付けて
  // originalExtractedName を引き継ぐ（修正でアイテム数が同じ場合）
  const sameCount = oldItems.length === newResolved.length;

  return newResolved.map((r, idx) => {
    const oldStatus = statusMap.get(makeItemKey(r));
    const originalExtractedName = sameCount
      ? oldItems[idx]?.originalExtractedName ?? oldItems[idx]?.resolved.extractedName
      : r.extractedName;

    if (oldStatus && r.status === "matched") {
      return { resolved: r, status: oldStatus, originalExtractedName };
    }
    return {
      resolved: r,
      status: "pending" as const,
      originalExtractedName,
    };
  });
}

export default function InputPage() {
  const { currentUser } = useUser();
  const router = useRouter();
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [inputText, setInputText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const strokesRef = useRef(strokes);
  strokesRef.current = strokes;
  const composingRef = useRef(false);
  const savingRef = useRef<Set<string>>(new Set());

  // 新メッセージ追加時に自動スクロール
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [strokes]);

  const updateStroke = useCallback((id: string, patch: Partial<Stroke>) => {
    setStrokes((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }, []);

  // 確定済みアイテムを INSERT する
  const saveConfirmedItems = useCallback(
    async (strokeId: string) => {
      if (savingRef.current.has(strokeId)) return;
      savingRef.current.add(strokeId);

      const stroke = strokesRef.current.find((s) => s.id === strokeId);
      if (!stroke?.extraction || !currentUser) {
        savingRef.current.delete(strokeId);
        return;
      }

      const confirmed = stroke.items.filter((i) => i.status === "confirmed");
      const skippedCount = stroke.items.filter((i) => i.status === "skipped").length;

      if (confirmed.length === 0) {
        updateStroke(strokeId, {
          phase: "done",
          result: { insertedCount: 0, skippedCount, errors: [] },
        });
        savingRef.current.delete(strokeId);
        return;
      }

      updateStroke(strokeId, { phase: "saving" });

      try {
        // エイリアス学習のため、ストローク初回抽出時の入力名で上書き
        // (例: "充電ブロアー" → 修正で "エンジンブロワー" になっても元の名前を保持)
        const resolvedToSave = confirmed.map((i) => ({
          ...i.resolved,
          extractedName: i.originalExtractedName ?? i.resolved.extractedName,
        }));
        const result = await confirmCheckoutAction(
          stroke.extraction,
          resolvedToSave,
          currentUser.id,
          null,
          stroke.resolvedProject?.projectId ?? null,
          stroke.resolvedProject?.projectName ?? null,
        );

        updateStroke(strokeId, {
          phase: "done",
          result: {
            insertedCount: result.insertedCount,
            skippedCount,
            errors: result.errors,
          },
        });
      } catch (err) {
        updateStroke(strokeId, {
          error: err instanceof Error ? err.message : "登録に失敗しました",
          phase: "error",
        });
      } finally {
        savingRef.current.delete(strokeId);
      }
    },
    [currentUser, updateStroke],
  );

  // 全アイテムが決定（pending なし）→ 自動保存トリガー
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

  // ── 送信: 新規ストロークまたはストローク内修正指示 ──
  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text) return;

    setInputText("");
    if (inputRef.current) inputRef.current.style.height = "auto";

    // アクティブな reviewing ストロークがあれば修正指示として処理
    const reviewingStroke = strokesRef.current.find(
      (s) => s.phase === "reviewing" && !s.isClarifying,
    );

    if (reviewingStroke?.extraction) {
      // ── ストローク内対話修正 ──
      const strokeId = reviewingStroke.id;
      const capturedItems = reviewingStroke.items;

      // 修正メッセージを追加 + clarifying 状態に
      setStrokes((prev) =>
        prev.map((s) => {
          if (s.id !== strokeId) return s;
          return {
            ...s,
            isClarifying: true,
            clarifications: [
              ...s.clarifications,
              { userText: text, systemMessage: "" },
            ],
          };
        }),
      );

      try {
        const result = await clarifyAction(
          reviewingStroke.userText,
          reviewingStroke.extraction,
          text,
        );

        // キャンセル（空アイテム）
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
              };
            }),
          );
          return;
        }

        // 既存アイテムの確定/スキップ状態をマージ
        const newItems = mergeItemStatuses(capturedItems, result.resolved);

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
              last.systemMessage =
                err instanceof Error ? err.message : "修正に失敗しました";
            }
            return { ...s, isClarifying: false, clarifications };
          }),
        );
      }
    } else {
      // ── 新規ストローク ──
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
        const result = await extractAction(text);
        const items: StrokeItem[] = result.resolved.map((r) => ({
          resolved: r,
          status: "pending" as const,
          originalExtractedName: r.extractedName,
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
        });
      }
    }
  }, [inputText, updateStroke]);

  // ── 個別確定 ──
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

  // ── 個別スキップ ──
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

  // ── スキップ取消 ──
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

  // ── LLM 候補選択（not_found → 候補から確定） ──
  const handleSelectCandidate = useCallback(
    (
      strokeId: string,
      itemIndex: number,
      candidate: ResolvedItem["candidates"][number],
    ) => {
      setStrokes((prev) =>
        prev.map((s) => {
          if (s.id !== strokeId) return s;
          const items = s.items.map((item, i) => {
            if (i !== itemIndex) return item;
            const r = item.resolved;

            // 候補の trackingType に応じてステータス再計算
            const isIndividualNoUnit =
              candidate.trackingType === "individual" &&
              r.unitResolutions.length === 0;
            const hasUnits = r.unitResolutions.length > 0;

            // 既存指定番号があれば候補側の availableUnits で再評価
            let newUnitResolutions = r.unitResolutions;
            if (hasUnits) {
              const unitMap = new Map(
                candidate.availableUnitDetails.map((d) => [d.unitNumber, d.unitId]),
              );
              newUnitResolutions = r.unitResolutions.map((u) => ({
                unitNumber: u.unitNumber,
                unitId: unitMap.get(u.unitNumber) ?? null,
                exists: unitMap.has(u.unitNumber),
              }));
            }
            const hasUnitMissing = newUnitResolutions.some((u) => !u.exists);

            return {
              ...item,
              resolved: {
                ...r,
                matchedItemId: candidate.itemId,
                matchedName: candidate.name,
                trackingType: candidate.trackingType,
                unitResolutions: newUnitResolutions,
                availableUnits: candidate.availableUnits,
                availableUnitDetails: candidate.availableUnitDetails,
                status: (hasUnitMissing
                  ? "unit_missing"
                  : isIndividualNoUnit
                    ? "no_unit_specified"
                    : "matched") as ResolvedItem["status"],
                candidates: [],
              },
              status: "pending" as const,
            };
          });
          return { ...s, items };
        }),
      );
    },
    [],
  );

  // ── 番号選択（no_unit_specified / unit_missing 時） ──
  // ── 案件候補選択（複数マッチ時） ──
  const handleSelectProject = useCallback(
    (strokeId: string, projectId: string, projectName: string) => {
      setStrokes((prev) =>
        prev.map((s) => {
          if (s.id !== strokeId) return s;
          return {
            ...s,
            resolvedProject: {
              projectId,
              projectName,
              status: "matched" as const,
              candidates: [],
            },
          };
        }),
      );
    },
    [],
  );

  const handleSelectUnit = useCallback(
    (strokeId: string, itemIndex: number, unitNumber: number) => {
      setStrokes((prev) =>
        prev.map((s) => {
          if (s.id !== strokeId) return s;
          const items = s.items.map((item, i) => {
            if (i !== itemIndex) return item;
            const r = item.resolved;

            // availableUnitDetails から unitId を取得
            const detail = r.availableUnitDetails.find(
              (d) => d.unitNumber === unitNumber,
            );
            if (!detail) return item;

            let newUnitResolutions: typeof r.unitResolutions;

            if (r.status === "no_unit_specified") {
              // 番号未指定 → 選択した番号を設定
              newUnitResolutions = [
                { unitNumber, unitId: detail.unitId, exists: true },
              ];
            } else if (r.status === "unit_missing") {
              // 存在しない番号を選択した番号で置換（最初の1つ）
              let replaced = false;
              newUnitResolutions = r.unitResolutions.map((u) => {
                if (!u.exists && !replaced) {
                  replaced = true;
                  return { unitNumber, unitId: detail.unitId, exists: true };
                }
                return u;
              });
            } else {
              return item;
            }

            // ステータス再計算
            const allExist = newUnitResolutions.every((u) => u.exists);

            return {
              resolved: {
                ...r,
                unitResolutions: newUnitResolutions,
                status: (allExist ? "matched" : "unit_missing") as typeof r.status,
              },
              status: "pending" as const,
            };
          });
          return { ...s, items };
        }),
      );
    },
    [],
  );

  // ── 全件確定（matched のみ確定、それ以外はスキップ） ──
  const handleConfirmAll = useCallback((strokeId: string) => {
    setStrokes((prev) =>
      prev.map((s) => {
        if (s.id !== strokeId) return s;
        const items = s.items.map((item) => {
          if (item.status !== "pending") return item;
          if (item.resolved.status === "matched") {
            return { ...item, status: "confirmed" as const };
          }
          return { ...item, status: "skipped" as const };
        });
        return { ...s, items };
      }),
    );
    // useEffect が自動保存をトリガーする
  }, []);

  // ── 修正: テキストを入力欄に戻す ──
  const handleEdit = useCallback((strokeId: string) => {
    const stroke = strokesRef.current.find((s) => s.id === strokeId);
    if (!stroke) return;
    setInputText(stroke.userText);
    setStrokes((prev) => prev.filter((s) => s.id !== strokeId));
    inputRef.current?.focus();
  }, []);

  // ── 再試行 ──
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
      });

      try {
        const result = await extractAction(stroke.userText);
        const items: StrokeItem[] = result.resolved.map((r) => ({
          resolved: r,
          status: "pending" as const,
          originalExtractedName: r.extractedName,
        }));

        updateStroke(strokeId, {
          extraction: result.extraction,
          signal: result.signal,
          items,
          phase: "reviewing",
          resolvedProject: result.resolvedProject,
        });
      } catch (err) {
        updateStroke(strokeId, {
          error: err instanceof Error ? err.message : "抽出に失敗しました",
          phase: "error",
        });
      }
    },
    [updateStroke],
  );

  // ── Enter で送信（IME 変換中は除外） ──
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (
        e.key === "Enter" &&
        !e.shiftKey &&
        !composingRef.current &&
        !e.nativeEvent.isComposing
      ) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  // ── テキスト変更 + 高さ自動調整 ──
  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInputText(e.target.value);
      const el = e.target;
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
    },
    [],
  );

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* チャットエリア */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-md py-md">
        {strokes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-text-secondary gap-sm">
            <div className="text-body-sm text-center">
              LINE と同じノリで入力してください
            </div>
            <div className="text-label-xs text-center opacity-60">
              例: マキタバッテリー 7,8番 池下現場
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-lg">
            {strokes.map((stroke) => (
              <div key={stroke.id} className="flex flex-col gap-sm">
                {/* ユーザーメッセージ（右寄せ） */}
                <div className="flex justify-end">
                  <div className="bg-primary text-surface rounded-2xl rounded-br-sm px-md py-sm max-w-[80%]">
                    <div className="text-body-sm whitespace-pre-wrap">
                      {stroke.userText}
                    </div>
                  </div>
                </div>

                {/* 対話修正の履歴 */}
                {stroke.clarifications.map((c, ci) => (
                  <div key={`clarify-${ci}`} className="flex flex-col gap-sm">
                    {/* 修正指示（右寄せ） */}
                    <div className="flex justify-end">
                      <div className="bg-primary text-surface rounded-2xl rounded-br-sm px-md py-sm max-w-[80%]">
                        <div className="text-body-sm whitespace-pre-wrap">
                          {c.userText}
                        </div>
                      </div>
                    </div>
                    {/* 修正結果（左寄せ） */}
                    {c.systemMessage && (
                      <div className="flex justify-start">
                        <div className="text-body-sm text-text-secondary py-xs px-sm">
                          {c.systemMessage}
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {/* システム応答（左寄せ） */}
                <div className="flex justify-start">
                  <div className="max-w-[95%] w-full">
                    {/* 解析中 */}
                    {stroke.phase === "extracting" && (
                      <div className="flex items-center gap-sm py-sm text-primary">
                        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        <span className="text-body-sm">解析中...</span>
                      </div>
                    )}

                    {/* 修正反映中 */}
                    {stroke.isClarifying && (
                      <div className="flex items-center gap-sm py-sm text-primary">
                        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        <span className="text-body-sm">修正を反映中...</span>
                      </div>
                    )}

                    {/* レビュー: 個別アイテム確認 */}
                    {stroke.phase === "reviewing" && stroke.extraction && !stroke.isClarifying && (
                      <div className="flex flex-col gap-sm">
                        {/* ヘッダー */}
                        <div className="flex items-center gap-sm text-body-sm flex-wrap">
                          {stroke.extraction.site && (
                            <span className="text-ink font-bold">
                              {stroke.extraction.site}
                            </span>
                          )}
                          {/* 案件マッチング結果 */}
                          {stroke.resolvedProject?.status === "matched" && (
                            <span className="text-label-xs bg-success/10 text-success font-bold px-xs py-0.5 rounded-sm">
                              ✓ {stroke.resolvedProject.projectName}
                            </span>
                          )}
                          {stroke.resolvedProject?.status === "not_found" &&
                            stroke.extraction.site && (
                              <span className="text-label-xs bg-warning/10 text-warning font-bold px-xs py-0.5 rounded-sm">
                                案件未一致
                              </span>
                            )}
                          <span className="text-text-secondary">
                            — {stroke.items.length}件
                          </span>
                        </div>

                        {/* 案件候補ピッカー（複数マッチ時） */}
                        {stroke.resolvedProject?.status === "multiple" &&
                          stroke.resolvedProject.candidates.length > 0 && (
                            <div className="border border-warning/30 bg-warning/5 rounded-md p-sm flex flex-col gap-xs">
                              <div className="text-label-xs text-warning font-bold">
                                案件候補が複数あります — 選択してください
                              </div>
                              <div className="flex flex-col gap-xs">
                                {stroke.resolvedProject.candidates.map((c) => {
                                  const isSelected =
                                    stroke.resolvedProject?.projectId === c.projectId;
                                  return (
                                    <button
                                      key={c.projectId}
                                      type="button"
                                      onClick={() =>
                                        handleSelectProject(
                                          stroke.id,
                                          c.projectId,
                                          c.name,
                                        )
                                      }
                                      className={`text-left text-body-sm rounded-md px-md py-sm min-h-[40px] border transition-colors ${
                                        isSelected
                                          ? "bg-primary text-surface border-primary font-bold"
                                          : "bg-surface text-ink border-divider"
                                      }`}
                                    >
                                      {isSelected ? "✓ " : ""}
                                      {c.name}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                        {/* 返却の場合: 一覧タブへ誘導 */}
                        {stroke.extraction.action === "return" ? (
                          <div className="border border-divider rounded-lg p-md flex flex-col gap-sm">
                            <div className="text-body-sm text-text-secondary">
                              返却は一覧タブから操作できます
                            </div>
                            <button
                              type="button"
                              onClick={() => router.push("/list")}
                              className="bg-success text-surface font-bold rounded-md py-sm min-h-[44px]"
                            >
                              一覧タブへ
                            </button>
                          </div>
                        ) : (
                          <>
                            {/* アイテムリスト */}
                            {stroke.items.map((item, i) => (
                              <StrokeItemCard
                                key={`${item.resolved.extractedName}-${i}`}
                                item={item}
                                onConfirm={() => handleConfirmItem(stroke.id, i)}
                                onSkip={() => handleSkipItem(stroke.id, i)}
                                onUndoSkip={() => handleUndoSkip(stroke.id, i)}
                                onSelectUnit={(num) =>
                                  handleSelectUnit(stroke.id, i, num)
                                }
                                onSelectCandidate={(c) =>
                                  handleSelectCandidate(stroke.id, i, c)
                                }
                              />
                            ))}

                            {/* 全件確定ボタン */}
                            {stroke.items.some(
                              (i) =>
                                i.status === "pending" &&
                                i.resolved.status === "matched",
                            ) && (
                              <button
                                type="button"
                                onClick={() => handleConfirmAll(stroke.id)}
                                className="bg-primary text-surface font-bold rounded-md py-sm min-h-[44px] shadow-primary-cta transition-all"
                              >
                                全件確定
                              </button>
                            )}

                            {/* 確定可能なアイテムがない場合 */}
                            {stroke.items.length > 0 &&
                              stroke.items.every(
                                (i) =>
                                  i.status === "pending" &&
                                  i.resolved.status !== "matched",
                              ) && (
                                <div className="text-label-xs text-text-secondary text-center">
                                  確定可能なアイテムがありません — スキップしてください
                                </div>
                              )}

                            {/* アイテムが0件 */}
                            {stroke.items.length === 0 && (
                              <div className="text-body-sm text-text-secondary">
                                工具を特定できませんでした
                              </div>
                            )}

                            {/* 曖昧点 */}
                            {stroke.extraction.ambiguities.length > 0 && (
                              <div className="bg-surface border border-divider rounded-md p-sm">
                                <div className="text-label-xs text-warning font-bold mb-xs">
                                  確認が必要:
                                </div>
                                <ul className="text-body-sm text-text-secondary space-y-xs">
                                  {stroke.extraction.ambiguities.map((a) => (
                                    <li key={a}>・{a}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* 入力し直す */}
                            <button
                              type="button"
                              onClick={() => handleEdit(stroke.id)}
                              className="text-label-xs text-text-secondary self-start"
                            >
                              入力し直す
                            </button>
                          </>
                        )}
                      </div>
                    )}

                    {/* 登録中 */}
                    {stroke.phase === "saving" && (
                      <div className="flex items-center gap-sm py-sm text-primary">
                        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        <span className="text-body-sm">登録中...</span>
                      </div>
                    )}

                    {/* 完了 */}
                    {stroke.phase === "done" && stroke.result && (
                      <div
                        className={`rounded-xl px-md py-sm flex flex-col gap-xs ${
                          stroke.result.insertedCount === 0 &&
                          stroke.result.skippedCount === 0
                            ? "bg-background-subtle border border-divider"
                            : "bg-success/10 border border-success/30"
                        }`}
                      >
                        <div className="flex items-center gap-sm">
                          {stroke.result.insertedCount === 0 &&
                          stroke.result.skippedCount === 0 ? (
                            <span className="text-body-sm text-text-secondary">
                              キャンセルしました
                            </span>
                          ) : (
                            <>
                              <span>✅</span>
                              <span className="text-body-sm text-success font-bold">
                                {stroke.result.insertedCount}件 登録完了
                                {stroke.result.skippedCount > 0 && (
                                  <span className="text-text-secondary font-normal">
                                    {" "}/ {stroke.result.skippedCount}件
                                    スキップ
                                  </span>
                                )}
                              </span>
                            </>
                          )}
                        </div>
                        {stroke.result.errors.length > 0 && (
                          <div className="text-label-xs text-error whitespace-pre-wrap">
                            {stroke.result.errors.join("\n")}
                          </div>
                        )}
                      </div>
                    )}

                    {/* エラー */}
                    {stroke.phase === "error" && stroke.error && (
                      <div className="bg-error/10 border border-error/30 rounded-xl px-md py-sm flex flex-col gap-xs">
                        <div className="text-body-sm text-error whitespace-pre-wrap">
                          {stroke.error}
                        </div>
                        <div className="flex gap-sm">
                          <button
                            type="button"
                            onClick={() => handleRetry(stroke.id)}
                            className="text-label-xs text-primary font-bold"
                          >
                            再試行
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEdit(stroke.id)}
                            className="text-label-xs text-text-secondary"
                          >
                            修正
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 入力バー（画面下固定） */}
      <div className="border-t border-divider bg-surface px-md py-sm">
        <div className="flex items-end gap-sm">
          <textarea
            ref={inputRef}
            value={inputText}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            onCompositionStart={() => {
              composingRef.current = true;
            }}
            onCompositionEnd={() => {
              setTimeout(() => {
                composingRef.current = false;
              }, 0);
            }}
            placeholder={
              strokes.some(
                (s) => s.phase === "reviewing" && !s.isClarifying,
              )
                ? "修正内容を入力..."
                : "工具名・番号・現場を入力..."
            }
            className="flex-1 bg-background-subtle border border-divider rounded-2xl px-md py-sm text-body-sm placeholder:text-text-secondary focus:outline-none focus:border-primary resize-none leading-normal"
            rows={1}
            style={{ minHeight: 40, maxHeight: 120 }}
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={
              !inputText.trim() ||
              strokes.some((s) => s.isClarifying)
            }
            className="bg-primary text-surface rounded-full w-10 h-10 flex items-center justify-center disabled:opacity-40 transition-all shrink-0"
            aria-label="送信"
          >
            <svg
              viewBox="0 0 24 24"
              className="w-5 h-5 fill-current"
              aria-hidden="true"
            >
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
