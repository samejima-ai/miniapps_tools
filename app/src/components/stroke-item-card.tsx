"use client";

/**
 * StrokeItemCard — ストローク内の個別アイテム確認カード
 *
 * 各工具の確定/スキップを個別に操作できる。
 * Phase 0 = 人間タップ必須 (D-4)。
 */

import type { ResolvedItem } from "@/app/(main)/input/actions";

export type ItemStatus = "pending" | "confirmed" | "skipped" | "error";

export type StrokeItem = {
  resolved: ResolvedItem;
  status: ItemStatus;
};

type Props = {
  item: StrokeItem;
  onConfirm: () => void;
  onSkip: () => void;
  onUndoSkip: () => void;
};

export function StrokeItemCard({ item, onConfirm, onSkip, onUndoSkip }: Props) {
  const { resolved, status } = item;
  const canConfirm = resolved.status === "matched" && status === "pending";

  // ── 確定済み ──
  if (status === "confirmed") {
    return (
      <div className="flex items-center gap-sm py-xs px-sm rounded-md bg-success/5">
        <span className="text-success text-body-sm">✓</span>
        <span className="text-body-sm text-ink font-bold">
          {resolved.matchedName ?? resolved.extractedName}
        </span>
        {resolved.unitResolutions.map((u) => (
          <span
            key={u.unitNumber}
            className="text-surface text-label-xs font-mono px-xs py-0.5 rounded-sm bg-success"
          >
            #{u.unitNumber}
          </span>
        ))}
        {resolved.quantity != null && (
          <span className="text-body-sm text-text-secondary">× {resolved.quantity}</span>
        )}
      </div>
    );
  }

  // ── スキップ済み ──
  if (status === "skipped") {
    return (
      <div className="flex items-center gap-sm py-xs px-sm rounded-md bg-background-subtle">
        <span className="text-text-secondary text-body-sm">—</span>
        <span className="text-body-sm text-text-secondary line-through">
          {resolved.matchedName ?? resolved.extractedName}
        </span>
        <button
          type="button"
          onClick={onUndoSkip}
          className="text-label-xs text-primary ml-auto"
        >
          戻す
        </button>
      </div>
    );
  }

  // ── 未決定（pending） ──
  const hasIssue = resolved.status !== "matched";

  return (
    <div
      className={`border rounded-lg p-sm flex flex-col gap-xs ${
        hasIssue ? "border-error/30 bg-error/5" : "border-divider"
      }`}
    >
      {/* メイン行: 名前 + 番号バッジ + confidence */}
      <div className="flex items-center gap-sm flex-wrap">
        {resolved.matchedName ? (
          <span className="text-body-sm text-ink font-bold">{resolved.matchedName}</span>
        ) : (
          <span className="text-body-sm text-error font-bold line-through">
            {resolved.extractedName}
          </span>
        )}

        {resolved.unitResolutions.length > 0 && (
          <div className="flex gap-xs">
            {resolved.unitResolutions.map((u) => (
              <span
                key={u.unitNumber}
                className={`text-surface text-label-xs font-mono px-xs py-0.5 rounded-sm ${
                  u.exists ? "bg-primary" : "bg-error"
                }`}
              >
                #{u.unitNumber}
              </span>
            ))}
          </div>
        )}

        {resolved.quantity != null && (
          <span className="text-body-sm text-text-secondary">× {resolved.quantity}</span>
        )}

        <span className="text-label-xs text-text-secondary font-mono ml-auto">
          {Math.round(resolved.confidence * 100)}%
        </span>
      </div>

      {/* 名前マッピング */}
      {resolved.matchedName && resolved.matchedName !== resolved.extractedName && (
        <div className="text-label-xs text-text-secondary">
          入力: {resolved.extractedName} → {resolved.matchedName}
        </div>
      )}

      {/* 警告 */}
      {resolved.status === "not_found" && (
        <div className="text-label-xs text-error">
          マスタに一致する工具がありません
        </div>
      )}
      {resolved.status === "unit_missing" && (
        <div className="text-label-xs text-error">
          存在しない番号があります（利用可能: {resolved.availableUnits.join(", ")}番）
        </div>
      )}
      {resolved.status === "no_unit_specified" && (
        <div className="text-label-xs text-warning">
          番号を指定してください（利用可能: {resolved.availableUnits.join(", ")}番）
        </div>
      )}

      {/* アクションボタン */}
      <div className="flex gap-sm justify-end mt-xs">
        {canConfirm && (
          <button
            type="button"
            onClick={onConfirm}
            className="text-label-xs text-surface bg-primary rounded-md px-md py-xs min-h-[32px] font-bold"
          >
            確定
          </button>
        )}
        <button
          type="button"
          onClick={onSkip}
          className="text-label-xs text-text-secondary border border-divider rounded-md px-md py-xs min-h-[32px]"
        >
          スキップ
        </button>
      </div>
    </div>
  );
}
