"use client";

/**
 * Lost Page — 紛失中個体の一覧と発見報告
 *
 * v_lost_units から紛失中個体を取得。「発見」ボタンで found イベントを INSERT し
 * 倉庫に戻す（current_status = 'in' に復帰）。
 */

import { useUser } from "@/lib/user-context";
import { useCallback, useEffect, useState } from "react";

type LostUnit = {
  unitId: string;
  itemId: string;
  itemName: string;
  unitNumber: number;
  currentProjectId: string | null;
  currentHolderId: string | null;
  currentHolderName: string | null;
  lastMovedAt: string;
  daysLost: number | null;
};

type WarehouseLocation = { id: string; name: string };

export default function LostPage() {
  const { currentUser } = useUser();
  const [units, setUnits] = useState<LostUnit[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { listLostUnits } = await import("@/lib/supabase/lost");
      const data = await listLostUnits();
      setUnits(data);

      // 発見時のデフォルト戻し先候補
      if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
        const { createClient } = await import("@/lib/supabase/client");
        const { listLocations } = await import("@/lib/supabase/master");
        const supabase = createClient();
        const locs = await listLocations(supabase);
        setWarehouses(locs.filter((l) => l.kind === "warehouse").map((l) => ({ id: l.id, name: l.name })));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const handleFound = useCallback(
    async (u: LostUnit, locationId: string | null) => {
      if (!confirm(`「${u.itemName} #${u.unitNumber}」を発見・戻しますか？`)) return;
      setBusyId(u.unitId);
      setError(null);
      try {
        const { reportFound } = await import("@/lib/supabase/lost");
        const result = await reportFound({
          itemId: u.itemId,
          unitId: u.unitId,
          movedBy: currentUser?.id ?? "unknown",
          locationId,
          notes: null,
        });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        await reload();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusyId(null);
      }
    },
    [currentUser, reload],
  );

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="px-lg pt-md pb-sm">
        <div className="text-headline-md text-ink">紛失中の工具</div>
        <div className="text-label-xs text-text-secondary mt-xs">
          見つかったら「発見」をタップで倉庫に戻ります
        </div>
      </div>
      <div className="flex-1 flex flex-col overflow-y-auto px-lg pb-lg">
        {error && (
          <div className="text-label-xs text-error bg-error/10 border border-error rounded-md px-md py-sm mb-md">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-xl text-text-secondary text-body-sm">
            読み込み中...
          </div>
        ) : units.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-xl gap-md text-text-secondary">
            <div className="text-[32px]">🎉</div>
            <div className="text-body-md">紛失中の工具はありません</div>
          </div>
        ) : (
          <div className="flex flex-col gap-sm">
            {units.map((u) => {
              const isBusy = busyId === u.unitId;
              return (
                <div
                  key={u.unitId}
                  className="bg-surface border border-error rounded-lg px-lg py-md shadow-card flex flex-col gap-sm"
                >
                  <div className="flex items-start gap-md">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-sm flex-wrap">
                        <span className="text-body-md font-bold text-ink truncate">
                          {u.itemName}
                        </span>
                        <span className="bg-error text-surface text-label-xs font-mono px-sm py-0.5 rounded-sm">
                          #{u.unitNumber}
                        </span>
                        {u.daysLost != null && (
                          <span className="text-label-xs text-error">{u.daysLost}日経過</span>
                        )}
                      </div>
                      <div className="text-label-xs text-text-secondary mt-xs">
                        報告日時: {new Date(u.lastMovedAt).toLocaleString("ja-JP")}
                      </div>
                      {u.currentHolderName && (
                        <div className="text-label-xs text-text-secondary">
                          最後の保持者: {u.currentHolderName}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-end gap-sm">
                    {warehouses.length > 1 ? (
                      <select
                        id={`loc-${u.unitId}`}
                        defaultValue={
                          warehouses.find((w) => w.name === "事務所・倉庫")?.id ??
                          warehouses[0]?.id ??
                          ""
                        }
                        className="flex-1 border border-divider rounded-md px-md py-sm text-body-sm bg-surface"
                      >
                        {warehouses.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.name}に戻す
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="flex-1 text-label-xs text-text-secondary">
                        {warehouses[0]?.name ?? "事務所・倉庫"}に戻します
                      </div>
                    )}
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => {
                        const sel = document.getElementById(
                          `loc-${u.unitId}`,
                        ) as HTMLSelectElement | null;
                        const locId = sel?.value || warehouses[0]?.id || null;
                        handleFound(u, locId);
                      }}
                      className="bg-primary text-surface font-bold rounded-md px-lg py-sm min-h-[44px] disabled:opacity-40"
                    >
                      {isBusy ? "..." : "発見"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
