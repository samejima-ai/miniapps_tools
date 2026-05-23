/**
 * CaaF Alias Auto-Learning — Generic UPSERT pattern.
 *
 * D-4 compliant: call only after human confirmation.
 *
 * Expected table schema:
 *   id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
 *   alias       TEXT NOT NULL (normalized to lowercase)
 *   <fkColumn>  UUID NOT NULL REFERENCES ...
 *   canonical_name TEXT NOT NULL
 *   use_count   INTEGER DEFAULT 1
 *   last_used_at TIMESTAMPTZ DEFAULT now()
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type AliasTableConfig = {
  table: string;
  foreignKeyColumn: string;
};

/**
 * Learn alias mapping after human confirmation.
 * - Same mapping exists → increment use_count
 * - Different mapping exists → overwrite with latest human judgment
 * - No mapping → insert new
 */
export async function learnAlias(
  // biome-ignore lint/suspicious/noExplicitAny: Supabase generic DB type varies by project
  supabase: SupabaseClient<any, any, any>,
  config: AliasTableConfig,
  alias: string,
  targetId: string,
  canonicalName: string,
): Promise<void> {
  const normalized = alias.toLowerCase();

  const { data: existing } = await supabase
    .from(config.table)
    .select("*")
    .eq("alias", normalized)
    .maybeSingle();

  if (existing) {
    const existingFk = (existing as Record<string, unknown>)[config.foreignKeyColumn];
    if (existingFk === targetId) {
      await supabase
        .from(config.table)
        .update({
          use_count: (existing.use_count as number) + 1,
          last_used_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
    } else {
      await supabase
        .from(config.table)
        .update({
          [config.foreignKeyColumn]: targetId,
          canonical_name: canonicalName,
          use_count: 1,
          last_used_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
    }
  } else {
    await supabase.from(config.table).insert({
      alias: normalized,
      [config.foreignKeyColumn]: targetId,
      canonical_name: canonicalName,
    });
  }
}
