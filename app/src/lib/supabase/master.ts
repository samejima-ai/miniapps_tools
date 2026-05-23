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
  let q = supabase
    .from("individual_units")
    .select("*, items!inner(name)")
    .eq("is_active", true)
    .order("unit_number", { ascending: true });

  if (itemId) {
    q = q.eq("item_id", itemId);
  }

  const { data, error } = await q;

  if (error) throw new Error(`listUnits failed: ${error.message}`);

  return (data ?? []).map((row) => ({
    id: row.id as string,
    itemId: row.item_id as string,
    itemName: (row.items as Record<string, unknown>)?.name as string,
    unitNumber: row.unit_number as number,
    isActive: row.is_active as boolean,
    notes: row.notes as string | null,
    createdAt: row.created_at as string,
  }));
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
