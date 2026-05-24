"use server";

/**
 * 紛失/発見の Server Actions
 *
 * - reportLost: 個体の紛失を記録（movement_type='lost'）
 * - reportFound: 紛失中個体の発見を記録（movement_type='found'）
 * - listLostUnits: 紛失中個体一覧を取得（v_lost_units から）
 *
 * append-only / 罠A 維持。
 */

import { createPublicServerClient, createServerSupabaseClient } from "@/lib/supabase/server";

export type LostUnit = {
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

/**
 * 紛失報告: movement_type='lost' を INSERT
 */
export async function reportLost(params: {
  itemId: string;
  unitId: string;
  movedBy: string;
  /** 紛失した場所（任意）。location_id を to_location_id に入れる */
  locationId?: string | null;
  /** 紛失した現場（任意） */
  projectId?: string | null;
  /** 状況メモ */
  notes?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.from("item_movements").insert({
      item_id: params.itemId,
      unit_id: params.unitId,
      quantity: null,
      movement_type: "lost",
      from_location_id: null,
      to_location_id: params.locationId ?? null,
      project_id: params.projectId ?? null,
      holder_id: null, // 紛失なので保持者なし
      moved_by: params.movedBy,
      source: "lost_report",
      confidence: null,
      notes: params.notes ?? null,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * 発見報告: movement_type='found' を INSERT（lost を打ち消す）
 */
export async function reportFound(params: {
  itemId: string;
  unitId: string;
  movedBy: string;
  /** 発見場所（任意）。デフォルトは事務所・倉庫 */
  locationId?: string | null;
  notes?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.from("item_movements").insert({
      item_id: params.itemId,
      unit_id: params.unitId,
      quantity: null,
      movement_type: "found",
      from_location_id: null,
      to_location_id: params.locationId ?? null,
      project_id: null,
      holder_id: null,
      moved_by: params.movedBy,
      source: "found_report",
      confidence: null,
      notes: params.notes ?? null,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * 紛失中個体一覧（v_lost_units + 保持者名解決）
 */
export async function listLostUnits(): Promise<LostUnit[]> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("v_lost_units")
      .select(
        "unit_id, item_id, item_name, unit_number, current_project_id, current_holder_id, last_moved_at, days_lost",
      )
      .order("last_moved_at", { ascending: false });

    if (error) {
      console.error("[listLostUnits] error:", error);
      return [];
    }

    const rows = data ?? [];
    const holderIds = Array.from(
      new Set(rows.map((r) => r.current_holder_id).filter((id): id is string => !!id)),
    );

    // 保持者名解決（best-effort）
    const holderNameMap = new Map<string, string>();
    if (holderIds.length > 0) {
      try {
        const pub = await createPublicServerClient();
        const { data: emps } = await pub
          .from("employees")
          .select("employee_id, family_name, given_name")
          .in("employee_id", holderIds);
        for (const e of emps ?? []) {
          const name =
            `${(e.family_name as string) ?? ""} ${(e.given_name as string) ?? ""}`.trim() ||
            "(無名)";
          holderNameMap.set(e.employee_id as string, name);
        }
      } catch {
        // ignore
      }
    }

    return rows.map((r) => ({
      unitId: r.unit_id as string,
      itemId: r.item_id as string,
      itemName: r.item_name as string,
      unitNumber: r.unit_number as number,
      currentProjectId: (r.current_project_id as string | null) ?? null,
      currentHolderId: (r.current_holder_id as string | null) ?? null,
      currentHolderName: r.current_holder_id
        ? (holderNameMap.get(r.current_holder_id as string) ?? null)
        : null,
      lastMovedAt: r.last_moved_at as string,
      daysLost: (r.days_lost as number | null) ?? null,
    }));
  } catch (err) {
    console.error("[listLostUnits] exception:", err);
    return [];
  }
}
