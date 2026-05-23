"use client";

/**
 * SignalCard — F5 信号色 UI（CaaF 確認カード）
 *
 * DESIGN.md card-signal: 信号色で境界線色が動的変化。
 * - 🟢 緑: 高確信 × 全一致 → Phase1 自動化候補（MVP は人がタップ）
 * - 🟡 黄: 中確信 → 該当項目ハイライト
 * - 🟠 橙: 低確信 or マスタ未一致
 * - 🔴 赤: 対象不特定 → 確定不可
 *
 * Phase 0 = 全件確認。色は表示のみ、自動 INSERT しない (D-3/D-4)。
 */

import type { CaaFExtractionResult, Signal } from "@/types";

const SIGNAL_STYLES: Record<Signal, { border: string; bg: string; label: string }> = {
  green: {
    border: "border-signal-green",
    bg: "bg-signal-green/10",
    label: "高確信",
  },
  yellow: {
    border: "border-signal-yellow",
    bg: "bg-signal-yellow/10",
    label: "要確認",
  },
  orange: {
    border: "border-signal-orange",
    bg: "bg-signal-orange/10",
    label: "低確信",
  },
  red: {
    border: "border-signal-red",
    bg: "bg-signal-red/10",
    label: "登録不可",
  },
};

type Props = {
  extraction: CaaFExtractionResult;
  signal: Signal;
  onConfirm: () => void;
  onEdit: () => void;
  onRedirectToReturn?: () => void;
  confirming: boolean;
};

export function SignalCard({
  extraction,
  signal,
  onConfirm,
  onEdit,
  onRedirectToReturn,
  confirming,
}: Props) {
  const style = SIGNAL_STYLES[signal];
  const canConfirm =
    signal !== "red" && extraction.items.length > 0 && extraction.action !== "return";

  return (
    <div
      className={`border-2 ${style.border} ${style.bg} rounded-xl shadow-card-strong p-lg flex flex-col gap-md`}
    >
      {/* 信号ヘッダー */}
      <div className="flex items-center justify-between">
        <span
          className={`text-label-xs font-bold px-sm py-0.5 rounded-sm text-surface ${
            signal === "green"
              ? "bg-signal-green"
              : signal === "yellow"
                ? "bg-signal-yellow"
                : signal === "orange"
                  ? "bg-signal-orange"
                  : "bg-signal-red"
          }`}
        >
          {style.label}
        </span>
        {extraction.action === "return" && (
          <span className="text-label-xs text-error font-bold">返却は一覧モードで</span>
        )}
      </div>

      {/* 現場 */}
      {extraction.site && (
        <div className="text-body-sm text-text-secondary">
          現場: <span className="text-ink font-bold">{extraction.site}</span>
        </div>
      )}

      {/* 抽出アイテム一覧 */}
      {extraction.items.length > 0 ? (
        <div className="flex flex-col gap-sm">
          {extraction.items.map((item, i) => (
            <div key={`${item.name}-${i}`} className="flex items-center gap-sm">
              <span className="text-body-md text-ink font-bold">{item.name}</span>
              {item.unitNumbers.length > 0 && (
                <div className="flex gap-xs">
                  {item.unitNumbers.map((num) => (
                    <span
                      key={num}
                      className="bg-primary text-surface text-label-xs font-mono px-sm py-0.5 rounded-sm"
                    >
                      #{num}
                    </span>
                  ))}
                </div>
              )}
              {item.quantity != null && (
                <span className="text-body-sm text-text-secondary">× {item.quantity}</span>
              )}
              {/* confidence バッジ（表示のみ, D-3） */}
              <span className="text-label-xs text-text-secondary font-mono ml-auto">
                {Math.round(item.confidence * 100)}%
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-body-sm text-text-secondary">工具が特定できませんでした</div>
      )}

      {/* 保持者メモ (D-7: 代理入力時) */}
      {extraction.holderNote && (
        <div className="text-body-sm text-accent font-bold">保持者: {extraction.holderNote}</div>
      )}

      {/* 曖昧点 (D-5: 人間に確認) */}
      {extraction.ambiguities.length > 0 && (
        <div className="bg-surface border border-divider rounded-md p-sm">
          <div className="text-label-xs text-warning font-bold mb-xs">確認が必要:</div>
          <ul className="text-body-sm text-text-secondary space-y-xs">
            {extraction.ambiguities.map((a) => (
              <li key={a}>• {a}</li>
            ))}
          </ul>
        </div>
      )}

      {/* アクションボタン */}
      <div className="flex gap-sm mt-sm">
        {extraction.action === "return" ? (
          <button
            type="button"
            onClick={onRedirectToReturn}
            className="flex-1 bg-success text-surface font-bold rounded-md py-sm min-h-[44px] shadow-cta"
          >
            返却モードへ
          </button>
        ) : (
          <button
            type="button"
            onClick={onConfirm}
            disabled={!canConfirm || confirming}
            className="flex-1 bg-primary text-surface font-bold rounded-md py-sm min-h-[44px] shadow-primary-cta disabled:opacity-40 disabled:shadow-none transition-all"
          >
            {confirming ? "登録中..." : "確定"}
          </button>
        )}
        <button
          type="button"
          onClick={onEdit}
          className="px-lg border border-divider text-text-secondary rounded-md py-sm min-h-[44px]"
        >
          修正
        </button>
      </div>
    </div>
  );
}
