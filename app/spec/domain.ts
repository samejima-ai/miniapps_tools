/**
 * L0-2 ドメインモデル — Zod スキーマ + TypeScript 型定義
 *
 * SSOT 優先順位: .ts > .sql > .md
 * 本ファイルは DDL (supabase/migrations/0001_init_miniapps_tools.sql) と整合する。
 * 乖離時は DDL が正。本ファイルは DDL に合わせて手動更新する。
 *
 * 設計原則（罠A 遵守）:
 * - items / individual_units に状態カラムを定義しない
 * - 状態は ItemMovement の最新行から導出する型 (UnitCurrentStatus) を別途定義する
 * - holder_id (実際の保持者) と moved_by (入力者) は別フィールド
 */

import { z } from "zod";

// ============================================================================
// ENUM
// ============================================================================

export const TrackingType = z.enum(["individual", "quantity"]);
export type TrackingType = z.infer<typeof TrackingType>;

export const ItemCategory = z.enum(["tool", "material", "consumable"]);
export type ItemCategory = z.infer<typeof ItemCategory>;

export const MovementType = z.enum([
  "checkout",  // 倉庫→現場（持出）
  "return",    // 現場→倉庫（返却）
  "transfer",  // 現場→現場（将来）
  "inbound",   // 入庫（将来資材）
  "outbound",  // 出庫（消費・廃棄）
]);
export type MovementType = z.infer<typeof MovementType>;

export const LocationKind = z.enum(["warehouse", "site"]);
export type LocationKind = z.infer<typeof LocationKind>;

// ============================================================================
// Core Entities (Master)
// ============================================================================

export const Item = z.object({
  id: z.string().uuid(),
  itemCode: z.string().nullable(),
  name: z.string().min(1),
  category: ItemCategory.default("tool"),
  trackingType: TrackingType,
  isActive: z.boolean().default(true),
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Item = z.infer<typeof Item>;

export const IndividualUnit = z.object({
  id: z.string().uuid(),
  itemId: z.string().uuid(),
  unitNumber: z.number().int().positive(),
  isActive: z.boolean().default(true),
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
});
export type IndividualUnit = z.infer<typeof IndividualUnit>;

export const Location = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  kind: LocationKind.default("warehouse"),
  projectId: z.string().uuid().nullable(),  // 現場時、platform.projects(id) を疎結合参照
  isActive: z.boolean().default(true),
  createdAt: z.string().datetime(),
});
export type Location = z.infer<typeof Location>;

// ============================================================================
// Transaction (Event Log) — SSOT, append-only
// ============================================================================

/**
 * ItemMovement: コト = 移動イベント。SSOT。append-only。
 *
 * 個体/数量の排他制約:
 *   - individual: unitId が必須、quantity は null
 *   - quantity:   quantity が必須、unitId は null
 *
 * DBレベルでは CHECK 制約で担保される。Zod 側では refine で検証。
 */
export const ItemMovement = z.object({
  id: z.string().uuid(),
  itemId: z.string().uuid(),
  unitId: z.string().uuid().nullable(),
  quantity: z.number().int().nullable(),
  movementType: MovementType,
  fromLocationId: z.string().uuid().nullable(),
  toLocationId: z.string().uuid().nullable(),
  projectId: z.string().uuid().nullable(),  // 現場（platform.projects と疎結合）
  holderId: z.string().nullable(),          // 実際の保持者（platform.employees(id) と疎結合）
  movedBy: z.string().nullable(),           // 入力者（同上）
  movedAt: z.string().datetime(),
  source: z.string().default("caaf"),
  confidence: z.number().min(0).max(1).nullable(),  // ログ用途、状態判定には使わない (D-3)
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
}).refine(
  (m) =>
    (m.unitId !== null && m.quantity === null) ||
    (m.unitId === null && m.quantity !== null),
  { message: "individual/quantity 排他制約違反: unitId と quantity は片方のみ必須" },
);
export type ItemMovement = z.infer<typeof ItemMovement>;

// ============================================================================
// Derived Views (罠A 回避の実体)
// ============================================================================

/**
 * UnitCurrentStatus: 個体ごとの現在状態。
 * 実体テーブルではなく、Supabase View `v_unit_current_status` から取得する。
 */
export const UnitCurrentStatus = z.object({
  unitId: z.string().uuid(),
  itemId: z.string().uuid(),
  itemName: z.string(),
  unitNumber: z.number().int().positive(),
  currentStatus: z.enum(["in", "out"]),  // movement_type から導出
  currentProjectId: z.string().uuid().nullable(),
  currentHolderId: z.string().nullable(),
  lastMovedAt: z.string().datetime().nullable(),
  daysOut: z.number().int().nullable(),
});
export type UnitCurrentStatus = z.infer<typeof UnitCurrentStatus>;

/**
 * CurrentlyOut: 「いま持出中」の個体一覧。View `v_currently_out` から取得。
 * UI 一覧 / クイック返却の主データ。
 */
export const CurrentlyOut = z.object({
  unitId: z.string().uuid(),
  itemId: z.string().uuid(),
  itemName: z.string(),
  unitNumber: z.number().int().positive(),
  currentProjectId: z.string().uuid().nullable(),
  currentHolderId: z.string().nullable(),
  lastMovedAt: z.string().datetime(),
  daysOut: z.number().int(),
});
export type CurrentlyOut = z.infer<typeof CurrentlyOut>;

// ============================================================================
// CaaF (LLM Extraction Output) — LLM 抽出器の出力スキーマ
// ============================================================================

/**
 * CaaFExtractedItem: LLM が自然文から抽出した単位（1工具1項目）。
 *
 * - tracking_type が individual のとき unit_numbers[] を使う
 * - tracking_type が quantity のとき quantity を使う
 * - confidence は信号色UI 表示とログ用途のみ（D-3、状態判定には使わない）
 */
export const CaaFExtractedItem = z.object({
  name: z.string().min(1),
  trackingType: TrackingType,
  unitNumbers: z.array(z.number().int().positive()).default([]),
  quantity: z.number().int().nullable(),
  confidence: z.number().min(0).max(1).default(0),
});
export type CaaFExtractedItem = z.infer<typeof CaaFExtractedItem>;

/**
 * CaaFExtractionResult: LLM ルーター経由の構造化結果。
 *
 * - action が "return" のときは UI で「返却モードへ誘導」する（D-5、LLMで返却展開しない）
 * - holder_note が non-null のときは代理入力者候補として UI で確認
 * - ambiguities[] に書かれた事項は人間に確認させる（LLMが補完しない、D-5）
 */
export const CaaFExtractionResult = z.object({
  site: z.string().nullable(),
  action: z.enum(["checkout", "return"]),
  items: z.array(CaaFExtractedItem).default([]),
  holderNote: z.string().nullable(),
  ambiguities: z.array(z.string()).default([]),
});
export type CaaFExtractionResult = z.infer<typeof CaaFExtractionResult>;

// ============================================================================
// Signal Color (UI 表示専用、状態判定には使わない)
// ============================================================================

export const Signal = z.enum(["green", "yellow", "orange", "red"]);
export type Signal = z.infer<typeof Signal>;

// ============================================================================
// User Identity (currentUserId 抽象ID)
// ============================================================================

/**
 * Employee は本MVPでは Supabase Auth の user_id を抽象的に保持する。
 * Platform 統合時に platform.employees(id) へ参照差替えする。
 */
export const Employee = z.object({
  id: z.string(),       // Supabase Auth user_id（将来 platform.employees.id）
  name: z.string(),
});
export type Employee = z.infer<typeof Employee>;
