"use client";

/**
 * List Page — F3 一覧表示 / F4 クイック返却 / F7 経過日数
 *
 * v_currently_out View から「現在持出中の個体」を表示。
 * 自分軸デフォルト（holder_id = currentUserId）。
 *
 * 状態は実体テーブルから取らない（罠A）。View 経由必須。
 *
 * F4 クイック返却:
 * - 返却モード切替で選択 UI 出現
 * - 複数選択 → 一括返却 = movement_type='return' の INSERT (D-2)
 * - append-only (D-1)、UPDATE/DELETE しない
 */

import { UnitCard } from "@/components/unit-card";
import { insertReturnBatch } from "@/lib/supabase/movements";
import { listCurrentlyOut } from "@/lib/supabase/views";
import { useUser } from "@/lib/user-context";
import type { CurrentlyOut } from "@/types";
import { useCallback, useEffect, useMemo, useState } from "react";

type Scope = "mine" | "all";

/** デモデータ（Supabase 未接続時） */
const DEMO_DATA: CurrentlyOut[] = [
  {
    unitId: "demo-unit-1",
    itemId: "demo-item-1",
    itemName: "マキタ18Vバッテリー",
    unitNumber: 7,
    currentProjectId: null,
    currentHolderId: "00000000-0000-0000-0000-000000000001",
    lastMovedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    daysOut: 2,
  },
  {
    unitId: "demo-unit-2",
    itemId: "demo-item-1",
    itemName: "マキタ18Vバッテリー",
    unitNumber: 8,
    currentProjectId: null,
    currentHolderId: "00000000-0000-0000-0000-000000000001",
    lastMovedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    daysOut: 5,
  },
  {
    unitId: "demo-unit-3",
    itemId: "demo-item-2",
    itemName: "インパクトドライバー",
    unitNumber: 3,
    currentProjectId: null,
    currentHolderId: "00000000-0000-0000-0000-000000000001",
    lastMovedAt: new Date(Date.now() - 10 * 86400000).toISOString(),
    daysOut: 10,
  },
  {
    unitId: "demo-unit-4",
    itemId: "demo-item-3",
    itemName: "レーザー墨出し器",
    unitNumber: 1,
    currentProjectId: null,
    currentHolderId: "00000000-0000-0000-0000-000000000002",
    lastMovedAt: new Date(Date.now() - 1 * 86400000).toISOString(),
    daysOut: 1,
  },
];

export default function ListPage() {
  const { currentUser } = useUser();
  const [scope, setScope] = useState<Scope>("mine");
  const [returnMode, setReturnMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [items, setItems] = useState<CurrentlyOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [returning, setReturning] = useState(false);

  // データ読み込み
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
          setItems(DEMO_DATA);
          return;
        }

        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const data = await listCurrentlyOut(supabase, {
          holderId: scope === "mine" ? currentUser?.id : undefined,
        });
        setItems(data);
      } catch {
        setItems(DEMO_DATA);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [scope, currentUser?.id]);

  // クライアント側フィルタ (300ms 以内 = Must 閾値)
  const filteredItems = useMemo(() => {
    let result = items;

    // 自分軸フィルタ（デモデータの場合はクライアント側で）
    if (scope === "mine" && currentUser) {
      result = result.filter((i) => i.currentHolderId === currentUser.id);
    }

    // フリー検索
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (i) => i.itemName.toLowerCase().includes(q) || String(i.unitNumber).includes(q),
      );
    }

    return result;
  }, [items, scope, currentUser, searchQuery]);

  // 返却モード: 選択トグル
  const toggleSelect = useCallback((unitId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(unitId)) {
        next.delete(unitId);
      } else {
        next.add(unitId);
      }
      return next;
    });
  }, []);

  // 全選択/全解除
  const selectAll = useCallback(() => {
    setSelectedIds(new Set(filteredItems.map((i) => i.unitId)));
  }, [filteredItems]);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // 返却モード終了時にリセット
  const exitReturnMode = useCallback(() => {
    setReturnMode(false);
    setSelectedIds(new Set());
  }, []);

  // F4: 一括返却実行
  const handleReturn = useCallback(async () => {
    if (selectedIds.size === 0 || !currentUser) return;

    setReturning(true);
    try {
      const selectedItems = filteredItems.filter((i) => selectedIds.has(i.unitId));

      if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        await insertReturnBatch(
          supabase,
          selectedItems.map((i) => ({
            itemId: i.itemId,
            unitId: i.unitId,
            fromLocationId: null,
            toLocationId: null,
            projectId: i.currentProjectId,
          })),
          currentUser.id,
        );
      }

      // 一覧から返却分を除外（View 経由で消えるのを UI 上先行反映）
      setItems((prev) => prev.filter((i) => !selectedIds.has(i.unitId)));
      exitReturnMode();
    } catch (err) {
      console.error("Return failed:", err);
    } finally {
      setReturning(false);
    }
  }, [selectedIds, currentUser, filteredItems, exitReturnMode]);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* スコープセグメント + 返却モード */}
      <div className="px-lg pt-md pb-sm flex items-center gap-sm">
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

        {!returnMode ? (
          <button
            type="button"
            onClick={() => setReturnMode(true)}
            className="bg-success text-surface text-body-sm font-bold px-md py-xs rounded-md min-h-[36px] shadow-cta transition-colors hover:opacity-90"
          >
            返却
          </button>
        ) : (
          <div className="flex items-center gap-xs">
            <button
              type="button"
              onClick={selectAll}
              className="text-primary text-label-xs font-bold px-sm py-xs"
            >
              全選択
            </button>
            <button
              type="button"
              onClick={deselectAll}
              className="text-text-secondary text-label-xs px-sm py-xs"
            >
              全解除
            </button>
            <button
              type="button"
              onClick={exitReturnMode}
              className="text-text-secondary text-body-sm border border-divider rounded-md px-sm py-xs min-h-[32px]"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* 検索バー（返却モードでは非表示） */}
      {!returnMode && (
        <div className="px-lg pb-sm">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="工具名・番号で検索"
            className="w-full bg-background-subtle border border-divider rounded-md px-md py-sm text-body-md placeholder:text-text-secondary focus:outline-none focus:border-primary"
          />
        </div>
      )}

      {/* 件数表示 */}
      {returnMode && selectedIds.size > 0 && (
        <div className="px-lg pb-xs">
          <span className="text-primary text-label-xs font-bold">選択 {selectedIds.size} 点</span>
        </div>
      )}

      {/* 一覧コンテンツ */}
      <div className="flex-1 overflow-y-auto px-lg pb-lg">
        {loading ? (
          <div className="flex items-center justify-center py-xl text-text-secondary text-body-sm">
            読み込み中...
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-xl gap-md text-text-secondary">
            <div className="text-[32px]">📋</div>
            <div className="text-body-md text-center">
              {scope === "mine"
                ? `${currentUser?.name ?? ""}の持出中工具はありません`
                : "持出中の工具はありません"}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-sm">
            {filteredItems.map((item) => (
              <UnitCard
                key={item.unitId}
                item={item}
                returnMode={returnMode}
                selected={selectedIds.has(item.unitId)}
                onToggleSelect={toggleSelect}
              />
            ))}
          </div>
        )}
      </div>

      {/* 返却モード: 一括返却ボタン (F4) */}
      {returnMode && (
        <div className="px-lg pb-lg">
          <button
            type="button"
            disabled={selectedIds.size === 0 || returning}
            onClick={handleReturn}
            className="w-full bg-success text-surface font-bold rounded-lg py-md min-h-[48px] shadow-cta disabled:opacity-40 disabled:shadow-none transition-all"
          >
            {returning ? "返却中..." : `選択した ${selectedIds.size} 点を返却`}
          </button>
        </div>
      )}
    </div>
  );
}
