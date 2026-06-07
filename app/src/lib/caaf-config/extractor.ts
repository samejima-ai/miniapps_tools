/**
 * CaaF gen-2 Config — Extractor（L1 抽出、FW spec §7.1）
 *
 * Core の `Extractor` インターフェース実装を生成する。任意の CaaFApp に対して汎用に動く
 * （特定ドメインに依存しない）。schema をプロンプトに展開し、スキーマ準拠の JSON 抽出を LLM にさせる。
 *
 * 抽出規約（FW spec §7.1 / 設計原則 2）:
 *  - 書かれていない項目は null（= 結果から省く）。創作禁止。
 *  - enum は options に正規化、該当なしは省く。
 *  - 相対日付は today を注入して LLM に実日付化させる。
 *  - フィールドごとの confidence を返す（clamp して source="ai"）。
 *  - schema 外フィールドは生成しない（Don't #1。schema を反復するので構造的に混入しない）。
 *
 * 本ファイルは純関数のみ（buildExtractionPrompt / parseExtraction）= ユニットテスト対象。
 * server-only な LLM 結線（createExtractor）は factories.ts に置き、本ファイルは import しない
 * （テストが server-only チェーンを引き込まないようにするため）。
 */

import type { CaaFApp, CaaFField, CaaFFieldValue } from "@caaf/core";
import { clampConfidence } from "@caaf/core";

/** LLM 抽出の生 JSON 形（プロンプトで強制する形）。 */
interface RawExtraction {
  fields?: Record<string, { value?: unknown; confidence?: unknown } | null>;
}

function describeField(f: CaaFField): string {
  const parts = [`- ${f.name} (${f.type}${f.required ? ", required" : ""}): ${f.label}`];
  if (f.description) parts.push(`    説明: ${f.description}`);
  if (f.type === "enum" && f.options?.length) {
    parts.push(`    選択肢（この中のいずれかに正規化。該当なしは null）: ${f.options.join(" / ")}`);
  }
  return parts.join("\n");
}

/** schema をプロンプトに展開した抽出指示文を生成する（純関数）。 */
export function buildExtractionPrompt(app: CaaFApp, today: string): string {
  const fieldLines = app.schema.map(describeField).join("\n");
  const dontLines =
    app.dont.length > 0
      ? `\n\n### 禁止事項（厳守）\n${app.dont.map((d) => `- ${d}`).join("\n")}`
      : "";

  return `あなたは「${app.context.role}」の入力解析器です。
${app.context.description}

ユーザーの自然文から、以下のフィールドの値だけを抽出してください。

### 抽出対象フィールド
${fieldLines}

### 必ず守るルール
- JSON のみ出力。前置き・解説・markdown は禁止。
- 書かれていない項目は value を null にする。情報を創作・補完しない。
- enum は選択肢のいずれかに正規化し、該当しなければ null。
- 相対日付（今日/明日/昨日等）は本日（${today}）を基準に YYYY-MM-DD の実日付へ変換する。
- 各フィールドに confidence（0.0–1.0、抽出の確信度）を付ける。
- 上記フィールド以外のキーを出力しない。${dontLines}

### 出力 JSON 形式
{
  "fields": {
${app.schema.map((f) => `    "${f.name}": { "value": <値 or null>, "confidence": 0.0-1.0 }`).join(",\n")}
  }
}`;
}

/** field の型に応じて値を正規化する。該当しなければ null（= 省く）を返す。 */
function normalizeValue(field: CaaFField, value: unknown): unknown {
  if (value === null || value === undefined || value === "") return null;
  switch (field.type) {
    case "number": {
      const n = typeof value === "number" ? value : Number(value);
      return Number.isFinite(n) ? n : null;
    }
    case "boolean":
      return typeof value === "boolean"
        ? value
        : value === "true"
          ? true
          : value === "false"
            ? false
            : null;
    case "enum":
      return typeof value === "string" && (field.options ?? []).includes(value) ? value : null;
    case "array":
      return Array.isArray(value) ? value : null;
    case "reference":
      return typeof value === "string" || typeof value === "number" ? value : null;
    default:
      // string / date / datetime
      return typeof value === "string" ? value : String(value);
  }
}

/** LLM 生 JSON を schema に照らして CaaFFieldValue マップへ変換する（純関数）。 */
export function parseExtraction(app: CaaFApp, raw: unknown): Record<string, CaaFFieldValue> {
  const fields = (raw as RawExtraction | null)?.fields ?? {};
  const result: Record<string, CaaFFieldValue> = {};

  // schema を反復するので schema 外キーは構造的に混入しない（Don't #1）。
  for (const field of app.schema) {
    const entry = (fields as Record<string, { value?: unknown; confidence?: unknown } | null>)[
      field.name
    ];
    if (!entry) continue;
    const value = normalizeValue(field, entry.value);
    if (value === null) continue; // 書かれていない / 不正 → 省く（buildRecord が無視）

    const rawConf = typeof entry.confidence === "number" ? entry.confidence : 0.5;
    result[field.name] = { value, confidence: clampConfidence(rawConf), source: "ai" };
  }

  return result;
}
