/**
 * CaaF gen-2 Config — 純関数エントリポイント（client/test 安全）
 *
 * 本 index は **server-only に依存しない純関数のみ** を再エクスポートする。
 * factories（createExtractor / createIntentClassifier）や llm（isLLMConfigured）は
 * `server-only` チェーンを含むため `./server` から import すること。
 * これにより、純関数だけ使いたいクライアント/テストが誤って server-only を引き込まない。
 *
 * - 純関数（プロンプト生成・応答パース） → `@/lib/caaf-config`
 * - server 結線ファクトリ → `@/lib/caaf-config/server`（host の Server Action から）
 */

export { buildExtractionPrompt, parseExtraction } from "./extractor";
export { buildIntentPrompt, parseIntentResponse } from "./intent";

// 工具ドメイン: フィールド契約 + 純粋な write 写像（M-C）
export { TOOLS_FIELD, TOOLS_FIELDS } from "./tools-fields";
export {
  buildMovementRows,
  recordToMovementInput,
  type ToolsAction,
  type ToolsMovementInput,
  type ResolvedUnit,
  type MovementRow,
} from "./tools-mapping";
