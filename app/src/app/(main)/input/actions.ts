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

/**
 * マスタ照合済みアイテム — 信号色カードに表示する。
 * LLM 抽出名 → DB 正式名称、番号存在チェック結果を保持。
 */
export type ResolvedItem = {
  extractedName: string;
  matchedName: string | null;
  matchedItemId: string | null;
  trackingType: "individual" | "quantity";
  unitResolutions: Array<{
    unitNumber: number;
    unitId: string | null;
    exists: boolean;
  }>;
  availableUnits: number[];
  /** 番号選択 UI 用: unitNumber → unitId マッピング */
  availableUnitDetails: Array<{ unitNumber: number; unitId: string }>;
  quantity: number | null;
  confidence: number;
  status: "matched" | "not_found" | "unit_missing" | "no_unit_specified";
};

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

/**
 * Gemini が snake_case で返す場合に camelCase へ正規化。
 * Zod スキーマは camelCase を期待するため。
 */
function normalizeExtraction(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const obj = raw as Record<string, unknown>;

  // items 配列の各要素を正規化
  const rawItems = (obj.items as unknown[]) ?? [];
  const items = rawItems.map((item) => {
    if (!item || typeof item !== "object") return item;
    const i = item as Record<string, unknown>;
    // unitNumbers: Gemini が文字列配列で返す場合があるため数値変換
    const rawNums = (i.unitNumbers ?? i.unit_numbers ?? []) as unknown[];
    const unitNumbers = rawNums
      .map((n) => (typeof n === "string" ? Number.parseInt(n, 10) : n))
      .filter((n): n is number => typeof n === "number" && !Number.isNaN(n));
    return {
      name: i.name,
      trackingType: i.trackingType ?? i.tracking_type ?? "individual",
      unitNumbers,
      quantity: i.quantity ?? null,
      confidence: typeof i.confidence === "number" ? i.confidence : 0,
    };
  });

  return {
    site: obj.site ?? null,
    action: obj.action ?? "checkout",
    items,
    holderNote: obj.holderNote ?? obj.holder_note ?? null,
    ambiguities: obj.ambiguities ?? [],
  };
}

/**
 * LLM 抽出結果をマスタ DB と照合し、正式名称・番号存在を解決する。
 * 確認カード表示前に呼ぶことで、人間の入力ミスを確定前に補完・警告。
 */
async function resolveAgainstMaster(
  extraction: CaaFExtractionResult,
): Promise<ResolvedItem[]> {
  const supabase = await createServerSupabaseClient();
  const resolved: ResolvedItem[] = [];

  for (const item of extraction.items) {
    // 1. 工具名 → items ILIKE 部分一致
    const { data: matchedItems } = await supabase
      .from("items")
      .select("id, name, tracking_type")
      .ilike("name", `%${item.name}%`)
      .eq("is_active", true)
      .limit(5);

    const matched = matchedItems?.[0];

    if (!matched) {
      resolved.push({
        extractedName: item.name,
        matchedName: null,
        matchedItemId: null,
        trackingType: item.trackingType,
        unitResolutions: item.unitNumbers.map((n) => ({
          unitNumber: n,
          unitId: null,
          exists: false,
        })),
        availableUnits: [],
        availableUnitDetails: [],
        quantity: item.quantity,
        confidence: item.confidence,
        status: "not_found",
      });
      continue;
    }

    // 2. 該当工具の全個体番号を取得（候補表示用）
    const { data: allUnits } = await supabase
      .from("individual_units")
      .select("id, unit_number")
      .eq("item_id", matched.id)
      .eq("is_active", true)
      .order("unit_number", { ascending: true });

    const availableUnits = (allUnits ?? []).map((u) => u.unit_number as number);
    const availableUnitDetails = (allUnits ?? []).map((u) => ({
      unitNumber: u.unit_number as number,
      unitId: u.id as string,
    }));
    const unitMap = new Map(
      availableUnitDetails.map((u) => [u.unitNumber, u.unitId]),
    );

    // 3. 指定番号の存在チェック
    const unitResolutions = item.unitNumbers.map((num) => ({
      unitNumber: num,
      unitId: unitMap.get(num) ?? null,
      exists: unitMap.has(num),
    }));

    const hasUnitMissing = unitResolutions.some((r) => !r.exists);
    const isIndividualNoUnit =
      (matched.tracking_type === "individual" || item.trackingType === "individual") &&
      item.unitNumbers.length === 0;

    resolved.push({
      extractedName: item.name,
      matchedName: matched.name as string,
      matchedItemId: matched.id as string,
      trackingType: (matched.tracking_type as "individual" | "quantity") ?? item.trackingType,
      unitResolutions,
      availableUnits,
      availableUnitDetails,
      quantity: item.quantity,
      confidence: item.confidence,
      status: hasUnitMissing
        ? "unit_missing"
        : isIndividualNoUnit
          ? "no_unit_specified"
          : "matched",
    });
  }

  return resolved;
}

/**
 * マスタ照合結果を加味した信号色判定。
 * - not_found / unit_missing → orange
 * - no_unit_specified → yellow
 * - 全 matched → 元の confidence ベース判定
 */
function determineSignalWithResolution(
  extraction: CaaFExtractionResult,
  resolved: ResolvedItem[],
): Signal {
  const baseSignal = determineSignal(extraction);

  if (resolved.length === 0) return baseSignal;
  if (resolved.some((r) => r.status === "not_found")) return "orange";
  if (resolved.some((r) => r.status === "unit_missing")) return "orange";
  if (resolved.some((r) => r.status === "no_unit_specified")) return "yellow";

  return baseSignal;
}

export async function extractAction(
  naturalText: string,
): Promise<{ extraction: CaaFExtractionResult; signal: Signal; resolved: ResolvedItem[] }> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey === "ここにキーを貼る") {
    // フォールバック: デモ解析（マスタ照合なし）
    const { extractFromNaturalText } = await import("@/lib/llm/router");
    const demo = await extractFromNaturalText(naturalText);
    return { ...demo, resolved: [] };
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

  // JSON パース + snake_case → camelCase 正規化 + Zod バリデーション
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    console.error("Gemini JSON parse error:", text);
    throw new Error("LLM の応答を JSON として解析できませんでした");
  }

  // Gemini が snake_case / 文字列型で返す場合の正規化
  const normalized = normalizeExtraction(parsed);
  const result = CaaFExtractionResultSchema.safeParse(normalized);

  if (!result.success) {
    console.error("Zod validation error:", result.error.issues);
    throw new Error("LLM の応答が期待されるスキーマと一致しませんでした");
  }

  const extraction = result.data;

  // マスタ照合: 正式名称 + 番号存在を事前解決
  const resolved = await resolveAgainstMaster(extraction);
  const signal = determineSignalWithResolution(extraction, resolved);

  return { extraction, signal, resolved };
}

/**
 * 解決済みアイテムで movement INSERT（持出確定）
 *
 * resolveAgainstMaster で事前解決した item_id / unit_id を使い、
 * 重複 DB クエリなしで直接 INSERT する。
 *
 * holder_id = 保持者、moved_by = 入力者 (D-7)
 */
export async function confirmCheckoutAction(
  extraction: CaaFExtractionResult,
  resolved: ResolvedItem[],
  movedBy: string,
  holderId: string | null,
): Promise<{ insertedCount: number; errors: string[] }> {
  const supabase = await createServerSupabaseClient();
  const errors: string[] = [];
  let insertedCount = 0;

  for (const item of resolved) {
    if (!item.matchedItemId) {
      errors.push(`「${item.extractedName}」に一致する工具が見つかりませんでした`);
      continue;
    }

    if (item.unitResolutions.length > 0) {
      for (const unit of item.unitResolutions) {
        if (!unit.exists || !unit.unitId) {
          errors.push(
            `「${item.matchedName}」の ${unit.unitNumber}番 は存在しません（${item.availableUnits.join(",")}番が利用可能）`,
          );
          continue;
        }

        const { error } = await supabase.from("item_movements").insert({
          item_id: item.matchedItemId,
          unit_id: unit.unitId,
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
          errors.push(`${item.matchedName} #${unit.unitNumber}: ${error.message}`);
        } else {
          insertedCount++;
        }
      }
    } else if (item.trackingType === "individual") {
      errors.push(
        `「${item.matchedName}」は個体管理です。番号を指定してください（${item.availableUnits.join(",")}番が利用可能）`,
      );
    } else {
      const { error } = await supabase.from("item_movements").insert({
        item_id: item.matchedItemId,
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
        errors.push(`${item.matchedName}: ${error.message}`);
      } else {
        insertedCount++;
      }
    }
  }

  return { insertedCount, errors };
}

/**
 * ストローク内対話修正 — LLM に修正指示を解釈させ、抽出結果を更新する。
 *
 * 元の入力・現在の抽出結果・修正指示を LLM に渡し、
 * 更新された抽出結果を受け取って再度マスタ照合する。
 *
 * D-5: 元の入力にない工具を創作しない。
 */

const CLARIFICATION_PROMPT = `あなたは工具管理システムの修正指示解釈器です。
元の入力と現在の抽出結果を踏まえ、ユーザーの修正指示に従って抽出結果を更新してください。

### 必ず守るルール
- JSON のみ出力。前置き・解説・markdown は禁止
- 修正対象のアイテムのみ変更し、それ以外は元のまま維持する
- 元の入力にない工具を新たに創作しない
- 「やめる」「キャンセル」= items を空配列にする
- 「◯◯はスキップ」= items から該当工具を除外する
- 番号変更（「3番は1番に変更」）= 該当アイテムの unitNumbers を修正
- 現場変更（「現場は星ヶ丘」）= site を修正
- アイテム追加（「バッテリーは4番も追加」）= 既存工具の番号追加のみ許可

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
  "ambiguities": ["曖昧な点"],
  "summary": "変更内容の1行要約（日本語）"
}`;

export async function clarifyAction(
  originalText: string,
  currentExtraction: CaaFExtractionResult,
  clarificationText: string,
): Promise<{
  extraction: CaaFExtractionResult;
  signal: Signal;
  resolved: ResolvedItem[];
  summary: string;
}> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "ここにキーを貼る") {
    throw new Error("修正機能には Gemini API キーが必要です");
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
            { text: CLARIFICATION_PROMPT },
            { text: `\n\n### 元の入力\n${originalText}` },
            {
              text: `\n\n### 現在の抽出結果\n${JSON.stringify(currentExtraction)}`,
            },
            { text: `\n\n### ユーザーの修正指示\n${clarificationText}` },
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
    console.error("Gemini clarification error:", res.status, err);
    throw new Error(`LLM API エラー (${res.status})`);
  }

  const data = await res.json();
  const text: string | undefined =
    data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error("LLM から有効な応答がありませんでした");
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text) as Record<string, unknown>;
  } catch {
    console.error("Gemini clarification JSON parse error:", text);
    throw new Error("LLM の応答を JSON として解析できませんでした");
  }

  // summary を抽出してから正規化
  const summary =
    typeof parsed.summary === "string" ? parsed.summary : "修正を反映しました";

  const normalized = normalizeExtraction(parsed);
  const validationResult = CaaFExtractionResultSchema.safeParse(normalized);

  if (!validationResult.success) {
    console.error(
      "Zod validation error (clarify):",
      validationResult.error.issues,
    );
    throw new Error("LLM の応答が期待されるスキーマと一致しませんでした");
  }

  const extraction = validationResult.data;
  const resolved = await resolveAgainstMaster(extraction);
  const signal = determineSignalWithResolution(extraction, resolved);

  return { extraction, signal, resolved, summary };
}
