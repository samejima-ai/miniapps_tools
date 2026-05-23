/**
 * CaaF (Chat as a Form) — Public API
 *
 * Generic framework for chat-driven data entry with:
 * 1. Stroke state machine (input → extract → review → confirm → done)
 * 2. LLM extraction pipeline (Gemini API + Zod validation)
 * 3. 3-layer matching (alias → ILIKE → LLM similarity)
 * 4. Alias auto-learning (post-confirmation UPSERT)
 * 5. Signal color system (confidence-based UI feedback)
 */

export type {
  Signal,
  StrokePhase,
  StrokeResult,
  Clarification,
  ItemStatus,
  StrokeItem,
  Stroke,
  ExtractResult,
  ClarifyResult,
  ConfirmResult,
  CaafConfig,
} from "./types";

export { useCaaF } from "./use-caaf";
export { determineSignal } from "./signal";
export { callGemini, callGeminiJSON, isGeminiConfigured } from "./llm";
export { learnAlias, type AliasTableConfig } from "./alias";
