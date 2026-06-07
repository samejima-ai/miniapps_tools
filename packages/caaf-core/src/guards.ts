/**
 * CaaF Core — Guards (FW spec §10.1, FW-level ハード制約 / コード強制)
 *
 * App-level の dont（§10.2）は LLM 注入のソフト制約。
 * 本ファイルは FW-level の不変条件をコードで強制する（grep 検証対象の純関数群）。
 *
 *  Don't #1: スキーマ外フィールドを生成しない（Mapper が破棄）
 *  Don't #2: 必須未充足で write() を呼ばない
 *  Don't #3: ユーザー確認なしに書き込まない
 *  Don't #4: 低確信度の推論値を確定扱いしない
 */

import type { CaaFApp, CaaFFieldValue, CaaFRecord } from "./types.js";
import { validateRecord } from "./validate.js";

/** Don't #1: schema に無いフィールドを破棄して返す（純関数）。 */
export function dropForeignFields(
  app: CaaFApp,
  fields: Record<string, CaaFFieldValue>,
): Record<string, CaaFFieldValue> {
  const allowed = new Set(app.schema.map((f) => f.name));
  const clean: Record<string, CaaFFieldValue> = {};
  for (const [name, fv] of Object.entries(fields)) {
    if (allowed.has(name)) clean[name] = fv;
  }
  return clean;
}

/** record 内のスキーマ外フィールドを破棄した record を返す（Don't #1）。 */
export function sanitizeRecord(app: CaaFApp, record: CaaFRecord): CaaFRecord {
  return { ...record, fields: dropForeignFields(app, record.fields) };
}

/** confidence を 0.0–1.0 にクランプする防御（Don't #4 の前段）。 */
export function clampConfidence(c: number): number {
  if (Number.isNaN(c)) return 0;
  return Math.max(0, Math.min(1, c));
}

export type ExecuteBlockReason =
  | "missing_required" // Don't #2
  | "type_error" // Don't #2（型不整合）
  | "not_confirmed" // Don't #3
  | "foreign_fields"; // Don't #1（破棄前に検出された場合）

export interface ExecuteGuardResult {
  allowed: boolean;
  reasons: ExecuteBlockReason[];
  /** 補足（missing field 名など） */
  details: string[];
}

/**
 * write() を呼んでよいかを判定する（FW Don't #1〜#3 のコード強制）。
 * - status は "confirmed"（= ユーザー確認済み）でなければ not_confirmed。
 * - 必須未充足・型エラーは missing_required / type_error。
 * - schema 外フィールドが残っていれば foreign_fields（sanitizeRecord 漏れの検出）。
 */
export function canExecute(app: CaaFApp, record: CaaFRecord): ExecuteGuardResult {
  const reasons: ExecuteBlockReason[] = [];
  const details: string[] = [];

  // Don't #3: ユーザー確認なしに書き込まない
  if (record.status !== "confirmed") {
    reasons.push("not_confirmed");
    details.push(`status=${record.status} (expected "confirmed")`);
  }

  // Don't #1: schema 外フィールドが残っていないか
  const allowed = new Set(app.schema.map((f) => f.name));
  const foreign = Object.keys(record.fields).filter((n) => !allowed.has(n));
  if (foreign.length > 0) {
    reasons.push("foreign_fields");
    details.push(`foreign fields: ${foreign.join(", ")}`);
  }

  // Don't #2: 必須未充足・型エラー
  const v = validateRecord(app, record);
  if (v.missingRequired.length > 0) {
    reasons.push("missing_required");
    details.push(`missing: ${v.missingRequired.join(", ")}`);
  }
  if (v.typeErrors.length > 0) {
    reasons.push("type_error");
    details.push(...v.typeErrors.map((e) => e.message));
  }

  return { allowed: reasons.length === 0, reasons, details };
}
