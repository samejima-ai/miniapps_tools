"use client";

/**
 * SignalCard — F5 信号色 UI（CaaF 確認カード）
 *
 * DESIGN.md card-signal: 信号色で境界線色が動的変化。
 * - 🟢 緑: 高確信 × 全一致 → Phase1 自動化候補（MVP は人がタップ）
 * - 🟡 黄: 中確信 or 番号未指定 → 該当項目ハイライト
 * - 🟠 橙: 低確信 or マスタ未一致
 * - 🔴 赤: 対象不特定 → 確定不可
 *
 * Phase 0 = 全件確認。色は表示のみ、自動 INSERT しない (D-3/D-4)。
 *
 * マスタ照合: LLM 抽出名 → DB 正式名称を表示。
 * 番号存在チェック: 存在しない番号は警告表示。
 */

import type { CaaFExtractionResult, Signal } from "@/types";
import type { ResolvedItem } from "@/app/(main)/input/actions";

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
  resolved: ResolvedItem[];
  onConfirm: () => void;
  onEdit: () => void;
  onRedirectToReturn?: () => void;
  confirming: boolean;
};

export function SignalCard({
  extraction,
  signal,
  resolved,
  onConfirm,
  onEdit,
  onRedirectToReturn,
  confirming,
}: Props) {
  const style = SIGNAL_STYLES[signal];
  const hasBlockingIssue = resolved.some(
    (r) => r.status === "not_found" || r.status === "unit_missing" || r.status === "no_unit_specified",
  );
  const canConfirm =
    signal !== "red" &&
    extraction.items.length > 0 &&
    extraction.action !== "return" &&
    !hasBlockingIssue;

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

      {/* マスタ照合済みアイテム一覧 */}
      {resolved.length > 0 ? (
        <div className="flex flex-col gap-sm">
          {resolved.map((item, i) => (
            <div key={`${item.extractedName}-${i}`} className="flex flex-col gap-xs">
              {/* メイン行: 正式名称 + 番号バッジ + confidence */}
              <div className="flex items-center gap-sm flex-wrap">
                {item.matchedName ? (
                  <span className="text-body-md text-ink font-bold">{item.matchedName}</span>
                ) : (
                  <span className="text-body-md text-error font-bold line-through">
                    {item.extractedName}
                  </span>
                )}

                {/* 番号バッジ: 存在=primary, 不在=error */}
                {item.unitResolutions.length > 0 && (
                  <div className="flex gap-xs">
                    {item.unitResolutions.map((u) => (
                      <span
                        key={u.unitNumber}
                        className={`text-surface text-label-xs font-mono px-sm py-0.5 rounded-sm ${
                          u.exists ? "bg-primary" : "bg-error"
                        }`}
                      >
                        #{u.unitNumber}
                      </span>
                    ))}
                  </div>
                )}

                {item.quantity != null && (
                  <span className="text-body-sm text-text-secondary">× {item.quantity}</span>
                )}

                <span className="text-label-xs text-text-secondary font-mono ml-auto">
                  {Math.round(item.confidence * 100)}%
                </span>
              </div>

              {/* 補完表示: LLM抽出名 → マスタ正式名（異なる場合） */}
              {item.matchedName && item.matchedName !== item.extractedName && (
                <div className="text-label-xs text-text-secondary pl-xs">
                  入力: {item.extractedName} → {item.matchedName}
                </div>
              )}

              {/* 警告: マスタ未一致 */}
              {item.status === "not_found" && (
                <div className="text-label-xs text-error pl-xs">
                  マスタに一致する工具がありません
                </div>
              )}

              {/* 警告: 番号不在 */}
              {item.status === "unit_missing" && (
                <div className="text-label-xs text-error pl-xs">
                  存在しない番号があります（利用可能: {item.availableUnits.join(", ")}番）
                </div>
              )}

              {/* 警告: 個体管理なのに番号未指定 */}
              {item.status === "no_unit_specified" && (
                <div className="text-label-xs text-warning pl-xs">
                  番号を指定してください（利用可能: {item.availableUnits.join(", ")}番）
                </div>
              )}
            </div>
          ))}
        </div>
      ) : extraction.items.length > 0 ? (
        <div className="flex flex-col gap-sm">
          {extraction.items.map((item, i) => (
            <div key={`${item.name}-${i}`} className="flex items-center gap-sm">
              <span className="text-body-md text-ink font-bold">{item.name}</span>
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
