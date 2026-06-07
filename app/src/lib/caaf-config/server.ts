/**
 * CaaF gen-2 Config — server エントリポイント（server-only）
 *
 * `server-only` チェーン（llm.ts 経由）を含む。host の Server Action / Server Component から
 * import して Core に注入する。クライアント/テストからは import しない
 * （純関数は `@/lib/caaf-config`（index.ts）を使う）。
 */

export { createExtractor, createIntentClassifier } from "./factories";
export { isLLMConfigured } from "./llm";
export { createToolsAdapter, type ItemCandidate } from "./tools-adapter";
