/**
 * L0-3 API 契約（簡易モード）— 関数シグネチャのみ
 *
 * MVPは外部公開API なし。Next.js Server Actions + Supabase Client 経由の内部APIのみ。
 * Phase 2 で外部公開APIが必要になったら完全モード（TypeSpec, api.tsp）へ昇格。
 *
 * 各関数は src/lib/ 配下の実装で具体化される。本ファイルはシグネチャの SSOT。
 */

import type {
  Item,
  IndividualUnit,
  Location,
  ItemMovement,
  CurrentlyOut,
  UnitCurrentStatus,
  CaaFExtractionResult,
  Employee,
  MovementType,
} from "./domain";

// ============================================================================
// LLM Router (src/lib/llm/router.ts)
// ============================================================================

export type LlmProvider = "gemini-flash-lite" | "claude-api";

export interface LlmRouterOptions {
  provider?: LlmProvider;       // 未指定時は env から決定
  timeoutMs?: number;            // デフォルト 5000 (UX Must 閾値 p95 5秒)
}

/**
 * 自然文を構造化された CaaF 抽出結果に変換する。
 * LLM は抽出器であり、欠損情報を創作しない（D-5）。
 *
 * @throws CaaFExtractionError - パース失敗、タイムアウト、API エラー
 */
export type ExtractFromNaturalText = (
  naturalText: string,
  opts?: LlmRouterOptions,
) => Promise<CaaFExtractionResult>;

// ============================================================================
// Master CRUD (src/lib/master/)
// ============================================================================

export type ListItems = (opts?: {
  isActive?: boolean;
  category?: Item["category"];
}) => Promise<Item[]>;

export type CreateItem = (input: Omit<Item, "id" | "createdAt" | "updatedAt">) => Promise<Item>;

export type UpdateItem = (
  id: string,
  patch: Partial<Pick<Item, "name" | "category" | "isActive" | "notes" | "itemCode">>,
) => Promise<Item>;

export type ListUnits = (itemId: string, opts?: { isActive?: boolean }) => Promise<IndividualUnit[]>;

export type CreateUnit = (input: Omit<IndividualUnit, "id" | "createdAt">) => Promise<IndividualUnit>;

export type ListLocations = (opts?: { kind?: Location["kind"]; isActive?: boolean }) => Promise<Location[]>;

export type CreateLocation = (input: Omit<Location, "id" | "createdAt">) => Promise<Location>;

// ============================================================================
// Movement (append-only INSERT)
// ============================================================================

/**
 * ItemMovement の INSERT。append-only。UPDATE / DELETE は提供しない（D-1）。
 *
 * - movementType が "checkout": from=倉庫, to=現場, holder=入力者 or 代理者
 * - movementType が "return":   from=現場, to=倉庫, holder=null
 *
 * 個体/数量の排他は Zod 側 + DB CHECK 制約の両方で担保。
 */
export type InsertMovement = (
  input: Omit<ItemMovement, "id" | "createdAt">,
) => Promise<ItemMovement>;

/**
 * 一括 INSERT（クイック返却用）。
 * トランザクション単位で全件 INSERT or 全件失敗。
 */
export type InsertMovementsBatch = (
  inputs: ReadonlyArray<Omit<ItemMovement, "id" | "createdAt">>,
) => Promise<ItemMovement[]>;

// ============================================================================
// View Read (状態導出の唯一の経路)
// ============================================================================

/**
 * 現在持出中の個体一覧を取得（v_currently_out）。
 * 自分軸フィルタ用に holderId を受け取る。
 *
 * - holderId 指定なし = 全員
 * - projectId 指定で現場フィルタ
 * - query 指定でフリー検索（item_name / unit_number / project_id の OR）
 */
export type ListCurrentlyOut = (filter?: {
  holderId?: string;
  projectId?: string;
  query?: string;
}) => Promise<CurrentlyOut[]>;

export type GetUnitCurrentStatus = (unitId: string) => Promise<UnitCurrentStatus | null>;

// ============================================================================
// Identity / Session
// ============================================================================

export type ListEmployees = () => Promise<Employee[]>;

export type GetCurrentUser = () => Promise<Employee | null>;

export type SelectEmployee = (employeeId: string) => Promise<Employee>;

// ============================================================================
// Errors
// ============================================================================

export class CaaFExtractionError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
    public readonly rawResponse?: string,
  ) {
    super(message);
    this.name = "CaaFExtractionError";
  }
}

export class MovementConstraintError extends Error {
  constructor(message: string, public readonly input: unknown) {
    super(message);
    this.name = "MovementConstraintError";
  }
}
