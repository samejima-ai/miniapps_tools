/**
 * CaaF Core — Validate (FW spec §7, L2)
 *
 * 不足検出・型チェック・制約チェック。すべて純関数（LLM 不要）。
 * 「必須未充足では write しない」（FW Don't #2）の判定根拠を提供する。
 */

import type { CaaFApp, CaaFField, CaaFFieldValue, CaaFRecord } from "./types.js";

export interface FieldTypeError {
  field: string;
  expected: CaaFField["type"];
  message: string;
}

export interface ValidationResult {
  /** 充足していない必須フィールド名 */
  missingRequired: string[];
  /** 型・制約に反したフィールド */
  typeErrors: FieldTypeError[];
  /** missingRequired・typeErrors がともに空なら true（= execute 可能） */
  ok: boolean;
}

function hasValue(fv: CaaFFieldValue | undefined): fv is CaaFFieldValue {
  return !!fv && fv.value !== null && fv.value !== undefined && fv.value !== "";
}

/** 単一フィールド値の型適合チェック（未充足は別途 missingRequired で扱うのでここでは true 寄せ）。 */
export function checkFieldType(field: CaaFField, fv: CaaFFieldValue | undefined): boolean {
  if (!hasValue(fv)) return true;
  const v = fv.value;
  switch (field.type) {
    case "string":
    case "date":
    case "datetime":
      return typeof v === "string";
    case "number":
      return typeof v === "number" && Number.isFinite(v);
    case "boolean":
      return typeof v === "boolean";
    case "enum":
      return typeof v === "string" && (field.options ?? []).includes(v);
    case "array":
      return Array.isArray(v);
    case "reference":
      // 参照は文字列 ID か数値 ID を許容
      return typeof v === "string" || typeof v === "number";
    default:
      return true;
  }
}

/** record を app.schema に照らして検証する（FW spec §7 / Don't #2）。 */
export function validateRecord(app: CaaFApp, record: CaaFRecord): ValidationResult {
  const missingRequired: string[] = [];
  const typeErrors: FieldTypeError[] = [];

  for (const field of app.schema) {
    const fv = record.fields[field.name];
    if (field.required && !hasValue(fv)) {
      missingRequired.push(field.name);
    }
    if (!checkFieldType(field, fv)) {
      typeErrors.push({
        field: field.name,
        expected: field.type,
        message: `field "${field.name}" expected ${field.type}`,
      });
    }
  }

  return {
    missingRequired,
    typeErrors,
    ok: missingRequired.length === 0 && typeErrors.length === 0,
  };
}
