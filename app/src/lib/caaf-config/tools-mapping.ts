/**
 * CaaF gen-2 Config — 工具 CaaFRecord → item_movements 写像（M-C、純関数）
 *
 * 確定済み CaaFRecord を append-only な item_movements 行へ変換する。
 * FW Don't をコードで担保し、tools-mapping.test.ts で固定する:
 *  - 罠A: 状態カラムを書かない。movement INSERT のみ（状態は View 導出）
 *  - D-1: append-only。常に INSERT、movement_type=action。UPDATE/DELETE しない
 *  - D-7: holder_id（保持者）と moved_by（入力者）を別に保持
 *  - D-11: checkout で持出中（currentHolderId あり）の unit は二重持出として拒否
 *  - D-3: confidence は log 列にのみ載せ、状態/採否判定に使わない
 *
 * 本ファイルは純関数（DB に触れない）。Supabase 結線は tools-adapter.ts。
 */

import type { CaaFRecord } from "@caaf/core";
import { TOOLS_FIELD } from "./tools-fields";

export type ToolsAction = "checkout" | "return";

/** read() で解決済みの個体（番号・unitId・現在の保持者）。 */
export interface ResolvedUnit {
  unitNumber: number;
  unitId: string | null;
  /** non-null なら現在誰かが持出中（D-11 の二重持出判定に使う）。 */
  currentHolderId: string | null;
  currentHolderName?: string | null;
}

/** 解決済みの「書き込み準備が整った」工具入力。 */
export interface ToolsMovementInput {
  action: ToolsAction;
  itemId: string;
  itemName?: string;
  /** 個体管理: 解決済み個体配列。数量管理では空。 */
  units: ResolvedUnit[];
  /** 数量管理: 数量。個体管理では null。 */
  quantity: number | null;
  projectId: string | null;
  /** 保持者（代理）。null なら checkout 時は movedBy にフォール（D-7 は維持）。 */
  holderId: string | null;
  /** 入力者（必須）。holder_id とは別カラム（D-7）。 */
  movedBy: string;
  confidence: number | null;
  /** notes 用の現場表示名等（任意）。 */
  siteNote?: string | null;
}

/** insertMovement の入力に一致する 1 行（append-only INSERT のペイロード）。 */
export interface MovementRow {
  itemId: string;
  unitId: string | null;
  quantity: number | null;
  movementType: ToolsAction;
  projectId: string | null;
  holderId: string | null;
  movedBy: string;
  source: string;
  confidence: number | null;
  notes: string | null;
}

export interface BuildResult {
  rows: MovementRow[];
  errors: string[];
}

/**
 * 解決済み入力 → INSERT 行（純関数）。FW Don't を全てここで担保する。
 */
export function buildMovementRows(input: ToolsMovementInput): BuildResult {
  const rows: MovementRow[] = [];
  const errors: string[] = [];
  const label = input.itemName ?? input.itemId;
  const notes = input.siteNote ? `現場: ${input.siteNote}` : null;

  // D-7: checkout の holder は holderId ?? movedBy。return は holder=null（保持者から離れる）。
  const holderId = input.action === "checkout" ? (input.holderId ?? input.movedBy) : null;

  if (input.units.length > 0) {
    // 個体管理: 1 個体 = 1 行
    for (const u of input.units) {
      if (!u.unitId) {
        errors.push(`「${label}」の ${u.unitNumber}番 は存在しません`);
        continue;
      }
      // D-11: 持出中 unit への二重持出を拒否（checkout のみ）
      if (input.action === "checkout" && u.currentHolderId) {
        const who = u.currentHolderName ?? "他の人";
        errors.push(`「${label}」の #${u.unitNumber} は ${who} が持出中です（二重持出は不可）`);
        continue;
      }
      rows.push({
        itemId: input.itemId,
        unitId: u.unitId,
        quantity: null,
        movementType: input.action, // D-1: 常に INSERT、type=action
        projectId: input.projectId,
        holderId,
        movedBy: input.movedBy, // D-7: 入力者は別
        source: "caaf",
        confidence: input.confidence, // D-3: log のみ
        notes,
      });
    }
    return { rows, errors };
  }

  if (input.quantity !== null && input.quantity > 0) {
    // 数量管理: 1 行
    rows.push({
      itemId: input.itemId,
      unitId: null,
      quantity: input.quantity,
      movementType: input.action,
      projectId: input.projectId,
      holderId,
      movedBy: input.movedBy,
      source: "caaf",
      confidence: input.confidence,
      notes,
    });
    return { rows, errors };
  }

  errors.push(`「${label}」は個体番号または数量の指定が必要です`);
  return { rows, errors };
}

/** field 値を安全に取り出す補助。 */
function fieldValue(record: CaaFRecord, name: string): unknown {
  return record.fields[name]?.value;
}

/**
 * 確定済み CaaFRecord（参照は解決済み）+ ctx → ToolsMovementInput（純関数）。
 *
 * 期待する解決済み field 値:
 *  - action: "checkout" | "return"
 *  - item:   itemId 文字列
 *  - units:  ResolvedUnit[]（read() で番号→unitId・持出状態に解決済み）
 *  - quantity: number | null
 *  - site:   projectId 文字列 | null
 *  - holder: holderId 文字列 | null
 */
export function recordToMovementInput(
  record: CaaFRecord,
  ctx: { movedBy: string; itemName?: string; siteNote?: string | null },
): ToolsMovementInput {
  const action = fieldValue(record, TOOLS_FIELD.action) === "return" ? "return" : "checkout";
  const itemId = String(fieldValue(record, TOOLS_FIELD.item) ?? "");
  const rawUnits = fieldValue(record, TOOLS_FIELD.units);
  const units: ResolvedUnit[] = Array.isArray(rawUnits)
    ? (rawUnits as ResolvedUnit[]).filter((u) => u && typeof u.unitNumber === "number")
    : [];
  const quantityRaw = fieldValue(record, TOOLS_FIELD.quantity);
  const quantity = typeof quantityRaw === "number" ? quantityRaw : null;
  const siteRaw = fieldValue(record, TOOLS_FIELD.site);
  const projectId = typeof siteRaw === "string" && siteRaw !== "" ? siteRaw : null;
  const holderRaw = fieldValue(record, TOOLS_FIELD.holder);
  const holderId = typeof holderRaw === "string" && holderRaw !== "" ? holderRaw : null;

  // D-3: confidence は item field の確信度を log 用に拾うのみ（採否判定に使わない）。
  const confidence = record.fields[TOOLS_FIELD.item]?.confidence ?? null;

  return {
    action,
    itemId,
    itemName: ctx.itemName,
    units,
    quantity,
    projectId,
    holderId,
    movedBy: ctx.movedBy,
    confidence,
    siteNote: ctx.siteNote ?? null,
  };
}
