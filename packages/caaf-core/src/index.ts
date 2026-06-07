/**
 * @caaf/core — Public API
 *
 * CaaF (Chat as a Form) の汎用 Core。自然言語入力を任意の構造化データストアへの
 * 書き込みに変換する汎用入力レイヤー。
 *
 * 設計原則（不変。FW spec §2）:
 *   1. Core純度（固有名詞/分岐を持たない。ドメインは外部注入）
 *   2. 抽出のみ・生成禁止（不明は null）
 *   3. 確定はユーザー
 *   4. サーバーサイド LLM（Core は LLM SDK 非依存。分類器/抽出器はインターフェース注入）
 *   5. 不可逆操作の保護（Guards）
 *   6. 文脈完全リセット（App 切替時）
 *   7. Adapter 抽象
 *
 * 7 層パイプライン（FW spec §3）:
 *   L0 Capture → L0.3 Intent → L0.5 Route → L1 Extract → L2 Validate → L3 Execute → L4 Feedback
 */

// Data model (§4)
export type {
  Confidence,
  Signal,
  FieldSource,
  RecordStatus,
  CaaFFieldType,
  CaaFField,
  CaaFAdapterConfig,
  CaaFRouting,
  CaaFContext,
  CaaFApp,
  CaaFFieldValue,
  CaaFRecord,
} from "./types.js";

// Adapter (§8, L3)
export type { CaaFAdapter, CaaFWriteResult } from "./adapter.js";

// Intent (§6, L0.3)
export type { Intent, IntentResult, IntentContext, IntentClassifier } from "./intent.js";
export { intentNeedsExtraction, normalizeIntent } from "./intent.js";

// Router (§5, L0.5)
export type {
  RouteScore,
  RouteThresholds,
  RouteMode,
  RouteDecision,
  RouterScorer,
} from "./router.js";
export { routeByScores, keywordScores, DEFAULT_ROUTE_THRESHOLDS } from "./router.js";

// Mapper (§7.1, L1)
export type { Extractor } from "./mapper.js";
export { buildRecord } from "./mapper.js";

// Validate (§7, L2)
export type { ValidationResult, FieldTypeError } from "./validate.js";
export { validateRecord, checkFieldType } from "./validate.js";

// Resolver (§7.2, L2 rally)
export {
  nextRequiredField,
  isComplete,
  applyAnswer,
  skipOptional,
  applyDefaults,
} from "./resolver.js";

// Signal (§7.3)
export { confidenceSignal, recordSignal } from "./signal.js";

// Guards (§10.1, FW-level hard constraints)
export type { ExecuteBlockReason, ExecuteGuardResult } from "./guards.js";
export { dropForeignFields, sanitizeRecord, clampConfidence, canExecute } from "./guards.js";

// Execute (§3 L3)
export { confirmRecord, executeRecord, CaaFExecuteBlockedError } from "./execute.js";
