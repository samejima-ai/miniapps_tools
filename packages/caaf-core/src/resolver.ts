/**
 * CaaF Core — Resolver (FW spec §7.2, L2 ラリー)
 *
 * 不足必須フィールドを会話で 1 つずつ埋める。すべて純関数（状態 reducer）。
 *  - 1 応答 1 質問（モバイル認知負荷。FW spec §7.2）。
 *  - enum 型はインライン選択肢ボタン（UI 側が options を読む）。
 *  - 任意フィールドはスキップ可。
 *  - 全必須充足でサマリーカード + 実行ボタンを提示（呼び出し側が isComplete を見る）。
 */

import type { CaaFApp, CaaFField, CaaFFieldValue, CaaFRecord } from "./types.js";
import { validateRecord } from "./validate.js";

/** 次に尋ねるべきフィールド（schema 順で最初の未充足必須）。なければ null。 */
export function nextRequiredField(app: CaaFApp, record: CaaFRecord): CaaFField | null {
  const { missingRequired } = validateRecord(app, record);
  if (missingRequired.length === 0) return null;
  // schema 定義順を尊重して尋ねる（安定した会話順）。
  for (const field of app.schema) {
    if (missingRequired.includes(field.name)) return field;
  }
  return null;
}

/** 全必須が充足したか（型エラーも含めて execute 可能か）。 */
export function isComplete(app: CaaFApp, record: CaaFRecord): boolean {
  return validateRecord(app, record).ok;
}

/** ユーザー回答を 1 フィールドに適用する（source="user", confidence=1.0 → 確定）。 */
export function applyAnswer(record: CaaFRecord, field: string, value: unknown): CaaFRecord {
  const fv: CaaFFieldValue = { value, confidence: 1.0, source: "user" };
  return { ...record, fields: { ...record.fields, [field]: fv } };
}

/** 任意フィールドをスキップする（明示的に値なしとしてマーク）。必須はスキップ不可。 */
export function skipOptional(app: CaaFApp, record: CaaFRecord, field: string): CaaFRecord {
  const def = app.schema.find((f) => f.name === field);
  if (def?.required) return record; // 必須はスキップさせない（Guards と整合）
  const fields = { ...record.fields };
  delete fields[field];
  return { ...record, fields };
}

/**
 * default を持つ未充足フィールドに既定値を充当する（マッピング優先順位 ④。FW spec §7.1）。
 * source="default"。ユーザー/AI が入れた値は上書きしない。
 */
export function applyDefaults(app: CaaFApp, record: CaaFRecord): CaaFRecord {
  const fields = { ...record.fields };
  for (const field of app.schema) {
    if (field.default === undefined) continue;
    const cur = fields[field.name];
    const empty = !cur || cur.value === null || cur.value === undefined || cur.value === "";
    if (empty) {
      fields[field.name] = { value: field.default, confidence: 1.0, source: "default" };
    }
  }
  return { ...record, fields };
}
