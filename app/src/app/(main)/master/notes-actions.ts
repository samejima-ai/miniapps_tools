"use server";

/**
 * Server Actions: items の notes を LLM で生成・更新する。
 *
 * UI から呼び出される単一 / 一括 notes 生成。
 * スクリプト一括投入は別経路（scripts/generate-notes.ts）が同じ
 * lib/llm/notes-generator.ts を使う。
 */

import { generateItemNotes } from "@/lib/llm/notes-generator";
import { isGeminiConfigured } from "@/lib/caaf/llm";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type GenerateNotesResult =
  | { ok: true; itemId: string; notes: string; confidence: number }
  | { ok: false; itemId: string; error: string };

/**
 * 指定 item の notes を LLM で生成して DB を更新する。
 */
export async function generateNotesForItem(itemId: string): Promise<GenerateNotesResult> {
  if (!isGeminiConfigured()) {
    return { ok: false, itemId, error: "GEMINI_API_KEY が未設定です" };
  }

  const supabase = await createServerSupabaseClient();

  // 対象 item を取得
  const { data: item, error: fetchErr } = await supabase
    .from("items")
    .select("id, name, category, item_code, notes")
    .eq("id", itemId)
    .eq("is_active", true)
    .maybeSingle();

  if (fetchErr) {
    return { ok: false, itemId, error: `item 取得失敗: ${fetchErr.message}` };
  }
  if (!item) {
    return { ok: false, itemId, error: "item が見つかりません" };
  }

  // LLM で notes 生成
  let result: { notes: string; confidence: number };
  try {
    result = await generateItemNotes({
      name: item.name as string,
      category: item.category as "tool" | "material" | "consumable",
      itemCode: item.item_code as string | null,
      currentNotes: item.notes as string | null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, itemId, error: `LLM 生成失敗: ${msg}` };
  }

  // DB 更新
  const { error: updateErr } = await supabase
    .from("items")
    .update({ notes: result.notes })
    .eq("id", itemId);

  if (updateErr) {
    return { ok: false, itemId, error: `DB 更新失敗: ${updateErr.message}` };
  }

  return {
    ok: true,
    itemId,
    notes: result.notes,
    confidence: result.confidence,
  };
}
