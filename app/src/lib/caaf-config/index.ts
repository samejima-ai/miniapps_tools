/**
 * CaaF gen-2 Config — 工具ミニアプリの結線（Config 側、固有名詞 OK）
 *
 * Core（@caaf/core）が必要とする注入実装を提供する。
 * M-B: Extractor（L1）/ IntentClassifier（L0.3）。
 * M-C: db Adapter（getSchema/write/read）— 別途追加。
 * M-D: tools CaaFApp 定義 — 別途追加。
 *
 * 注意: 本 index は factories.ts（server-only チェーン）を再エクスポートする。
 * クライアントからは import しない。純関数のテストは extractor.ts / intent.ts を直接 import する。
 */

// 純関数（プロンプト生成・応答パース）
export { buildExtractionPrompt, parseExtraction } from "./extractor";
export { buildIntentPrompt, parseIntentResponse } from "./intent";

// server 結線ファクトリ（host の Server Action から使う）
export { createExtractor, createIntentClassifier } from "./factories";
export { isLLMConfigured } from "./llm";
