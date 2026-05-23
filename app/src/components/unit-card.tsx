"use client";

/**
 * UnitCard — 持出中工具の一覧カード
 *
 * DESIGN.md 準拠:
 * - card shadow + border-divider
 * - unit_number は font-mono (JetBrains Mono) で桁揃え
 * - badge-unit (primary bg)
 * - badge-overdue (error bg, days_out >= 3)
 * - タッチターゲット 44px 以上
 * - 閲覧モードではカードタップ無効（誤操作防止, D-8）
 *
 * 返却モード時のみチェックボックスを表示。
 */

import type { CurrentlyOut } from "@/types";

type Props = {
  item: CurrentlyOut;
  returnMode: boolean;
  selected: boolean;
  /** 全員スコープ時の保持者名表示。自分スコープ時は省略 */
  holderName?: string | null;
  /** クイック返却（単発、確認なし）。非 returnMode 時のみ有効 */
  onQuickReturn?: (item: CurrentlyOut) => void;
  onToggleSelect?: (unitId: string) => void;
};

export function UnitCard({
  item,
  returnMode,
  selected,
  holderName,
  onQuickReturn,
  onToggleSelect,
}: Props) {
  const isOverdue = item.daysOut >= 3;
  const isSevere = item.daysOut >= 7;

  return (
    <div
      className={`bg-surface border rounded-lg px-lg py-md shadow-card flex items-center gap-md min-h-[56px] transition-colors ${
        selected ? "border-primary bg-primary-light" : "border-divider"
      }`}
    >
      {/* 返却モード: チェックボックス */}
      {returnMode && (
        <button
          type="button"
          onClick={() => onToggleSelect?.(item.unitId)}
          className="w-[22px] h-[22px] min-w-[22px] rounded border-2 flex items-center justify-center flex-shrink-0"
          style={{
            borderColor: selected
              ? "var(--color-primary, #0066b3)"
              : "var(--color-divider, #d4d9e0)",
            backgroundColor: selected ? "var(--color-primary, #0066b3)" : "transparent",
          }}
          aria-label={`${item.itemName} #${item.unitNumber} を選択`}
          aria-pressed={selected}
        >
          {selected && (
            <svg
              width="12"
              height="10"
              viewBox="0 0 12 10"
              fill="none"
              role="img"
              aria-hidden="true"
            >
              <title>チェック</title>
              <path
                d="M1 5L4.5 8.5L11 1.5"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </button>
      )}

      {/* 工具情報 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-sm flex-wrap">
          <span className="text-body-md font-bold text-ink truncate">{item.itemName}</span>
          {/* unit_number バッジ */}
          <span className="bg-primary text-surface text-label-xs font-mono px-sm py-0.5 rounded-sm flex-shrink-0">
            #{item.unitNumber}
          </span>
        </div>
        {/* 保持者名（全員スコープ時のみ） */}
        {holderName && (
          <div className="text-label-xs text-text-secondary mt-0.5">
            保持者: {holderName}
          </div>
        )}
      </div>

      {/* 経過日数バッジ (F7) */}
      {isOverdue && (
        <div
          className={`text-surface text-label-xs font-mono px-sm py-0.5 rounded-sm flex-shrink-0 ${
            isSevere ? "bg-error" : "bg-error/80"
          }`}
        >
          {item.daysOut}日
        </div>
      )}

      {/* クイック返却ボタン（非 returnMode 時のみ） */}
      {!returnMode && onQuickReturn && (
        <button
          type="button"
          onClick={() => onQuickReturn(item)}
          className="bg-success text-surface text-label-xs font-bold px-md py-xs rounded-md min-h-[36px] shadow-cta hover:opacity-90 transition-opacity flex-shrink-0"
          aria-label={`${item.itemName} #${item.unitNumber} を返却`}
        >
          返却
        </button>
      )}
    </div>
  );
}
