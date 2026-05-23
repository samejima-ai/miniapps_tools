"use client";

/**
 * List Page — F3 一覧表示 / F4 クイック返却 / F7 経過日数
 *
 * v_currently_out View から「現在持出中の個体」を表示。
 * 自分軸デフォルト（holder_id = currentUserId）。
 *
 * 状態は実体テーブルから取らない（罠A）。View 経由必須。
 */

import { useUser } from "@/lib/user-context";
import { useState } from "react";

type Scope = "mine" | "all";

export default function ListPage() {
  const { currentUser } = useUser();
  const [scope, setScope] = useState<Scope>("mine");
  const [returnMode, setReturnMode] = useState(false);

  return (
    <div className="flex-1 flex flex-col">
      {/* スコープセグメント + フィルタ */}
      <div className="px-lg pt-md pb-sm flex items-center gap-sm">
        {/* 自分/全員 セグメント */}
        <div className="flex border border-divider rounded-md overflow-hidden">
          <button
            type="button"
            onClick={() => setScope("mine")}
            className={`px-md py-xs text-body-sm min-h-[36px] transition-colors ${
              scope === "mine"
                ? "bg-primary text-surface font-bold"
                : "bg-surface text-text-secondary"
            }`}
          >
            自分
          </button>
          <button
            type="button"
            onClick={() => setScope("all")}
            className={`px-md py-xs text-body-sm min-h-[36px] transition-colors ${
              scope === "all"
                ? "bg-primary text-surface font-bold"
                : "bg-surface text-text-secondary"
            }`}
          >
            全員
          </button>
        </div>

        <div className="flex-1" />

        {/* 返却モード切替 */}
        {!returnMode ? (
          <button
            type="button"
            onClick={() => setReturnMode(true)}
            className="bg-success text-surface text-body-sm font-bold px-md py-xs rounded-md min-h-[36px] shadow-cta transition-colors hover:opacity-90"
          >
            返却
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setReturnMode(false)}
            className="text-text-secondary text-body-sm border border-divider rounded-md px-md py-xs min-h-[36px]"
          >
            ✕ 閲覧
          </button>
        )}
      </div>

      {/* 検索バー（返却モードでは非表示） */}
      {!returnMode && (
        <div className="px-lg pb-sm">
          <input
            type="text"
            placeholder="工具名・番号・現場で検索"
            className="w-full bg-background-subtle border border-divider rounded-md px-md py-sm text-body-md placeholder:text-text-secondary focus:outline-none focus:border-primary"
          />
        </div>
      )}

      {/* 一覧コンテンツ */}
      <div className="flex-1 overflow-y-auto px-lg pb-lg">
        {/* Empty State */}
        <div className="flex flex-col items-center justify-center py-xl gap-md text-text-secondary">
          <div className="text-[32px]">📋</div>
          <div className="text-body-md text-center">
            {scope === "mine"
              ? `${currentUser?.name ?? ""}の持出中工具はありません`
              : "持出中の工具はありません"}
          </div>
          <div className="text-body-sm">
            Supabase 接続後、v_currently_out からデータを表示します
          </div>
        </div>
      </div>

      {/* 返却モード時の一括返却ボタン */}
      {returnMode && (
        <div className="px-lg pb-lg">
          <button
            type="button"
            disabled
            className="w-full bg-success text-surface font-bold rounded-lg py-md min-h-[48px] shadow-cta disabled:opacity-40 disabled:shadow-none transition-all"
          >
            選択した 0 点を返却
          </button>
        </div>
      )}
    </div>
  );
}
