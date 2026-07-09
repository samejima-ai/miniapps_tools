"use client";

/**
 * Input Page — CaaF host Chat UI（F2 入力タブ）
 *
 * CaaF v1.0.0 パイプライン（@caaf/core + @/lib/caaf-config）を結線した Resolver ラリー UI。
 * M-F で gen-1（stroke 対話モデル）を撤去し、本実装が唯一の入力経路となった。
 *
 * - capture / execute のみ Server Action（LLM + DB）。rally の選択/回答は純関数で client 側（server 往復ゼロ）。
 * - 現場職人がスマホで使う前提: 大きなタップ領域・番号チップ・信号色カードで「速く・分かりやすく」。
 * - DESIGN.md トークンでスタイリング。1 応答 1 質問（FW spec §7.2）。確定はユーザー（Don't #3 / D-4）。
 */

import {
  type HostState,
  type ItemCandidate,
  type ResolvedUnit,
  type SiteCandidate,
  TOOLS_FIELD,
  answerField,
  applyUnitNumbers,
  chooseCandidate,
  chooseSite,
  pendingField,
} from "@/lib/caaf-config";
import { useUser } from "@/lib/user-context";
import type { Signal } from "@caaf/core";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { captureAction, executeAction } from "./actions";

type Bubble = { role: "user" | "done" | "info"; text: string };

const QTY_PRESETS = [1, 2, 3, 5, 10];

/** 自由文から個体番号を抽出（フォールバック入力用。カンマ/空白/全角区切り）。 */
function parseNumbers(text: string): number[] {
  return (text.match(/\d+/g) ?? []).map(Number).filter((n) => Number.isFinite(n));
}

/** 信号色 → 左ボーダー色トークン。 */
function signalBorder(signal: Signal): string {
  if (signal === "green") return "border-l-success";
  if (signal === "yellow") return "border-l-warning";
  return "border-l-error";
}

/** record から表示用の値を取り出す。 */
function readUnits(s: HostState): ResolvedUnit[] {
  const v = s.record.fields[TOOLS_FIELD.units]?.value;
  return Array.isArray(v) ? (v as ResolvedUnit[]) : [];
}
function readQuantity(s: HostState): number | null {
  const v = s.record.fields[TOOLS_FIELD.quantity]?.value;
  return typeof v === "number" ? v : null;
}
function isReturn(s: HostState): boolean {
  return s.record.fields[TOOLS_FIELD.action]?.value === "return";
}

export default function InputPage() {
  const { currentUser } = useUser();
  const movedBy = currentUser?.id ?? "";

  const [history, setHistory] = useState<Bubble[]>([]);
  const [active, setActive] = useState<HostState | null>(null);
  const [inputText, setInputText] = useState("");
  const [selectedUnits, setSelectedUnits] = useState<number[]>([]);
  const [qtyInput, setQtyInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  // 同期ロック: setBusy 反映前の連打でも server 操作（LLM/append-only INSERT）を多重実行させない。
  const lockRef = useRef(false);

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() =>
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }),
    );
  }, []);
  useEffect(() => {
    scrollToEnd();
  }, [scrollToEnd]);

  const resetTransient = useCallback(() => {
    setSelectedUnits([]);
    setQtyInput("");
  }, []);

  // 主入力バーは「新規発話待ち」のときだけ有効。not_found / out_of_scope は言い直し可能にする。
  const barEnabled = !active || active.phase === "not_found" || active.phase === "out_of_scope";

  const send = useCallback(async () => {
    const text = inputText.trim();
    if (!text || lockRef.current || !barEnabled) return;
    lockRef.current = true;
    setInputText("");
    setError(null);
    resetTransient();
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
  }, [inputText, barEnabled, movedBy, active, scrollToEnd, resetTransient]);

  const onExecute = useCallback(async () => {
    if (!active || lockRef.current) return;
    lockRef.current = true;
    setBusy(true);
    setError(null);
    const summary = summaryLine(active);
    try {
      const result = await executeAction(movedBy, active);
      if (result.success) {
        const note = result.error ? `（一部エラー: ${result.error}）` : "";
        setHistory((h) => [...h, { role: "done", text: `${summary}${note}` }]);
        setActive(null);
        resetTransient();
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
  }, [active, movedBy, scrollToEnd, resetTransient]);

  const restart = useCallback(() => {
    setActive(null);
    setError(null);
    resetTransient();
  }, [resetTransient]);

  const confirmUnits = useCallback(() => {
    if (selectedUnits.length === 0) {
      setError("番号を選んでください");
      return;
    }
    setError(null);
    const nums = [...selectedUnits];
    setActive((s) => (s ? applyUnitNumbers(s, nums) : s));
    setSelectedUnits([]);
  }, [selectedUnits]);

  // フォールバック（availableUnits 不在）: 自由文の番号を解決する。
  const confirmUnitsText = useCallback((raw: string) => {
    const nums = parseNumbers(raw);
    if (nums.length === 0) {
      setError("番号を数字で入力してください（例: 2,3）");
      return;
    }
    setError(null);
    setActive((s) => (s ? applyUnitNumbers(s, nums) : s));
    setQtyInput("");
  }, []);

  const confirmQuantity = useCallback((raw: string) => {
    const trimmed = raw.trim();
    const digits = trimmed.replace(/[^\d]/g, "");
    const n = Number(digits);
    if (digits === "" || /[.．]/.test(trimmed) || !Number.isInteger(n) || n <= 0) {
      setError("数量は1以上の整数で入力してください");
      return;
    }
    setError(null);
    setActive((s) => (s ? answerField(s, TOOLS_FIELD.quantity, n) : s));
    setQtyInput("");
  }, []);

  const field = active ? pendingField(active) : null;

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-md py-md">
        {history.length === 0 && !active ? (
          <EmptyState />
        ) : (
          <div className="flex flex-col gap-lg">
            {history.map((b, i) => (
              <HistoryBubble key={`${b.role}-${i}`} bubble={b} />
            ))}

            {active && (
              <div className="flex flex-col gap-sm">
                {busy && <Spinner />}

                {!busy && active.phase === "not_found" && (
                  <Notice tone="error">
                    {active.issues[0]?.message ?? "見つかりませんでした。言い直してください"}
                  </Notice>
                )}

                {!busy && active.phase === "out_of_scope" && (
                  <Notice tone="muted">
                    工具の持出・返却を入力してください（例: バッテリー 2,3番 池下現場）
                  </Notice>
                )}

                {!busy && active.phase === "candidates" && (
                  <section className="flex flex-col gap-sm">
                    <SectionLabel>どの工具ですか？</SectionLabel>
                    {active.candidates.map((c: ItemCandidate) => (
                      <CandidateButton
                        key={c.itemId}
                        candidate={c}
                        onClick={() => setActive((s) => (s ? chooseCandidate(s, c) : s))}
                      />
                    ))}
                  </section>
                )}

                {!busy && active.phase === "rally" && field && (
                  <RallyPrompt
                    state={active}
                    field={field}
                    selectedUnits={selectedUnits}
                    onToggleUnit={(n) =>
                      setSelectedUnits((prev) =>
                        prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n],
                      )
                    }
                    onConfirmUnits={confirmUnits}
                    qtyInput={qtyInput}
                    onQtyInput={setQtyInput}
                    onConfirmQuantity={confirmQuantity}
                    onConfirmUnitsText={confirmUnitsText}
                    onAnswerEnum={(opt) =>
                      setActive((s) => (s ? answerField(s, field.name, opt) : s))
                    }
                  />
                )}

                {!busy && active.phase === "ready" && (
                  <ReadyCard
                    state={active}
                    onExecute={onExecute}
                    onChooseSite={(c) => setActive((s) => (s ? chooseSite(s, c) : s))}
                  />
                )}

                {error && (
                  <div className="text-label-xs text-error whitespace-pre-wrap">{error}</div>
                )}

                {!busy && (
                  <button
                    type="button"
                    onClick={restart}
                    className="self-start text-label-xs text-text-secondary underline mt-xs"
                  >
                    最初からやり直す
                  </button>
                )}
              </div>
            )}

            {error && !active && <div className="text-label-xs text-error">{error}</div>}
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
            className="flex-1 bg-background-subtle border border-divider rounded-2xl px-md py-sm text-body-md placeholder:text-text-secondary focus:outline-none focus:border-primary resize-none leading-normal disabled:opacity-50"
            rows={1}
            style={{ minHeight: 44, maxHeight: 120 }}
          />
          <button
            type="button"
            onClick={() => void send()}
            disabled={!inputText.trim() || busy || !barEnabled}
            className="bg-primary text-surface rounded-full w-11 h-11 flex items-center justify-center disabled:opacity-40 transition-all shrink-0 shadow-primary-cta"
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

// ─────────────────────────── 表示パーツ ───────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-text-secondary gap-md px-lg text-center">
      <div className="text-4xl">🧰</div>
      <div className="text-body-md text-ink font-bold">工具名・番号・現場を入力</div>
      <div className="text-body-sm">話し言葉そのままでOK。1つずつ確認して登録します。</div>
      <div className="text-label-xs bg-surface border border-divider rounded-lg px-md py-sm shadow-card">
        例: <span className="font-mono">バッテリー 2,3番 池下現場</span>
      </div>
    </div>
  );
}

function HistoryBubble({ bubble }: { bubble: Bubble }) {
  if (bubble.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="bg-primary text-surface rounded-2xl rounded-br-sm px-md py-sm max-w-[80%] shadow-primary-cta">
          <div className="text-body-md whitespace-pre-wrap">{bubble.text}</div>
        </div>
      </div>
    );
  }
  if (bubble.role === "done") {
    return (
      <div className="flex justify-start">
        <div className="flex items-center gap-sm bg-success/10 text-success rounded-xl px-md py-sm max-w-[92%]">
          <span className="text-base">✅</span>
          <span className="text-body-sm whitespace-pre-wrap">{bubble.text}</span>
        </div>
      </div>
    );
  }
  return <div className="text-label-xs text-text-secondary text-center">{bubble.text}</div>;
}

function Spinner() {
  return (
    <div className="flex items-center gap-sm py-sm text-primary">
      <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      <span className="text-body-sm">処理中...</span>
    </div>
  );
}

function Notice({ tone, children }: { tone: "error" | "muted"; children: ReactNode }) {
  const cls =
    tone === "error"
      ? "border-error/30 bg-error/5 text-error"
      : "border-divider bg-background-subtle text-text-secondary";
  return <div className={`border rounded-lg px-md py-sm text-body-sm ${cls}`}>{children}</div>;
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <div className="text-label-xs text-text-secondary font-bold px-xs">{children}</div>;
}

/** 操作（持出/返却）のピル。 */
function ActionPill({ action }: { action: "checkout" | "return" }) {
  return action === "return" ? (
    <span className="text-label-xs font-bold bg-success/10 text-success rounded-sm px-sm py-0.5">
      返却
    </span>
  ) : (
    <span className="text-label-xs font-bold bg-primary/10 text-primary rounded-sm px-sm py-0.5">
      持出
    </span>
  );
}

function CandidateButton({
  candidate,
  onClick,
}: {
  candidate: ItemCandidate;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-between gap-sm text-left rounded-lg px-md py-sm min-h-[52px] border border-divider bg-surface text-ink shadow-card active:bg-primary-light transition-colors"
    >
      <span className="flex flex-col">
        <span className="text-body-md font-bold">{candidate.name}</span>
        <span className="text-label-xs text-text-secondary">
          {candidate.trackingType === "individual" ? "個体管理（番号あり）" : "数量管理"}
        </span>
      </span>
      <span className="text-text-secondary">›</span>
    </button>
  );
}

/** 番号チップ（個体選択）。持出中は checkout 時に選べない。 */
function UnitChips({
  units,
  selected,
  isReturnMode,
  onToggle,
}: {
  units: ResolvedUnit[];
  selected: number[];
  isReturnMode: boolean;
  onToggle: (n: number) => void;
}) {
  return (
    <div className="flex flex-wrap gap-sm">
      {units.map((u) => {
        const out = !!u.currentHolderId;
        const disabled = !isReturnMode && out; // checkout 時は持出中を選べない（D-11）
        const on = selected.includes(u.unitNumber);
        const cls = on
          ? "bg-primary text-surface border-primary"
          : disabled
            ? "bg-background-subtle text-text-secondary border-divider opacity-60"
            : "bg-surface text-ink border-divider active:bg-primary-light";
        return (
          <button
            key={u.unitNumber}
            type="button"
            disabled={disabled}
            onClick={() => onToggle(u.unitNumber)}
            className={`relative min-w-[48px] h-12 px-sm rounded-md border font-mono text-body-md font-bold flex items-center justify-center transition-colors ${cls}`}
          >
            {u.unitNumber}
            {out && (
              <span className="absolute -top-1.5 -right-1.5 text-[9px] leading-none bg-error text-surface rounded-full px-1 py-0.5">
                {isReturnMode ? "中" : "持出"}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function RallyPrompt({
  state,
  field,
  selectedUnits,
  onToggleUnit,
  onConfirmUnits,
  qtyInput,
  onQtyInput,
  onConfirmQuantity,
  onConfirmUnitsText,
  onAnswerEnum,
}: {
  state: HostState;
  field: { name: string; type: string; label: string; options?: string[] };
  selectedUnits: number[];
  onToggleUnit: (n: number) => void;
  onConfirmUnits: () => void;
  qtyInput: string;
  onQtyInput: (v: string) => void;
  onConfirmQuantity: (raw: string) => void;
  onConfirmUnitsText: (raw: string) => void;
  onAnswerEnum: (opt: string) => void;
}) {
  const returnMode = isReturn(state);
  return (
    <div className="rounded-xl bg-surface border border-divider shadow-card p-md flex flex-col gap-md">
      <div className="flex items-center gap-sm">
        <ActionPill action={returnMode ? "return" : "checkout"} />
        <span className="text-headline-md font-bold text-ink">{state.itemName ?? "工具"}</span>
      </div>

      {field.type === "enum" ? (
        <div className="flex flex-col gap-sm">
          <SectionLabel>{field.label}を選択</SectionLabel>
          <div className="flex gap-sm">
            {(field.options ?? []).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => onAnswerEnum(opt)}
                className={`flex-1 h-12 rounded-md border text-body-md font-bold ${
                  opt === "return"
                    ? "border-success text-success active:bg-success/10"
                    : "border-primary text-primary active:bg-primary-light"
                }`}
              >
                {opt === "return" ? "返却" : "持出"}
              </button>
            ))}
          </div>
        </div>
      ) : field.name === TOOLS_FIELD.units && state.availableUnits.length > 0 ? (
        <div className="flex flex-col gap-sm">
          <SectionLabel>番号を選択（複数可）</SectionLabel>
          <UnitChips
            units={state.availableUnits}
            selected={selectedUnits}
            isReturnMode={returnMode}
            onToggle={onToggleUnit}
          />
          <button
            type="button"
            disabled={selectedUnits.length === 0}
            onClick={onConfirmUnits}
            className="h-12 rounded-md bg-primary text-surface font-bold shadow-primary-cta disabled:opacity-40"
          >
            {selectedUnits.length > 0 ? `${selectedUnits.length}件を確定` : "番号を選択"}
          </button>
        </div>
      ) : field.name === TOOLS_FIELD.quantity ? (
        <div className="flex flex-col gap-sm">
          <SectionLabel>数量を選択</SectionLabel>
          <div className="flex flex-wrap gap-sm">
            {QTY_PRESETS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => onConfirmQuantity(String(q))}
                className="min-w-[48px] h-12 px-sm rounded-md border border-divider bg-surface text-ink font-mono text-body-md font-bold active:bg-primary-light"
              >
                {q}
              </button>
            ))}
          </div>
          <div className="flex items-stretch gap-sm">
            <input
              inputMode="numeric"
              value={qtyInput}
              onChange={(e) => onQtyInput(e.target.value)}
              placeholder="その他の数量"
              className="flex-1 bg-background-subtle border border-divider rounded-md px-md text-body-md focus:outline-none focus:border-primary"
            />
            <button
              type="button"
              disabled={!qtyInput.trim()}
              onClick={() => onConfirmQuantity(qtyInput)}
              className="px-lg rounded-md bg-primary text-surface font-bold shadow-primary-cta disabled:opacity-40"
            >
              確定
            </button>
          </div>
        </div>
      ) : (
        // フォールバック（availableUnits 不在の個体管理など）: 自由文で番号入力
        <div className="flex flex-col gap-sm">
          <SectionLabel>{field.label}を入力</SectionLabel>
          <div className="flex items-stretch gap-sm">
            <input
              inputMode="numeric"
              value={qtyInput}
              onChange={(e) => onQtyInput(e.target.value)}
              placeholder="例: 2,3"
              className="flex-1 bg-background-subtle border border-divider rounded-md px-md py-sm text-body-md focus:outline-none focus:border-primary"
            />
            <button
              type="button"
              disabled={!qtyInput.trim()}
              onClick={() => onConfirmUnitsText(qtyInput)}
              className="px-lg rounded-md bg-primary text-surface font-bold shadow-primary-cta disabled:opacity-40"
            >
              確定
            </button>
          </div>
        </div>
      )}

      {state.issues.length > 0 && (
        <div className="text-label-xs text-error whitespace-pre-wrap">
          {state.issues.map((iss) => iss.message).join("\n")}
        </div>
      )}
    </div>
  );
}

/** 1 行サマリー（履歴 done バブル用）。 */
function summaryLine(s: HostState): string {
  const action = isReturn(s) ? "返却" : "持出";
  const name = s.itemName ?? "工具";
  const units = readUnits(s);
  const qty = readQuantity(s);
  const target =
    units.length > 0
      ? ` ${units.map((u) => `#${u.unitNumber}`).join(",")}`
      : qty !== null
        ? ` ×${qty}`
        : "";
  const site =
    s.pendingRefs.site && s.record.fields[TOOLS_FIELD.site] ? ` → ${s.pendingRefs.site}` : "";
  return `${name}${target}${site} を${action}`;
}

/** ready: 登録確認カード（信号色・操作ピル・番号/数量・現場・実行 CTA）。 */
function ReadyCard({
  state,
  onExecute,
  onChooseSite,
}: {
  state: HostState;
  onExecute: () => void;
  onChooseSite: (c: SiteCandidate) => void;
}) {
  const returnMode = isReturn(state);
  const units = readUnits(state);
  const qty = readQuantity(state);
  const siteResolved = !!state.record.fields[TOOLS_FIELD.site];

  return (
    <div
      className={`rounded-xl bg-surface shadow-card-strong border border-divider border-l-4 ${signalBorder(state.signal)} overflow-hidden`}
    >
      <div className="p-md flex flex-col gap-md">
        {/* 工具 + 操作 */}
        <div className="flex items-center gap-sm">
          <ActionPill action={returnMode ? "return" : "checkout"} />
          <span className="text-headline-md font-bold text-ink">{state.itemName ?? "工具"}</span>
        </div>

        {/* 番号 or 数量 */}
        {units.length > 0 ? (
          <div className="flex flex-col gap-xs">
            <SectionLabel>番号</SectionLabel>
            <div className="flex flex-wrap gap-xs">
              {units.map((u) => (
                <span
                  key={u.unitNumber}
                  className="font-mono text-body-md font-bold bg-primary-light text-primary-dark rounded-sm px-sm py-0.5"
                >
                  #{u.unitNumber}
                </span>
              ))}
            </div>
          </div>
        ) : qty !== null ? (
          <div className="flex items-baseline gap-xs">
            <span className="text-label-xs text-text-secondary">数量</span>
            <span className="font-mono text-headline-lg text-ink">{qty}</span>
          </div>
        ) : null}

        {/* 現場 */}
        <SiteRow state={state} resolved={siteResolved} onChooseSite={onChooseSite} />

        {/* 注意 */}
        {state.issues.length > 0 && (
          <div className="flex flex-col gap-xs bg-error/5 border border-error/20 rounded-md px-sm py-xs">
            {state.issues.map((iss) => (
              <div key={iss.kind + iss.message} className="text-label-xs text-error">
                ⚠ {iss.message}
              </div>
            ))}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onExecute}
        className={`w-full h-14 text-surface text-body-md font-bold ${
          returnMode ? "bg-success shadow-cta" : "bg-primary shadow-primary-cta"
        }`}
      >
        この内容で{returnMode ? "返却" : "登録"}する
      </button>
    </div>
  );
}

function SiteRow({
  state,
  resolved,
  onChooseSite,
}: {
  state: HostState;
  resolved: boolean;
  onChooseSite: (c: SiteCandidate) => void;
}) {
  if (state.pendingRefs.site && resolved) {
    return <div className="text-body-sm text-success">✓ 現場: {state.pendingRefs.site}</div>;
  }
  if (!resolved && state.siteCandidates.length > 0) {
    return (
      <div className="flex flex-col gap-xs">
        <SectionLabel>現場を選択（任意）</SectionLabel>
        <div className="flex flex-wrap gap-xs">
          {state.siteCandidates.map((c) => (
            <button
              key={c.projectId}
              type="button"
              onClick={() => onChooseSite(c)}
              className="text-body-sm rounded-md px-md py-sm min-h-[40px] border border-divider bg-surface text-ink active:bg-primary-light"
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>
    );
  }
  if (state.pendingRefs.site) {
    return (
      <div className="text-label-xs text-text-secondary">
        現場「{state.pendingRefs.site}」は未照合のため記録しません
      </div>
    );
  }
  return null;
}
