import type { CaaFApp } from "@caaf/core";
import { describe, expect, it } from "vitest";
import { buildExtractionPrompt, parseExtraction } from "./extractor";

const app: CaaFApp = {
  id: "sample",
  name: "Sample",
  context: { role: "経費登録アシスタント", description: "経費を1件ずつ登録する" },
  schema: [
    { name: "date", type: "date", required: true, label: "日付" },
    { name: "amount", type: "number", required: true, label: "金額" },
    {
      name: "account",
      type: "enum",
      required: true,
      label: "勘定科目",
      options: ["旅費交通費", "消耗品費"],
    },
    { name: "memo", type: "string", required: false, label: "摘要", description: "備考メモ" },
  ],
  dont: ["税務アドバイスはしない"],
  adapter: { type: "db", config: {} },
  routing: { keywords: ["経費"], description: "経費の登録", priority: 1 },
};

describe("buildExtractionPrompt", () => {
  const prompt = buildExtractionPrompt(app, "2026-06-07");

  it("includes role and every schema field name", () => {
    expect(prompt).toContain("経費登録アシスタント");
    for (const f of app.schema) expect(prompt).toContain(f.name);
  });

  it("lists enum options and injects today's date and dont rules", () => {
    expect(prompt).toContain("旅費交通費");
    expect(prompt).toContain("2026-06-07");
    expect(prompt).toContain("税務アドバイスはしない");
  });

  it("includes the field's description hint", () => {
    expect(prompt).toContain("備考メモ");
  });
});

describe("parseExtraction (FW §7.1)", () => {
  it("maps present fields to CaaFFieldValue with source=ai and clamped confidence", () => {
    const r = parseExtraction(app, {
      fields: {
        date: { value: "2026-06-07", confidence: 0.9 },
        amount: { value: 1200, confidence: 1.5 }, // clamp → 1
        account: { value: "旅費交通費", confidence: 0.95 },
      },
    });
    expect(r.date).toEqual({ value: "2026-06-07", confidence: 0.9, source: "ai" });
    expect(r.amount).toEqual({ value: 1200, confidence: 1, source: "ai" });
    expect(r.account?.value).toBe("旅費交通費");
  });

  it("omits absent / null-valued fields (creation forbidden)", () => {
    const r = parseExtraction(app, { fields: { amount: { value: null, confidence: 0.5 } } });
    expect(Object.keys(r)).toEqual([]);
  });

  it("omits enum values outside options (normalizes to null)", () => {
    const r = parseExtraction(app, { fields: { account: { value: "外食費", confidence: 0.9 } } });
    expect(r.account).toBeUndefined();
  });

  it("coerces stringified numbers and rejects non-numeric", () => {
    expect(parseExtraction(app, { fields: { amount: { value: "1200" } } }).amount?.value).toBe(
      1200,
    );
    expect(parseExtraction(app, { fields: { amount: { value: "abc" } } }).amount).toBeUndefined();
  });

  it("never emits schema-foreign keys (Don't #1)", () => {
    const r = parseExtraction(app, {
      fields: { ghost: { value: "x", confidence: 0.9 }, amount: { value: 5 } },
    });
    expect(Object.keys(r)).toEqual(["amount"]);
  });

  it("defaults missing confidence to 0.5", () => {
    expect(parseExtraction(app, { fields: { memo: { value: "hi" } } }).memo?.confidence).toBe(0.5);
  });

  it("is defensive against malformed raw input", () => {
    expect(parseExtraction(app, null)).toEqual({});
    expect(parseExtraction(app, {})).toEqual({});
    expect(parseExtraction(app, { fields: null })).toEqual({});
  });
});
