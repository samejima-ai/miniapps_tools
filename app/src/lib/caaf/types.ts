/**
 * CaaF (Chat as a Form) — Generic Types
 *
 * Domain-agnostic types for the stroke dialog model.
 * Each domain (tools, materials, inspections) provides its own
 * TExtraction, TResolved, and TProject type parameters.
 */

export type Signal = "green" | "yellow" | "orange" | "red";

export type StrokePhase = "extracting" | "reviewing" | "saving" | "done" | "error";

export type StrokeResult = {
  insertedCount: number;
  skippedCount: number;
  errors: string[];
};

export type Clarification = {
  userText: string;
  systemMessage: string;
};

export type ItemStatus = "pending" | "confirmed" | "skipped" | "error";

export type StrokeItem<TResolved> = {
  resolved: TResolved;
  status: ItemStatus;
  originalExtractedName?: string;
};

export type Stroke<TExtraction, TResolved, TProject = null> = {
  id: string;
  userText: string;
  extraction: TExtraction | null;
  signal: Signal | null;
  items: StrokeItem<TResolved>[];
  phase: StrokePhase;
  result: StrokeResult | null;
  error: string | null;
  clarifications: Clarification[];
  isClarifying: boolean;
  resolvedProject: TProject | null;
};

export type ExtractResult<TExtraction, TResolved, TProject = null> = {
  extraction: TExtraction;
  signal: Signal;
  resolved: TResolved[];
  resolvedProject: TProject;
};

export type ClarifyResult<TExtraction, TResolved, TProject = null> =
  ExtractResult<TExtraction, TResolved, TProject> & { summary: string };

export type ConfirmResult = {
  insertedCount: number;
  errors: string[];
};

export type CaafConfig<TExtraction, TResolved, TProject = null> = {
  /** Server action: extract structured data from natural text */
  extractAction: (text: string) => Promise<ExtractResult<TExtraction, TResolved, TProject>>;

  /** Server action: interpret clarification and re-extract */
  clarifyAction?: (
    originalText: string,
    currentExtraction: TExtraction,
    clarificationText: string,
  ) => Promise<ClarifyResult<TExtraction, TResolved, TProject>>;

  /** Server action: persist confirmed items */
  confirmAction: (
    extraction: TExtraction,
    confirmedItems: StrokeItem<TResolved>[],
    context: { userId: string; project: TProject | null },
  ) => Promise<ConfirmResult>;

  /** Extract the originally entered name from a resolved item (for alias learning) */
  getExtractedName: (resolved: TResolved) => string;

  /** Generate a stable key for status merging across re-extractions */
  makeItemKey: (resolved: TResolved) => string;

  /** Whether the item is fully resolved and can be confirmed */
  isConfirmable: (resolved: TResolved) => boolean;

  /** Input bar placeholder text */
  placeholders?: { idle: string; reviewing: string };
};
