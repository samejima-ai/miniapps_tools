/**
 * Master CRUD — items / individual_units / locations
 *
 * F6 マスタ管理。MVP は一覧 + 新規作成 + 論理削除（is_active=false）。
 * 物理削除は禁止。
 *
 * 罠A遵守: items/individual_units に status カラムは存在しない。
 */

import type { SupabaseClient } from "@supabase/supabase-js";

// ============================================================================
// Items
// ============================================================================

type ItemInput = {
  name: string;
  category?: "tool" | "material" | "consumable";
  trackingType: "individual" | "quantity";
  itemCode?: string | null;
  notes?: string | null;
};

export async function listItems(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("items")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`listItems failed: ${error.message}`);

  return (data ?? []).map((row) => ({
    id: row.id as string,
    itemCode: row.item_code as string | null,
    name: row.name as string,
    category: row.category as "tool" | "material" | "consumable",
    trackingType: row.tracking_type as "individual" | "quantity",
    isActive: row.is_active as boolean,
    notes: row.notes as string | null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }));
}

export async function insertItem(supabase: SupabaseClient, input: ItemInput) {
  const { data, error } = await supabase
    .from("items")
    .insert({
      name: input.name,
      category: input.category ?? "tool",
      tracking_type: input.trackingType,
      item_code: input.itemCode ?? null,
      notes: input.notes ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(`insertItem failed: ${error.message}`);
  return data;
}

type ItemUpdateInput = Partial<{
  name: string;
  category: "tool" | "material" | "consumable";
  trackingType: "individual" | "quantity";
  itemCode: string | null;
  notes: string | null;
}>;

export async function updateItem(
  supabase: SupabaseClient,
  itemId: string,
  input: ItemUpdateInput,
) {
  // snake_case payload を必要なフィールドのみで構築
  const payload: Record<string, unknown> = {};
  if (input.name !== undefined) payload.name = input.name;
  if (input.category !== undefined) payload.category = input.category;
  if (input.trackingType !== undefined) payload.tracking_type = input.trackingType;
  if (input.itemCode !== undefined) payload.item_code = input.itemCode;
  if (input.notes !== undefined) payload.notes = input.notes;

  if (Object.keys(payload).length === 0) {
    throw new Error("updateItem: 更新フィールドが指定されていません");
  }

  const { data, error } = await supabase
    .from("items")
    .update(payload)
    .eq("id", itemId)
    .select()
    .single();

  if (error) throw new Error(`updateItem failed: ${error.message}`);
  return data;
}

/** 論理削除のみ。物理削除は禁止。 */
export async function deactivateItem(supabase: SupabaseClient, itemId: string) {
  const { error } = await supabase.from("items").update({ is_active: false }).eq("id", itemId);

  if (error) throw new Error(`deactivateItem failed: ${error.message}`);
}

// ============================================================================
// Individual Units
// ============================================================================

type UnitInput = {
  itemId: string;
  unitNumber: number;
  notes?: string | null;
};

export async function listUnits(supabase: SupabaseClient, itemId?: string) {
  // v_unit_current_status から現在状態を引き、本テーブルから notes を補完
  let statusQ = supabase
    .from("v_unit_current_status")
    .select(
      "unit_id, item_id, item_name, unit_number, current_status, current_holder_id, last_moved_at, days_out, days_lost",
    )
    .order("unit_number", { ascending: true });

  if (itemId) statusQ = statusQ.eq("item_id", itemId);

  const { data: statusRows, error: statusErr } = await statusQ;
  if (statusErr) throw new Error(`listUnits (status) failed: ${statusErr.message}`);

  const ids = (statusRows ?? []).map((r) => r.unit_id as string);
  if (ids.length === 0) return [];

  const { data: noteRows, error: noteErr } = await supabase
    .from("individual_units")
    .select("id, notes, is_active, created_at")
    .in("id", ids);

  if (noteErr) throw new Error(`listUnits (notes) failed: ${noteErr.message}`);

  const noteMap = new Map(
    (noteRows ?? []).map((r) => [
      r.id as string,
      {
        notes: r.notes as string | null,
        isActive: r.is_active as boolean,
        createdAt: r.created_at as string,
      },
    ]),
  );

  return (statusRows ?? [])
    .map((r) => {
      const note = noteMap.get(r.unit_id as string);
      // is_active=false は view が除外してるが、念のため
      if (note && !note.isActive) return null;
      return {
        id: r.unit_id as string,
        itemId: r.item_id as string,
        itemName: r.item_name as string,
        unitNumber: r.unit_number as number,
        isActive: note?.isActive ?? true,
        notes: note?.notes ?? null,
        createdAt: note?.createdAt ?? "",
        currentStatus: (r.current_status as string) ?? "in",
        currentHolderId: (r.current_holder_id as string | null) ?? null,
        lastMovedAt: (r.last_moved_at as string | null) ?? null,
        daysOut: (r.days_out as number | null) ?? null,
        daysLost: (r.days_lost as number | null) ?? null,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);
}

export async function insertUnit(supabase: SupabaseClient, input: UnitInput) {
  const { data, error } = await supabase
    .from("individual_units")
    .insert({
      item_id: input.itemId,
      unit_number: input.unitNumber,
      notes: input.notes ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(`insertUnit failed: ${error.message}`);
  return data;
}

type UnitUpdateInput = Partial<{
  unitNumber: number;
  notes: string | null;
}>;

export async function updateUnit(
  supabase: SupabaseClient,
  unitId: string,
  input: UnitUpdateInput,
) {
  const payload: Record<string, unknown> = {};
  if (input.unitNumber !== undefined) payload.unit_number = input.unitNumber;
  if (input.notes !== undefined) payload.notes = input.notes;

  if (Object.keys(payload).length === 0) {
    throw new Error("updateUnit: 更新フィールドが指定されていません");
  }

  const { data, error } = await supabase
    .from("individual_units")
    .update(payload)
    .eq("id", unitId)
    .select()
    .single();

  if (error) throw new Error(`updateUnit failed: ${error.message}`);
  return data;
}

/** 論理削除（廃棄/紛失）。物理削除は禁止。 */
export async function deactivateUnit(supabase: SupabaseClient, unitId: string) {
  const { error } = await supabase
    .from("individual_units")
    .update({ is_active: false })
    .eq("id", unitId);

  if (error) throw new Error(`deactivateUnit failed: ${error.message}`);
}

// ============================================================================
// Locations
// ============================================================================

type LocationInput = {
  name: string;
  kind?: "warehouse" | "site";
  projectId?: string | null;
};

export async function listLocations(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("locations")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`listLocations failed: ${error.message}`);

  return (data ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    kind: row.kind as "warehouse" | "site",
    projectId: row.project_id as string | null,
    isActive: row.is_active as boolean,
    createdAt: row.created_at as string,
  }));
}

export async function insertLocation(supabase: SupabaseClient, input: LocationInput) {
  const { data, error } = await supabase
    .from("locations")
    .insert({
      name: input.name,
      kind: input.kind ?? "warehouse",
      project_id: input.projectId ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(`insertLocation failed: ${error.message}`);
  return data;
}
