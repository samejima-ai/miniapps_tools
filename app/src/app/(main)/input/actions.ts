"use server";

/**
 * Input Server Action — Gemini Flash Lite 経由の自然文抽出
 *
 * API キーはサーバー専用 env（GEMINI_API_KEY）で管理。
 * クライアントには結果のみ返す（キー漏洩防止）。
 *
 * LLM は抽出器。欠損補完しない (D-5)。
 * confidence は信号色 UI 表示とログ用途のみ (D-3)。
 */

import { determineSignal } from "@/lib/llm/router";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { CaaFExtractionResult, Signal } from "@/types";
import { CaaFExtractionResultSchema } from "@/types";

const GEMINI_MODEL = "gemini-2.0-flash-lite";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const EXTRACTION_PROMPT = `あなたは工具管理システムの入力解析器です。
ユーザーの自然文から工具の持出・返却情報を抽出してください。

### 必ず守るルール
- JSON のみ出力する。前置き・解説・markdown は一切付けない
- 情報が欠損している場合は補完・創作しない。ambiguities に入れる
- 「全返却」「まとめて返す」等の曖昧な対象指定は action="return" として返し、items は空にする
- unit_numbers は明示的に番号が書かれている場合のみ抽出する
- confidence は抽出の確信度（0.0-1.0）

### 出力JSON形式
{
  "site": "現場名 or null",
  "action": "checkout" | "return",
  "items": [
    {
      "name": "工具名",
      "trackingType": "individual" | "quantity",
      "unitNumbers": [番号],
      "quantity": null,
      "confidence": 0.0-1.0
    }
  ],
  "holderNote": "保持者メモ or null",
  "ambiguities": ["曖昧な点"]
}`;

export async function extractAction(
  naturalText: string,
): Promise<{ extraction: CaaFExtractionResult; signal: Signal }> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey === "ここにキーを貼る") {
    // フォールバック: デモ解析
    const { extractFromNaturalText } = await import("@/lib/llm/router");
    return extractFromNaturalText(naturalText);
  }

  const url = `${GEMINI_ENDPOINT}?key=${apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: EXTRACTION_PROMPT },
            { text: `\n\n### ユーザー入力\n${naturalText}` },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("Gemini API error:", res.status, err);
    throw new Error(`LLM API エラー (${res.status})`);
  }

  const data = await res.json();

  // Gemini レスポンスからテキスト部分を抽出
  const text: string | undefined =
    data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error("LLM から有効な応答がありませんでした");
  }

  // JSON パース + Zod バリデーション
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    console.error("Gemini JSON parse error:", text);
    throw new Error("LLM の応答を JSON として解析できませんでした");
  }

  const result = CaaFExtractionResultSchema.safeParse(parsed);

  if (!result.success) {
    console.error("Zod validation error:", result.error.issues);
    throw new Error("LLM の応答が期待されるスキーマと一致しませんでした");
  }

  const extraction = result.data;
  const signal = determineSignal(extraction);

  return { extraction, signal };
}

/**
 * マスタ参照解決 + movement INSERT（持出確定）
 *
 * LLM 抽出の工具名 → items.name ILIKE → item_id
 * unit_number → individual_units.id
 * → item_movements INSERT (append-only, D-1)
 *
 * holder_id = 保持者、moved_by = 入力者 (D-7)
 */
export async function confirmCheckoutAction(
  extraction: CaaFExtractionResult,
  movedBy: string,
  holderId: string | null,
): Promise<{ insertedCount: number; errors: string[] }> {
  const supabase = await createServerSupabaseClient();
  const errors: string[] = [];
  let insertedCount = 0;

  for (const item of extraction.items) {
    // 1. 工具名 → item_id 解決（ILIKE で部分一致）
    const { data: matchedItems } = await supabase
      .from("items")
      .select("id, name")
      .ilike("name", `%${item.name}%`)
      .eq("is_active", true)
      .limit(1);

    const matchedItem = matchedItems?.[0];
    if (!matchedItem) {
      errors.push(`「${item.name}」に一致する工具が見つかりませんでした`);
      continue;
    }

    // 2. unit_number → unit_id 解決
    if (item.unitNumbers.length > 0) {
      for (const unitNum of item.unitNumbers) {
        const { data: units } = await supabase
          .from("individual_units")
          .select("id")
          .eq("item_id", matchedItem.id)
          .eq("unit_number", unitNum)
          .eq("is_active", true)
          .limit(1);

        const unit = units?.[0];
        if (!unit) {
          errors.push(`「${matchedItem.name}」の ${unitNum}番 が見つかりませんでした`);
          continue;
        }

        // 3. movement INSERT
        const { error } = await supabase.from("item_movements").insert({
          item_id: matchedItem.id,
          unit_id: unit.id,
          quantity: null,
          movement_type: extraction.action,
          from_location_id: null,
          to_location_id: null,
          project_id: null,
          holder_id: holderId ?? movedBy,
          moved_by: movedBy,
          source: "caaf",
          confidence: item.confidence,
          notes: extraction.site ? `現場: ${extraction.site}` : null,
        });

        if (error) {
          errors.push(`${matchedItem.name} #${unitNum}: ${error.message}`);
        } else {
          insertedCount++;
        }
      }
    } else if (item.trackingType === "individual") {
      // 個体管理なのに番号未指定 → 誤登録防止のため拒否
      errors.push(
        `「${matchedItem.name}」は個体管理です。番号を指定してください（例: 3番）`,
      );
    } else {
      // 数量管理（trackingType='quantity'）→ unit 不要、数量で登録
      const { error } = await supabase.from("item_movements").insert({
        item_id: matchedItem.id,
        unit_id: null,
        quantity: item.quantity ?? 1,
        movement_type: extraction.action,
        from_location_id: null,
        to_location_id: null,
        project_id: null,
        holder_id: holderId ?? movedBy,
        moved_by: movedBy,
        source: "caaf",
        confidence: item.confidence,
        notes: extraction.site ? `現場: ${extraction.site}` : null,
      });

      if (error) {
        errors.push(`${matchedItem.name}: ${error.message}`);
      } else {
        insertedCount++;
      }
    }
  }

  return { insertedCount, errors };
}
