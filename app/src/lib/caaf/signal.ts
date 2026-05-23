/**
 * CaaF Signal — Confidence-based signal color determination.
 *
 * Phase 0: display only, not used for auto-INSERT (D-3/D-4).
 * Domains can extend with additional rules
 * (e.g., tool management adds "return action → red").
 */

import type { Signal } from "./types";

type SignalInput = {
  items: ReadonlyArray<{ confidence: number }>;
  ambiguities: ReadonlyArray<unknown>;
};

export function determineSignal(input: SignalInput): Signal {
  if (input.items.length === 0) return "red";

  const minConfidence = Math.min(...input.items.map((i) => i.confidence));

  if (minConfidence >= 0.8 && input.ambiguities.length === 0) return "green";
  if (minConfidence >= 0.6) return "yellow";
  return "orange";
}
