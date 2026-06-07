/**
 * Test fixtures — a domain-shaped CaaFApp used only by Core unit tests.
 *
 * NOTE: これはテスト専用の中立サンプル。Core src/ には固有名詞を入れない（Core純度）。
 * test/ は purity-check の対象外（scripts/purity-check.mjs は src のみ検査）。
 */

import type { CaaFApp, CaaFRecord } from "../src/types.js";

export const sampleApp: CaaFApp = {
  id: "sample",
  name: "Sample Entry",
  context: { role: "sample assistant", description: "collect a few fields" },
  schema: [
    { name: "date", type: "date", required: true, label: "Date" },
    { name: "amount", type: "number", required: true, label: "Amount" },
    {
      name: "category",
      type: "enum",
      required: true,
      label: "Category",
      options: ["a", "b", "c"],
    },
    { name: "memo", type: "string", required: false, label: "Memo" },
    { name: "channel", type: "string", required: false, label: "Channel", default: "default" },
  ],
  dont: ["do not invent values"],
  adapter: { type: "db", config: { table: "samples" } },
  routing: { keywords: ["sample", "entry"], description: "sample entry", priority: 1 },
};

export function emptyRecord(): CaaFRecord {
  return { app: "sample", fields: {}, status: "draft" };
}
