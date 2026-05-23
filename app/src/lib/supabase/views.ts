/**
 * View 読み出し — 状態導出の唯一の経路
 *
 * 罠A 遵守: 実体テーブル (items / individual_units) から状態を取らない。
 * すべて View (v_currently_out / v_unit_current_status) 経由で導出する。
 */

import type { CurrentlyOut, UnitCurrentStatus } from "@/types";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * 現在持出中の個体一覧を取得（v_currently_out）
 *
 * @param holderId - 自分軸フィルタ。未指定で全員
 * @param projectId - 現場フィルタ
 * @param query - フリー検索（工具名 / 番号）
 */
export async function listCurrentlyOut(
  supabase: SupabaseClient,
  filter?: {
    holderId?: string;
    projectId?: string;
    query?: string;
  },
): Promise<CurrentlyOut[]> {
  let q = supabase.from("v_currently_out").select("*");

  if (filter?.holderId) {
    q = q.eq("current_holder_id", filter.holderId);
  }
  if (filter?.projectId) {
    q = q.eq("current_project_id", filter.projectId);
  }
  if (filter?.query) {
    // PostgREST 演算子インジェクション防止: 特殊文字をエスケープ
    const sanitized = filter.query.replace(/[%_,().]/g, "");
    if (sanitized) {
      q = q.or(`item_name.ilike.%${sanitized}%,unit_number::text.ilike.%${sanitized}%`);
    }
  }

  q = q.order("last_moved_at", { ascending: false });

  const { data, error } = await q;

  if (error) {
    console.error("listCurrentlyOut error:", error);
    return [];
  }

  // snake_case → camelCase マッピング
  return (data ?? []).map((row) => ({
    unitId: row.unit_id as string,
    itemId: row.item_id as string,
    itemName: row.item_name as string,
    unitNumber: row.unit_number as number,
    currentProjectId: row.current_project_id as string | null,
    currentHolderId: row.current_holder_id as string | null,
    lastMovedAt: row.last_moved_at as string,
    daysOut: row.days_out as number,
  }));
}

/**
 * 個体の現在状態を取得（v_unit_current_status）
 */
export async function getUnitCurrentStatus(
  supabase: SupabaseClient,
  unitId: string,
): Promise<UnitCurrentStatus | null> {
  const { data, error } = await supabase
    .from("v_unit_current_status")
    .select("*")
    .eq("unit_id", unitId)
    .single();

  if (error || !data) return null;

  return {
    unitId: data.unit_id as string,
    itemId: data.item_id as string,
    itemName: data.item_name as string,
    unitNumber: data.unit_number as number,
    currentStatus: data.current_status as "in" | "out",
    currentProjectId: data.current_project_id as string | null,
    currentHolderId: data.current_holder_id as string | null,
    lastMovedAt: data.last_moved_at as string | null,
    daysOut: data.days_out as number | null,
  };
}
