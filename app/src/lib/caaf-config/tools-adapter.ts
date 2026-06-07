/**
 * CaaF gen-2 Config — tools db Adapter（M-C、server-only）
 *
 * Core の CaaFAdapter（getSchema/write/read）を工具ドメインに実装する。
 * 既存 Supabase ロジック（insertMovement / master / v_currently_out）を再利用し、
 * FW Don't（罠A/D-1/D-7/D-11/D-3）は純関数 tools-mapping.ts が担保する。
 *
 * write の append-only は insertMovement（UPDATE/DELETE を持たない）に委ねる。
 * 二重持出（D-11）の判定材料は read() が v_currently_out から供給する。
 *
 * 注: Layer C（LLM 意味マッチング）はここでは未実装。決定的解決（alias→ILIKE）に留める。
 * 必要なら M-E で M-B の Extractor/曖昧性提示と組み合わせる（migration §4 の将来拡張）。
 */

import "server-only";

import { insertMovement } from "@/lib/supabase/movements";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { CaaFAdapter, CaaFApp, CaaFField, CaaFRecord, CaaFWriteResult } from "@caaf/core";
import { toolsAppForTracking } from "./tools-app";
import { TOOLS_FIELDS } from "./tools-fields";
import { type ResolvedUnit, buildMovementRows, recordToMovementInput } from "./tools-mapping";

/** read("resolve-item") が返す候補。 */
export interface ItemCandidate {
  itemId: string;
  name: string;
  trackingType: "individual" | "quantity";
  units: ResolvedUnit[];
}

type ToolsSupabase = Awaited<ReturnType<typeof createServerSupabaseClient>>;

/** item の active 個体 + v_currently_out 持出状態を解決する。 */
async function resolveUnits(supabase: ToolsSupabase, itemId: string): Promise<ResolvedUnit[]> {
  const { data: units, error: unitsErr } = await supabase
    .from("individual_units")
    .select("id, unit_number")
    .eq("item_id", itemId)
    .eq("is_active", true)
    .order("unit_number", { ascending: true });
  if (unitsErr)
    console.warn(`[tools-adapter] units fetch failed (item ${itemId}):`, unitsErr.message);

  const { data: out, error: outErr } = await supabase
    .from("v_currently_out")
    .select("unit_id, current_holder_id")
    .eq("item_id", itemId);
  if (outErr)
    console.warn(`[tools-adapter] currently_out fetch failed (item ${itemId}):`, outErr.message);

  const outMap = new Map(
    (out ?? []).map((r) => [r.unit_id as string, (r.current_holder_id as string | null) ?? null]),
  );

  return (units ?? []).map((u) => ({
    unitNumber: u.unit_number as number,
    unitId: u.id as string,
    currentHolderId: outMap.get(u.id as string) ?? null,
  }));
}

interface ItemRow {
  id: string;
  name: string;
  tracking_type: string;
}

/** items を id 固定 or 名前 ILIKE で取得する小ヘルパー（error はログして空を返す）。 */
async function fetchItems(
  supabase: ToolsSupabase,
  by: { id: string } | { ilike: string },
): Promise<ItemRow[]> {
  const base = supabase.from("items").select("id, name, tracking_type").eq("is_active", true);
  const { data, error } =
    "id" in by
      ? await base.eq("id", by.id).limit(1)
      : await base.ilike("name", `%${by.ilike}%`).order("name", { ascending: true }).limit(10);
  if (error) console.warn("[tools-adapter] items fetch failed:", error.message);
  return (data ?? []) as ItemRow[];
}

/** 工具名 → 候補（alias → ILIKE フォールバック）。Layer C は未実装。 */
async function resolveItem(supabase: ToolsSupabase, name: string): Promise<ItemCandidate[]> {
  const trimmed = name.trim();
  const key = trimmed.toLowerCase();
  if (key === "") return [];

  // 0. alias 完全一致（学習済）
  const { data: aliasHit, error: aliasErr } = await supabase
    .from("item_name_aliases")
    .select("item_id")
    .eq("alias", key)
    .limit(1);
  if (aliasErr) console.warn("[tools-adapter] alias fetch failed:", aliasErr.message);
  const aliasItemId = aliasHit?.[0]?.item_id as string | undefined;

  // 1. alias の item を id 固定取得。0 件（非アクティブ等）なら ILIKE にフォールバック（gen-1 同様）。
  let items = aliasItemId ? await fetchItems(supabase, { id: aliasItemId }) : [];
  if (items.length === 0) {
    items = await fetchItems(supabase, { ilike: trimmed });
  }

  // 2. 候補ごとの units を並列解決（N+1 の直列待ちを避ける）。
  return Promise.all(
    items.map(async (it) => ({
      itemId: it.id,
      name: it.name,
      trackingType: (it.tracking_type as "individual" | "quantity") ?? "individual",
      units: await resolveUnits(supabase, it.id),
    })),
  );
}

/**
 * 工具 db Adapter を生成する。ctx.movedBy = 入力者（D-7）。
 * host（M-E の Server Action）が現在ユーザーで生成して Core に注入する。
 */
export function createToolsAdapter(ctx: { movedBy: string }): CaaFAdapter {
  return {
    id: "tools-db",

    async getSchema(target: string): Promise<CaaFField[]> {
      // tracking_type を target に渡すと条件付き必須 overlay を適用した schema を返す（M-D）。
      // それ以外（"checkout"/"" 等、tracking 未確定）はベースの全 optional schema。
      if (target === "individual" || target === "quantity") {
        return toolsAppForTracking(target).schema;
      }
      return TOOLS_FIELDS;
    },

    async read(_app: CaaFApp, query?: Record<string, unknown>): Promise<unknown[]> {
      const kind = query?.kind;
      const name = typeof query?.name === "string" ? query.name : "";
      const supabase = await createServerSupabaseClient();
      if (kind === "resolve-item") {
        return resolveItem(supabase, name);
      }
      // 他種別（resolve-site / resolve-holder）は M-E で必要時に拡張。
      return [];
    },

    async write(_app: CaaFApp, record: CaaFRecord): Promise<CaaFWriteResult> {
      const input = recordToMovementInput(record, { movedBy: ctx.movedBy });
      if (!input.itemId) return { success: false, error: "item_id が未解決です" };

      const { rows, errors } = buildMovementRows(input);
      if (rows.length === 0) {
        return { success: false, error: errors.join("; ") || "登録対象がありません" };
      }

      const supabase = await createServerSupabaseClient();
      let firstId: string | number | undefined;
      const writeErrors = [...errors];
      for (const row of rows) {
        try {
          const inserted = await insertMovement(supabase, row);
          if (firstId === undefined) firstId = inserted.id as string | number;
        } catch (e) {
          writeErrors.push(e instanceof Error ? e.message : "INSERT 失敗");
        }
      }

      if (firstId === undefined) {
        return { success: false, error: writeErrors.join("; ") };
      }
      // 一部成功（append-only のため挿入済みは事実として残る）。エラーがあれば error に併記。
      return {
        success: true,
        id: firstId,
        error: writeErrors.length ? writeErrors.join("; ") : undefined,
      };
    },
  };
}
