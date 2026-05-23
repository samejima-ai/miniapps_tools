"use client";

/**
 * Input Page — Chat UI（自然文→構造化→確定→リセット）
 *
 * LINE と同じノリの自然文入力。チャット形式で対話完結。
 * 送信 → 解析 → 確認カード → 確定 → 次の入力へ。
 *
 * Phase 0 = 全件確認。自動 INSERT しない (D-4)。
 * LLM は抽出器、欠損補完しない (D-5)。
 */

import { SignalCard } from "@/components/signal-card";
import { useUser } from "@/lib/user-context";
import { confirmCheckoutAction, extractAction } from "./actions";
import type { ResolvedItem } from "./actions";
import type { CaaFExtractionResult, Signal } from "@/types";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type ChatEntry = {
  id: string;
  userText: string;
  extraction: CaaFExtractionResult | null;
  signal: Signal | null;
  resolved: ResolvedItem[];
  status: "sending" | "reviewing" | "confirming" | "confirmed" | "error";
  error: string | null;
  insertedCount: number;
};

export default function InputPage() {
  const { currentUser } = useUser();
  const router = useRouter();
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [inputText, setInputText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const entriesRef = useRef(entries);
  entriesRef.current = entries;
  const composingRef = useRef(false);

  // 新メッセージ追加時に自動スクロール
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [entries]);

  const updateEntry = useCallback((id: string, patch: Partial<ChatEntry>) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }, []);

  // 送信: LLM 抽出
  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text) return;

    const id = crypto.randomUUID();
    setEntries((prev) => [
      ...prev,
      {
        id,
        userText: text,
        extraction: null,
        signal: null,
        resolved: [],
        status: "sending" as const,
        error: null,
        insertedCount: 0,
      },
    ]);
    setInputText("");
    if (inputRef.current) inputRef.current.style.height = "auto";

    try {
      const result = await extractAction(text);
      updateEntry(id, {
        extraction: result.extraction,
        signal: result.signal,
        resolved: result.resolved,
        status: "reviewing",
      });
    } catch (err) {
      updateEntry(id, {
        error: err instanceof Error ? err.message : "抽出に失敗しました",
        status: "error",
      });
    }
  }, [inputText, updateEntry]);

  // 確定: movement INSERT
  const handleConfirm = useCallback(
    async (entryId: string) => {
      const entry = entriesRef.current.find((e) => e.id === entryId);
      if (!entry?.extraction || !currentUser) return;

      updateEntry(entryId, { status: "confirming" });

      try {
        const result = await confirmCheckoutAction(
          entry.extraction,
          entry.resolved,
          currentUser.id,
          null,
        );

        if (result.insertedCount === 0) {
          updateEntry(entryId, {
            error: result.errors.join("\n"),
            status: "error",
          });
          return;
        }

        updateEntry(entryId, {
          status: "confirmed",
          insertedCount: result.insertedCount,
          error: result.errors.length > 0 ? result.errors.join("\n") : null,
        });
      } catch (err) {
        updateEntry(entryId, {
          error: err instanceof Error ? err.message : "登録に失敗しました",
          status: "error",
        });
      }
    },
    [currentUser, updateEntry],
  );

  // 修正: テキストを入力欄に戻す
  const handleEdit = useCallback((entryId: string) => {
    const entry = entriesRef.current.find((e) => e.id === entryId);
    if (!entry) return;
    setInputText(entry.userText);
    setEntries((prev) => prev.filter((e) => e.id !== entryId));
    inputRef.current?.focus();
  }, []);

  // 再試行: 同じテキストで再抽出
  const handleRetry = useCallback(
    async (entryId: string) => {
      const entry = entriesRef.current.find((e) => e.id === entryId);
      if (!entry) return;

      updateEntry(entryId, { status: "sending", error: null });

      try {
        const result = await extractAction(entry.userText);
        updateEntry(entryId, {
          extraction: result.extraction,
          signal: result.signal,
          resolved: result.resolved,
          status: "reviewing",
        });
      } catch (err) {
        updateEntry(entryId, {
          error: err instanceof Error ? err.message : "抽出に失敗しました",
          status: "error",
        });
      }
    },
    [updateEntry],
  );

  // Enter で送信（IME 変換中は除外）
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

  // テキスト変更 + 高さ自動調整
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
        {entries.length === 0 ? (
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
            {entries.map((entry) => (
              <div key={entry.id} className="flex flex-col gap-sm">
                {/* ユーザーメッセージ（右寄せ） */}
                <div className="flex justify-end">
                  <div className="bg-primary text-surface rounded-2xl rounded-br-sm px-md py-sm max-w-[80%]">
                    <div className="text-body-sm whitespace-pre-wrap">
                      {entry.userText}
                    </div>
                  </div>
                </div>

                {/* システム応答（左寄せ） */}
                <div className="flex justify-start">
                  <div className="max-w-[95%] w-full">
                    {entry.status === "sending" && (
                      <div className="flex items-center gap-sm py-sm text-primary">
                        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        <span className="text-body-sm">解析中...</span>
                      </div>
                    )}

                    {(entry.status === "reviewing" ||
                      entry.status === "confirming") &&
                      entry.extraction &&
                      entry.signal && (
                        <SignalCard
                          extraction={entry.extraction}
                          signal={entry.signal}
                          resolved={entry.resolved}
                          onConfirm={() => handleConfirm(entry.id)}
                          onEdit={() => handleEdit(entry.id)}
                          onRedirectToReturn={() => router.push("/list")}
                          confirming={entry.status === "confirming"}
                        />
                      )}

                    {entry.status === "confirmed" && (
                      <div className="bg-success/10 border border-success/30 rounded-xl px-md py-sm flex items-center gap-sm">
                        <span>✅</span>
                        <span className="text-body-sm text-success font-bold">
                          {entry.insertedCount}件 登録完了
                        </span>
                      </div>
                    )}

                    {entry.status === "error" && entry.error && (
                      <div className="bg-error/10 border border-error/30 rounded-xl px-md py-sm flex flex-col gap-xs">
                        <div className="text-body-sm text-error whitespace-pre-wrap">
                          {entry.error}
                        </div>
                        <div className="flex gap-sm">
                          <button
                            type="button"
                            onClick={() => handleRetry(entry.id)}
                            className="text-label-xs text-primary font-bold"
                          >
                            再試行
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEdit(entry.id)}
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
            placeholder="工具名・番号・現場を入力..."
            className="flex-1 bg-background-subtle border border-divider rounded-2xl px-md py-sm text-body-sm placeholder:text-text-secondary focus:outline-none focus:border-primary resize-none leading-normal"
            rows={1}
            style={{ minHeight: 40, maxHeight: 120 }}
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!inputText.trim()}
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
