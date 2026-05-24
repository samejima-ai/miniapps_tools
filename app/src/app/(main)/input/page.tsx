"use client";

/**
 * Input Page — Chat UI v2 ストローク対話モデル (CaaF コンポーネント化)
 *
 * 状態管理は useCaaF フック（lib/caaf）に委譲。
 * 本コンポーネントはドメイン固有の設定とレンダリングのみ担当。
 *
 * Phase 0 = 全件確認。自動 INSERT しない (D-4)。
 * LLM は抽出器、欠損補完しない (D-5)。
 */

import { StrokeItemCard } from "@/components/stroke-item-card";
import { useCaaF } from "@/lib/caaf";
import type { CaafConfig } from "@/lib/caaf";
import { useUser } from "@/lib/user-context";
import type { CaaFExtractionResult } from "@/types";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import {
  type ResolvedItem,
  type ResolvedProject,
  clarifyAction,
  confirmCheckoutAction,
  extractAction,
} from "./actions";

// ── Domain Config (module-level, stable reference) ──

const TOOL_CAAF_CONFIG: CaafConfig<CaaFExtractionResult, ResolvedItem, ResolvedProject> = {
  extractAction,
  clarifyAction,
  confirmAction: async (extraction, confirmedItems, context) => {
    const resolvedToSave = confirmedItems.map((i) => ({
      ...i.resolved,
      extractedName: i.originalExtractedName ?? i.resolved.extractedName,
    }));
    return confirmCheckoutAction(
      extraction,
      resolvedToSave,
      context.userId,
      null,
      context.project?.projectId ?? null,
      context.project?.projectName ?? null,
    );
  },
  getExtractedName: (r) => r.extractedName,
  makeItemKey: (r) => {
    if (r.unitResolutions.length > 0) {
      const units = r.unitResolutions
        .map((u) => u.unitNumber)
        .sort((a, b) => a - b)
        .join(",");
      return `${r.matchedItemId ?? r.extractedName}:${units}`;
    }
    return `${r.matchedItemId ?? r.extractedName}:qty`;
  },
  isConfirmable: (r) => r.status === "matched",
};

export default function InputPage() {
  const { currentUser } = useUser();
  const router = useRouter();

  const {
    strokes,
    inputText,
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
  } = useCaaF(TOOL_CAAF_CONFIG, currentUser?.id ?? null);

  // ── Domain-specific: LLM 候補選択（not_found → 候補から確定） ──
  const handleSelectCandidate = useCallback(
    (strokeId: string, itemIndex: number, candidate: ResolvedItem["candidates"][number]) => {
      updateStrokeItems(strokeId, (items) =>
        items.map((item, i) => {
          if (i !== itemIndex) return item;
          const r = item.resolved;

          // quantity 管理: 番号情報をクリア、即 matched
          if (candidate.trackingType === "quantity") {
            return {
              ...item,
              resolved: {
                ...r,
                matchedItemId: candidate.itemId,
                matchedName: candidate.name,
                trackingType: "quantity" as const,
                unitResolutions: [],
                availableUnits: [],
                availableUnitDetails: [],
                status: "matched" as ResolvedItem["status"],
                candidates: [],
              },
              status: "pending" as const,
            };
          }

          // individual 管理: 既存指定番号があれば候補側 availableUnits で再評価
          const hasUnits = r.unitResolutions.length > 0;
          const isIndividualNoUnit = !hasUnits;

          let newUnitResolutions = r.unitResolutions;
          if (hasUnits) {
            const detailByNum = new Map(
              candidate.availableUnitDetails.map((d) => [d.unitNumber, d]),
            );
            newUnitResolutions = r.unitResolutions.map((u) => {
              const d = detailByNum.get(u.unitNumber);
              return {
                unitNumber: u.unitNumber,
                unitId: d?.unitId ?? null,
                exists: !!d,
                currentHolderId: d?.currentHolderId ?? null,
                currentHolderName: d?.currentHolderName ?? null,
              };
            });
          }
          const hasUnitMissing = newUnitResolutions.some((u) => !u.exists);
          const hasUnitAlreadyOut = newUnitResolutions.some(
            (u) => u.exists && u.currentHolderId,
          );

          return {
            ...item,
            resolved: {
              ...r,
              matchedItemId: candidate.itemId,
              matchedName: candidate.name,
              trackingType: "individual" as const,
              unitResolutions: newUnitResolutions,
              availableUnits: candidate.availableUnits,
              availableUnitDetails: candidate.availableUnitDetails,
              status: (hasUnitMissing
                ? "unit_missing"
                : hasUnitAlreadyOut
                  ? "unit_already_out"
                  : isIndividualNoUnit
                    ? "no_unit_specified"
                    : "matched") as ResolvedItem["status"],
              candidates: [],
            },
            status: "pending" as const,
          };
        }),
      );
    },
    [updateStrokeItems],
  );

  // ── Domain-specific: 案件候補選択（複数マッチ時） ──
  const handleSelectProject = useCallback(
    (strokeId: string, projectId: string, projectName: string) => {
      updateStrokeProject(strokeId, {
        projectId,
        projectName,
        status: "matched" as const,
        candidates: [],
      });
    },
    [updateStrokeProject],
  );

  // ── Domain-specific: 番号選択（no_unit_specified / unit_missing 時） ──
  const handleSelectUnit = useCallback(
    (strokeId: string, itemIndex: number, unitNumber: number) => {
      updateStrokeItems(strokeId, (items) =>
        items.map((item, i) => {
          if (i !== itemIndex) return item;
          const r = item.resolved;

          const detail = r.availableUnitDetails.find((d) => d.unitNumber === unitNumber);
          if (!detail) return item;

          let newUnitResolutions: typeof r.unitResolutions;
          const resolutionFromDetail = {
            unitNumber,
            unitId: detail.unitId,
            exists: true,
            currentHolderId: detail.currentHolderId,
            currentHolderName: detail.currentHolderName,
          };

          if (r.status === "no_unit_specified") {
            newUnitResolutions = [resolutionFromDetail];
          } else if (r.status === "unit_missing") {
            let replaced = false;
            newUnitResolutions = r.unitResolutions.map((u) => {
              if (!u.exists && !replaced) {
                replaced = true;
                return resolutionFromDetail;
              }
              return u;
            });
          } else if (r.status === "unit_already_out") {
            // 持出中の番号を、在庫の別番号で置き換える
            let replaced = false;
            newUnitResolutions = r.unitResolutions.map((u) => {
              if (u.exists && u.currentHolderId && !replaced) {
                replaced = true;
                return resolutionFromDetail;
              }
              return u;
            });
          } else {
            return item;
          }

          const allExist = newUnitResolutions.every((u) => u.exists);
          const stillAlreadyOut = newUnitResolutions.some(
            (u) => u.exists && u.currentHolderId,
          );
          const newStatus: ResolvedItem["status"] = !allExist
            ? "unit_missing"
            : stillAlreadyOut
              ? "unit_already_out"
              : "matched";

          return {
            ...item,
            resolved: {
              ...r,
              unitResolutions: newUnitResolutions,
              status: newStatus,
            },
            status: "pending" as const,
          };
        }),
      );
    },
    [updateStrokeItems],
  );

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* チャットエリア */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-md py-md">
        {strokes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-text-secondary gap-sm">
            <div className="text-body-sm text-center">LINE と同じノリで入力してください</div>
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
                    <div className="text-body-sm whitespace-pre-wrap">{stroke.userText}</div>
                  </div>
                </div>

                {/* 対話修正の履歴 */}
                {stroke.clarifications.map((c, ci) => (
                  <div key={`clarify-${ci}`} className="flex flex-col gap-sm">
                    {/* 修正指示（右寄せ） */}
                    <div className="flex justify-end">
                      <div className="bg-primary text-surface rounded-2xl rounded-br-sm px-md py-sm max-w-[80%]">
                        <div className="text-body-sm whitespace-pre-wrap">{c.userText}</div>
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
                            <span className="text-ink font-bold">{stroke.extraction.site}</span>
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
                          <span className="text-text-secondary">— {stroke.items.length}件</span>
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
                                        handleSelectProject(stroke.id, c.projectId, c.name)
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
                                onSelectUnit={(num) => handleSelectUnit(stroke.id, i, num)}
                                onSelectCandidate={(c) => handleSelectCandidate(stroke.id, i, c)}
                              />
                            ))}

                            {/* 全件確定ボタン */}
                            {stroke.items.some(
                              (i) => i.status === "pending" && i.resolved.status === "matched",
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
                                (i) => i.status === "pending" && i.resolved.status !== "matched",
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
                          stroke.result.insertedCount === 0 && stroke.result.skippedCount === 0
                            ? "bg-background-subtle border border-divider"
                            : "bg-success/10 border border-success/30"
                        }`}
                      >
                        <div className="flex items-center gap-sm">
                          {stroke.result.insertedCount === 0 && stroke.result.skippedCount === 0 ? (
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
                                    {" "}
                                    / {stroke.result.skippedCount}件 スキップ
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
            onCompositionStart={handleCompositionStart}
            onCompositionEnd={handleCompositionEnd}
            placeholder={isReviewing ? "修正内容を入力..." : "工具名・番号・現場を入力..."}
            className="flex-1 bg-background-subtle border border-divider rounded-2xl px-md py-sm text-body-sm placeholder:text-text-secondary focus:outline-none focus:border-primary resize-none leading-normal"
            rows={1}
            style={{ minHeight: 40, maxHeight: 120 }}
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!inputText.trim() || isBusy}
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
