/**
 * CaaF (Chat as a Form) — Client-safe Public API
 *
 * Generic framework for chat-driven data entry:
 * - Stroke state machine hook (input → extract → review → save → done)
 * - Signal color determination (confidence × ambiguities)
 *
 * Server-only modules (Gemini API / alias DB writes) are NOT re-exported here.
 * Import them directly from their submodules from server actions / server components:
 *   import { callGeminiJSON, isGeminiConfigured } from "@/lib/caaf/llm";
 *   import { learnAlias } from "@/lib/caaf/alias";
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
