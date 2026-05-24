"use client";

/**
 * StrokeItemCard — ストローク内の個別アイテム確認カード
 *
 * 各工具の確定/スキップを個別に操作できる。
 * Phase 0 = 人間タップ必須 (D-4)。
 */

import type { ResolvedItem } from "@/app/(main)/input/actions";
import type { StrokeItem } from "@/lib/caaf";

type Props = {
  item: StrokeItem<ResolvedItem>;
  onConfirm: () => void;
  onSkip: () => void;
  onUndoSkip: () => void;
  onSelectUnit?: (unitNumber: number) => void;
  /** LLM 候補から1件選択 */
  onSelectCandidate?: (candidate: ResolvedItem["candidates"][number]) => void;
};

export function StrokeItemCard({
  item,
  onConfirm,
  onSkip,
  onUndoSkip,
  onSelectUnit,
  onSelectCandidate,
}: Props) {
  const { resolved, status } = item;
  // matched でかつ持出中 unit を含まない場合のみ確定可能
  const hasAlreadyOutUnit = resolved.unitResolutions.some(
    (u) => u.exists && u.currentHolderId,
  );
  const canConfirm =
    resolved.status === "matched" && !hasAlreadyOutUnit && status === "pending";

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
        <button type="button" onClick={onUndoSkip} className="text-label-xs text-primary ml-auto">
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
          <div className="flex gap-xs flex-wrap">
            {resolved.unitResolutions.map((u) => {
              const isAlreadyOut = u.exists && u.currentHolderId;
              const bg = !u.exists
                ? "bg-error"
                : isAlreadyOut
                  ? "bg-warning"
                  : "bg-primary";
              const label = isAlreadyOut
                ? `#${u.unitNumber} (${u.currentHolderName ?? "持出中"})`
                : `#${u.unitNumber}`;
              return (
                <span
                  key={u.unitNumber}
                  className={`text-surface text-label-xs font-mono px-xs py-0.5 rounded-sm ${bg}`}
                  title={isAlreadyOut ? `${u.currentHolderName ?? "他の人"}が持出中` : undefined}
                >
                  {label}
                </span>
              );
            })}
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

      {/* 警告 + 番号選択 UI */}
      {resolved.status === "not_found" && (
        <div className="text-label-xs text-error">マスタに一致する工具がありません</div>
      )}
      {resolved.status === "unit_already_out" && (
        <div className="flex flex-col gap-xs">
          <div className="text-label-xs text-error font-bold">
            指定番号が既に持出中です（二重持出は不可）
          </div>
          {(() => {
            const inStockAlt = resolved.availableUnitDetails.filter(
              (u) =>
                !u.currentHolderId &&
                !resolved.unitResolutions.some((r) => r.unitNumber === u.unitNumber),
            );
            return inStockAlt.length > 0 ? (
              <div className="flex items-center gap-xs flex-wrap">
                <span className="text-label-xs text-text-secondary">代わりの番号:</span>
                {inStockAlt.map((u) => (
                  <button
                    key={u.unitNumber}
                    type="button"
                    onClick={() => onSelectUnit?.(u.unitNumber)}
                    className="text-label-xs text-primary border border-primary rounded-md px-sm py-xs min-w-[32px] min-h-[32px] font-mono font-bold"
                  >
                    {u.unitNumber}
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-label-xs text-text-secondary">他の在庫もありません</div>
            );
          })()}
        </div>
      )}
      {/* LLM 提案候補ピッカー */}
      {resolved.status === "candidates_proposed" && resolved.candidates.length > 0 && (
        <div className="flex flex-col gap-xs">
          <div className="text-label-xs text-warning font-bold">
            似た工具が見つかりました — 選択してください
          </div>
          <div className="flex flex-col gap-xs">
            {resolved.candidates.map((c) => {
              const inStock = c.availableUnitDetails.filter((u) => !u.currentHolderId);
              const out = c.availableUnitDetails.filter((u) => u.currentHolderId);
              return (
                <button
                  key={c.itemId}
                  type="button"
                  onClick={() => onSelectCandidate?.(c)}
                  className="text-left bg-surface border border-divider rounded-md px-md py-sm min-h-[40px] hover:border-primary transition-colors"
                >
                  <div className="flex items-center justify-between gap-sm">
                    <span className="text-body-sm text-ink font-bold truncate">{c.name}</span>
                    <span className="text-label-xs text-text-secondary font-mono shrink-0">
                      {Math.round(c.confidence * 100)}%
                    </span>
                  </div>
                  {inStock.length > 0 && (
                    <div className="text-label-xs text-text-secondary mt-0.5">
                      在庫: {inStock.map((u) => `#${u.unitNumber}`).join(" ")}
                    </div>
                  )}
                  {out.length > 0 && (
                    <div className="text-label-xs text-warning mt-0.5">
                      持出中: {out
                        .map((u) => `#${u.unitNumber}${u.currentHolderName ? `(${u.currentHolderName})` : ""}`)
                        .join(" ")}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {resolved.status === "unit_missing" && (
        <div className="flex flex-col gap-xs">
          <div className="text-label-xs text-error">存在しない番号があります</div>
          {resolved.availableUnitDetails.length > 0 &&
            (() => {
              const selected = new Set(
                resolved.unitResolutions.filter((u) => u.exists).map((u) => u.unitNumber),
              );
              const candidates = resolved.availableUnitDetails.filter(
                (u) => !selected.has(u.unitNumber),
              );
              const inStock = candidates.filter((u) => !u.currentHolderId);
              const out = candidates.filter((u) => u.currentHolderId);
              return (
                <>
                  {inStock.length > 0 && (
                    <div className="flex items-center gap-xs flex-wrap">
                      <span className="text-label-xs text-text-secondary">代わりの番号:</span>
                      {inStock.map((u) => (
                        <button
                          key={u.unitNumber}
                          type="button"
                          onClick={() => onSelectUnit?.(u.unitNumber)}
                          className="text-label-xs text-primary border border-primary rounded-md px-sm py-xs min-w-[32px] min-h-[32px] font-mono font-bold"
                        >
                          {u.unitNumber}
                        </button>
                      ))}
                    </div>
                  )}
                  {out.length > 0 && (
                    <div className="flex items-start gap-xs flex-wrap">
                      <span className="text-label-xs text-text-secondary">持出中:</span>
                      {out.map((u) => (
                        <span
                          key={u.unitNumber}
                          className="text-label-xs text-text-secondary bg-background-subtle border border-divider rounded-md px-sm py-xs min-h-[32px] font-mono inline-flex items-center gap-xs"
                          title={u.currentHolderName ?? "持出中"}
                        >
                          #{u.unitNumber}
                          {u.currentHolderName && (
                            <span className="font-sans text-text-secondary">
                              ({u.currentHolderName})
                            </span>
                          )}
                        </span>
                      ))}
                    </div>
                  )}
                </>
              );
            })()}
        </div>
      )}
      {resolved.status === "no_unit_specified" && (
        <div className="flex flex-col gap-xs">
          <div className="text-label-xs text-warning">番号を選択してください</div>
          {resolved.availableUnitDetails.length > 0 &&
            (() => {
              const inStock = resolved.availableUnitDetails.filter((u) => !u.currentHolderId);
              const out = resolved.availableUnitDetails.filter((u) => u.currentHolderId);
              return (
                <>
                  {inStock.length > 0 && (
                    <div className="flex items-center gap-xs flex-wrap">
                      {inStock.map((u) => (
                        <button
                          key={u.unitNumber}
                          type="button"
                          onClick={() => onSelectUnit?.(u.unitNumber)}
                          className="text-label-xs text-surface bg-primary rounded-md px-sm py-xs min-w-[32px] min-h-[32px] font-mono font-bold"
                        >
                          {u.unitNumber}
                        </button>
                      ))}
                    </div>
                  )}
                  {inStock.length === 0 && (
                    <div className="text-label-xs text-error">在庫がありません</div>
                  )}
                  {out.length > 0 && (
                    <div className="flex items-start gap-xs flex-wrap">
                      <span className="text-label-xs text-text-secondary">持出中:</span>
                      {out.map((u) => (
                        <span
                          key={u.unitNumber}
                          className="text-label-xs text-text-secondary bg-background-subtle border border-divider rounded-md px-sm py-xs min-h-[32px] font-mono inline-flex items-center gap-xs"
                          title={u.currentHolderName ?? "持出中"}
                        >
                          #{u.unitNumber}
                          {u.currentHolderName && (
                            <span className="font-sans text-text-secondary">
                              ({u.currentHolderName})
                            </span>
                          )}
                        </span>
                      ))}
                    </div>
                  )}
                </>
              );
            })()}
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
