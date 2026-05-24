/**
 * Movement INSERT — append-only (D-1 遵守)
 *
 * UPDATE / DELETE は提供しない。訂正は打消しイベント INSERT で表現。
 * holder_id（保持者）と moved_by（入力者）は別カラム (D-7)。
 */

import type { SupabaseClient } from "@supabase/supabase-js";

type MovementInput = {
  itemId: string;
  unitId?: string | null;
  quantity?: number | null;
  movementType:
    | "checkout"
    | "return"
    | "transfer"
    | "inbound"
    | "outbound"
    | "lost"
    | "found";
  fromLocationId?: string | null;
  toLocationId?: string | null;
  projectId?: string | null;
  holderId?: string | null;
  movedBy: string;
  source?: string;
  confidence?: number | null;
  notes?: string | null;
};

/**
 * 単一 movement INSERT
 */
export async function insertMovement(supabase: SupabaseClient, input: MovementInput) {
  const { data, error } = await supabase
    .from("item_movements")
    .insert({
      item_id: input.itemId,
      unit_id: input.unitId ?? null,
      quantity: input.quantity ?? null,
      movement_type: input.movementType,
      from_location_id: input.fromLocationId ?? null,
      to_location_id: input.toLocationId ?? null,
      project_id: input.projectId ?? null,
      holder_id: input.holderId ?? null,
      moved_by: input.movedBy,
      source: input.source ?? "caaf",
      confidence: input.confidence ?? null,
      notes: input.notes ?? null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`insertMovement failed: ${error.message}`);
  }

  return data;
}

/**
 * 一括 return INSERT（クイック返却 F4 用）
 *
 * トランザクション単位で全件 INSERT or 全件失敗。
 */
export async function insertReturnBatch(
  supabase: SupabaseClient,
  units: Array<{
    itemId: string;
    unitId: string;
    fromLocationId?: string | null;
    toLocationId?: string | null;
    projectId?: string | null;
  }>,
  movedBy: string,
) {
  const rows = units.map((u) => ({
    item_id: u.itemId,
    unit_id: u.unitId,
    quantity: null,
    movement_type: "return" as const,
    from_location_id: u.fromLocationId ?? null,
    to_location_id: u.toLocationId ?? null,
    project_id: u.projectId ?? null,
    holder_id: null, // 返却: holder は null
    moved_by: movedBy,
    source: "quick_return",
    confidence: null,
    notes: null,
  }));

  const { data, error } = await supabase.from("item_movements").insert(rows).select();

  if (error) {
    throw new Error(`insertReturnBatch failed: ${error.message}`);
  }

  return data;
}
