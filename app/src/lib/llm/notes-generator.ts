/**
 * Item Notes Generator — LLM (Gemini) で工具マスタの notes を生成
 *
 * 用途: マスタの notes 欄を充実させて Layer C の意味的マッチを強化する。
 *
 * 入力: 工具の name / category / item_code / 既存 notes
 * 出力: 別名・型番・メーカー・用途を含む補強情報（1-2 行）
 *
 * 原則:
 * - LLM は推定器。確証のない情報は捏造しない（D-5 準拠）
 * - 既存 notes はマージ材料として渡し、上書きは呼び出し側で判断
 */

import "server-only";

import { callGeminiJSON } from "@/lib/llm/gemini";

export type ItemNotesInput = {
  name: string;
  category: "tool" | "material" | "consumable";
  itemCode?: string | null;
  currentNotes?: string | null;
};

export type ItemNotesResult = {
  notes: string;
  confidence: number;
};

const NOTES_GENERATION_PROMPT = `あなたは日本の建設現場で使われる工具・資材のマスタ整備担当です。
与えられた工具情報から、現場でよく使われる別名・略称・メーカー・型番・用途を推定し、
検索ヒット率を高めるための notes を生成してください。

### 必ず守るルール
- JSON のみ出力。前置き・解説・markdown は禁止
- 推測で確証がない情報は含めない（捏造禁止）
- 名前に含まれる型番・品番（例: BL1860B, HR165DF, F88）はそのまま記載する
- 一般的な略称・別名（例: ディスクグラインダ→サンダー、ブロワー→送風機）は積極的に列挙する
- メーカー名がわかれば記載（マキタ, HiKOKI, Panasonic, BOSCH, グラコ, シンコー 等）
- 用途・分類（切断/研磨/塗装/締結/搬送/照明 等）を簡潔に
- ブランドが不明な場合は記載しない（無理に断定しない）
- 既存 notes に有用情報があればマージして発展させる
- 出力 notes は 1〜2 行、合計 100 文字程度を目安に

### 出力JSON形式
{
  "notes": "別名: X, Y. メーカー: Z. 型番: ABC. 用途: 切断/研磨.",
  "confidence": 0.0-1.0
}`;

/**
 * 単一 item の notes を Gemini で生成する。
 * 失敗時は例外を throw する（呼び出し側でリトライ判断）。
 */
export async function generateItemNotes(input: ItemNotesInput): Promise<ItemNotesResult> {
  const context = [
    `name: ${input.name}`,
    `category: ${input.category}`,
    input.itemCode ? `item_code: ${input.itemCode}` : null,
    input.currentNotes && input.currentNotes.trim() !== ""
      ? `current_notes: ${input.currentNotes}`
      : null,
  ]
    .filter((s): s is string => s !== null)
    .join("\n");

  const parsed = await callGeminiJSON<unknown>(
    [{ text: NOTES_GENERATION_PROMPT }, { text: `\n\n### 入力\n${context}` }],
    { temperature: 0.2 },
  );

  // Gemini は responseMimeType: application/json 指定でも配列で返すことがある
  const obj = Array.isArray(parsed) ? parsed[0] : parsed;
  if (!obj || typeof obj !== "object") {
    throw new Error("notes generation: invalid response shape");
  }

  const p = obj as Record<string, unknown>;
  const notes = typeof p.notes === "string" ? p.notes.trim() : "";
  const confidenceRaw =
    typeof p.confidence === "number" && Number.isFinite(p.confidence) ? p.confidence : 0;
  const confidence = Math.max(0, Math.min(1, confidenceRaw));

  if (notes === "") {
    throw new Error("notes generation: empty notes");
  }

  return { notes, confidence };
}
