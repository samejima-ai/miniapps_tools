"use client";

/**
 * Input2 Page — CaaF gen-2 host Chat UI（M-E.2）
 *
 * gen-2 パイプライン（@caaf/core + @/lib/caaf-config）を結線した Resolver ラリー UI。
 * gen-1（`/input`）は据え置き＝本ルートは並行稼働（migration §8、パリティ後 M-F で gen-1 撤去）。
 *
 * - capture / execute のみ Server Action（LLM + DB）。rally の選択/回答は純関数で client 側（server 往復ゼロ）。
 * - DESIGN.md トークンでスタイリング（gen-1 と同じチャットシェル）。1 応答 1 質問（FW spec §7.2）。
 * - 確定はユーザー（Don't #3）。自動 INSERT しない（D-4）。
 */

import {
  type HostState,
  type ItemCandidate,
  type SiteCandidate,
  answerField,
  applyUnitNumbers,
  chooseCandidate,
  chooseSite,
  pendingField,
  summarize,
} from "@/lib/caaf-config";
import { useUser } from "@/lib/user-context";
import type { Signal } from "@caaf/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { captureAction, executeAction } from "./actions";

type Bubble = { role: "user" | "done" | "info"; text: string };

/** 信号色 → DESIGN トークン。 */
function signalToken(signal: Signal): { text: string; bg: string; border: string } {
  if (signal === "green")
    return { text: "text-success", bg: "bg-success/5", border: "border-success/30" };
  if (signal === "yellow")
    return { text: "text-warning", bg: "bg-warning/5", border: "border-warning/30" };
  return { text: "text-error", bg: "bg-error/5", border: "border-error/30" };
}

/** 自由文から個体番号を抽出（カンマ/空白/全角区切り）。 */
function parseNumbers(text: string): number[] {
  return (text.match(/\d+/g) ?? []).map(Number).filter((n) => Number.isFinite(n));
}

export default function Input2Page() {
  const { currentUser } = useUser();
  const movedBy = currentUser?.id ?? "";

  const [history, setHistory] = useState<Bubble[]>([]);
  const [active, setActive] = useState<HostState | null>(null);
  const [inputText, setInputText] = useState("");
  const [rallyInput, setRallyInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  // 同期ロック: setBusy 反映前の連打でも server 操作（LLM/append-only INSERT）を多重実行させない。
  const lockRef = useRef(false);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, []);
  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() =>
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }),
    );
  }, []);

  // 主入力バーは「新規発話待ち」のときだけ有効。not_found / out_of_scope は言い直し可能にする。
  const barEnabled = !active || active.phase === "not_found" || active.phase === "out_of_scope";

  const send = useCallback(async () => {
    const text = inputText.trim();
    if (!text || lockRef.current || !barEnabled) return;
    lockRef.current = true;
    setInputText("");
    setError(null);
    setHistory((h) => [...h, { role: "user", text }]);
    setBusy(true);
    scrollToEnd();
    try {
      const next = await captureAction(movedBy, text, active);
      // intent=cancel は server が初期状態（phase=idle）を返す → 会話リセット扱い。
      if (next.phase === "idle") {
        setActive(null);
        setHistory((h) => [...h, { role: "info", text: "入力をリセットしました" }]);
      } else {
        setActive(next);
      }
    } catch {
      setError("解析に失敗しました。もう一度お試しください");
    } finally {
      setBusy(false);
      lockRef.current = false;
      scrollToEnd();
    }
  }, [inputText, barEnabled, movedBy, active, scrollToEnd]);

  const onExecute = useCallback(async () => {
    if (!active || lockRef.current) return;
    lockRef.current = true;
    setBusy(true);
    setError(null);
    const summary = summarize(active);
    try {
      const result = await executeAction(movedBy, active);
      if (result.success) {
        const note = result.error ? `（一部エラー: ${result.error}）` : "";
        setHistory((h) => [...h, { role: "done", text: `登録しました：${summary}${note}` }]);
        setActive(null);
      } else {
        setError(result.error ?? "登録に失敗しました");
      }
    } catch {
      setError("登録に失敗しました。通信状態をご確認ください");
    } finally {
      setBusy(false);
      lockRef.current = false;
      scrollToEnd();
    }
  }, [active, movedBy, scrollToEnd]);

  const field = active ? pendingField(active) : null;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* チャットエリア */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-md py-md">
        {history.length === 0 && !active ? (
          <div className="flex flex-col items-center justify-center h-full text-text-secondary gap-sm">
            <div className="text-body-sm text-center">
              工具名・番号・現場を入力してください（gen-2）
            </div>
            <div className="text-label-xs text-center opacity-60">
              例: バッテリー 2,3番 池下現場
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-lg">
            {history.map((b, i) => (
              <div
                key={`${b.role}-${i}`}
                className={b.role === "user" ? "flex justify-end" : "flex justify-start"}
              >
                {b.role === "user" ? (
                  <div className="bg-primary text-surface rounded-2xl rounded-br-sm px-md py-sm max-w-[80%]">
                    <div className="text-body-sm whitespace-pre-wrap">{b.text}</div>
                  </div>
                ) : b.role === "done" ? (
                  <div className="bg-success/10 text-success rounded-xl px-md py-sm max-w-[90%]">
                    <div className="text-body-sm whitespace-pre-wrap">✓ {b.text}</div>
                  </div>
                ) : (
                  <div className="text-label-xs text-text-secondary px-sm py-xs">{b.text}</div>
                )}
              </div>
            ))}

            {/* アクティブな会話状態 */}
            {active && (
              <div className="flex justify-start">
                <div className="max-w-[95%] w-full flex flex-col gap-sm">
                  {busy && (
                    <div className="flex items-center gap-sm py-sm text-primary">
                      <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      <span className="text-body-sm">処理中...</span>
                    </div>
                  )}

                  {!busy && active.phase === "not_found" && (
                    <div className="border border-error/30 bg-error/5 rounded-lg px-md py-sm text-body-sm text-error">
                      {active.issues[0]?.message ?? "見つかりませんでした。言い直してください"}
                    </div>
                  )}

                  {!busy && active.phase === "out_of_scope" && (
                    <div className="border border-divider bg-background-subtle rounded-lg px-md py-sm text-body-sm text-text-secondary">
                      工具の持出・返却を入力してください（例: バッテリー 2,3番 池下現場）
                    </div>
                  )}

                  {/* 複数候補 → 選択 */}
                  {!busy && active.phase === "candidates" && (
                    <div className="border border-warning/30 bg-warning/5 rounded-md p-sm flex flex-col gap-xs">
                      <div className="text-label-xs text-warning font-bold">
                        候補を選択してください
                      </div>
                      {active.candidates.map((c: ItemCandidate) => (
                        <button
                          key={c.itemId}
                          type="button"
                          onClick={() => setActive(chooseCandidate(active, c))}
                          className="text-left text-body-sm rounded-md px-md py-sm min-h-[44px] border border-divider bg-surface text-ink"
                        >
                          {c.name}
                          <span className="text-label-xs text-text-secondary ml-xs">
                            （{c.trackingType === "individual" ? "個体管理" : "数量管理"}）
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* rally: 不足必須を 1 つ尋ねる */}
                  {!busy && active.phase === "rally" && field && (
                    <div className="border border-divider rounded-lg p-md flex flex-col gap-sm">
                      <div className="text-body-sm text-ink">
                        {active.itemName ? `${active.itemName}: ` : ""}
                        {field.label}を入力してください
                      </div>

                      {field.type === "enum" ? (
                        <div className="flex gap-sm flex-wrap">
                          {(field.options ?? []).map((opt) => (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => setActive(answerField(active, field.name, opt))}
                              className="bg-surface border border-divider text-ink rounded-md px-md py-sm min-h-[44px] text-body-sm"
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="flex items-end gap-sm">
                          <input
                            inputMode="numeric"
                            value={rallyInput}
                            onChange={(e) => setRallyInput(e.target.value)}
                            placeholder={field.name === "units" ? "例: 2,3" : "数量"}
                            className="flex-1 bg-background-subtle border border-divider rounded-md px-md py-sm text-body-sm focus:outline-none focus:border-primary"
                          />
                          <button
                            type="button"
                            disabled={!rallyInput.trim()}
                            onClick={() => {
                              if (field.name === "units") {
                                const nums = parseNumbers(rallyInput);
                                if (nums.length === 0) {
                                  setError("番号を数字で入力してください（例: 2,3）");
                                  return; // 無効入力では確定せず入力も消さない
                                }
                                setError(null);
                                setActive(applyUnitNumbers(active, nums));
                              } else {
                                const n = Number(rallyInput.replace(/[^\d.]/g, ""));
                                if (!Number.isFinite(n) || n <= 0) {
                                  setError("数量を正しい数値で入力してください");
                                  return;
                                }
                                setError(null);
                                setActive(answerField(active, field.name, n));
                              }
                              setRallyInput("");
                            }}
                            className="bg-primary text-surface font-bold rounded-md px-md py-sm min-h-[44px] disabled:opacity-40"
                          >
                            確定
                          </button>
                        </div>
                      )}

                      {active.issues.length > 0 && (
                        <div className="text-label-xs text-error whitespace-pre-wrap">
                          {active.issues.map((iss) => iss.message).join("\n")}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ready: サマリー + 実行 */}
                  {!busy && active.phase === "ready" && (
                    <ReadySummary
                      active={active}
                      onExecute={onExecute}
                      onChooseSite={(c) => setActive(chooseSite(active, c))}
                    />
                  )}

                  {error && (
                    <div className="text-label-xs text-error whitespace-pre-wrap">{error}</div>
                  )}

                  {!busy && (
                    <button
                      type="button"
                      onClick={() => {
                        setActive(null);
                        setRallyInput("");
                        setError(null);
                      }}
                      className="self-start text-label-xs text-text-secondary underline"
                    >
                      やり直す
                    </button>
                  )}
                </div>
              </div>
            )}

            {error && !active && (
              <div className="flex justify-start">
                <div className="text-label-xs text-error">{error}</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 入力バー（画面下固定） */}
      <div className="border-t border-divider bg-surface px-md py-sm">
        <div className="flex items-end gap-sm">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void send();
              }
            }}
            placeholder={
              barEnabled ? "工具名・番号・現場を入力..." : "上の選択肢で回答してください"
            }
            disabled={!barEnabled || busy}
            className="flex-1 bg-background-subtle border border-divider rounded-2xl px-md py-sm text-body-sm placeholder:text-text-secondary focus:outline-none focus:border-primary resize-none leading-normal disabled:opacity-50"
            rows={1}
            style={{ minHeight: 40, maxHeight: 120 }}
          />
          <button
            type="button"
            onClick={() => void send()}
            disabled={!inputText.trim() || busy || !barEnabled}
            className="bg-primary text-surface rounded-full w-10 h-10 flex items-center justify-center disabled:opacity-40 transition-all shrink-0"
            aria-label="送信"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" aria-hidden="true">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

/** ready フェーズのサマリーカード + 実行ボタン。 */
function ReadySummary({
  active,
  onExecute,
  onChooseSite,
}: {
  active: HostState;
  onExecute: () => void;
  onChooseSite: (c: SiteCandidate) => void;
}) {
  const tone = signalToken(active.signal);
  const siteResolved = !!active.record.fields.site; // record に site があれば project_id 解決済み
  return (
    <div className={`border ${tone.border} ${tone.bg} rounded-lg p-md flex flex-col gap-sm`}>
      <div className="text-body-sm text-ink font-bold">{summarize(active)}</div>

      {/* 現場の解決状態 */}
      {active.pendingRefs.site && siteResolved && (
        <div className="text-label-xs text-success">✓ 現場: {active.pendingRefs.site}</div>
      )}
      {!siteResolved && active.siteCandidates.length > 0 && (
        <div className="flex flex-col gap-xs">
          <div className="text-label-xs text-warning font-bold">現場の候補を選択（任意）</div>
          {active.siteCandidates.map((c) => (
            <button
              key={c.projectId}
              type="button"
              onClick={() => onChooseSite(c)}
              className="text-left text-body-sm rounded-md px-md py-sm min-h-[40px] border border-divider bg-surface text-ink"
            >
              {c.name}
            </button>
          ))}
        </div>
      )}
      {!siteResolved && active.siteCandidates.length === 0 && active.pendingRefs.site && (
        <div className="text-label-xs text-text-secondary">
          現場: {active.pendingRefs.site}（未照合・記録には残しません）
        </div>
      )}

      {active.issues.length > 0 && (
        <div className={`text-label-xs ${tone.text} whitespace-pre-wrap`}>
          {active.issues.map((iss) => iss.message).join("\n")}
        </div>
      )}
      <button
        type="button"
        onClick={onExecute}
        className="bg-primary text-surface font-bold rounded-md py-sm min-h-[44px] shadow-primary-cta"
      >
        登録する
      </button>
    </div>
  );
}
