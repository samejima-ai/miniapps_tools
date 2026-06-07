/**
 * CaaF gen-2 Config — Extractor / IntentClassifier ファクトリ（server 結線）
 *
 * 純関数（extractor.ts / intent.ts のプロンプト生成・パース）と llm.ts（server-only）を結線し、
 * Core の注入インターフェース `Extractor` / `IntentClassifier` を満たす実体を生成する。
 *
 * 本ファイルは server-only チェーン（llm.ts 経由）を含むため、ユニットテストからは import しない。
 * host（M-E の Server Action）から import して Core に注入する。
 */

import type {
  CaaFApp,
  CaaFFieldValue,
  Extractor,
  IntentClassifier,
  IntentContext,
  IntentResult,
} from "@caaf/core";
import { normalizeIntent } from "@caaf/core";
import { buildExtractionPrompt, parseExtraction } from "./extractor";
import { buildIntentPrompt, parseIntentResponse } from "./intent";
import { callLLMJSON } from "./llm";

/** 今日の日付（YYYY-MM-DD）。相対日付の実日付化に使う。 */
function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Core の Extractor（L1）を生成する。intent=add 時のみ Engine から呼ばれる（中量）。
 */
export function createExtractor(): Extractor {
  return async (input: string, app: CaaFApp): Promise<Record<string, CaaFFieldValue>> => {
    const prompt = buildExtractionPrompt(app, todayISO());
    const raw = await callLLMJSON([{ text: prompt }, { text: `\n\n### ユーザー入力\n${input}` }], {
      temperature: 0.1,
    });
    return parseExtraction(app, raw);
  };
}

/**
 * Core の IntentClassifier（L0.3）を生成する。App 確定中の全発話が通る（軽量・毎ターン）。
 * normalizeIntent で target 不明の correct/remove を add にフォールする（FW spec §6）。
 */
export function createIntentClassifier(): IntentClassifier {
  return async (input: string, context: IntentContext): Promise<IntentResult> => {
    const { system, user } = buildIntentPrompt(context.app, context, input);
    const raw = await callLLMJSON([{ text: system }, { text: user }], { temperature: 0 });
    return normalizeIntent(parseIntentResponse(raw), context.app);
  };
}
