import type { CaaFApp, CaaFRecord, IntentContext } from "@caaf/core";
import { describe, expect, it } from "vitest";
import { buildIntentPrompt, parseIntentResponse } from "./intent";

const app: CaaFApp = {
  id: "sample",
  name: "Sample",
  context: { role: "経費登録アシスタント", description: "経費を1件ずつ登録する" },
  schema: [
    { name: "date", type: "date", required: true, label: "日付" },
    { name: "amount", type: "number", required: true, label: "金額" },
    { name: "memo", type: "string", required: false, label: "摘要" },
  ],
  dont: [],
  adapter: { type: "db", config: {} },
  routing: { keywords: ["経費"], description: "経費の登録", priority: 1 },
};

const record: CaaFRecord = {
  app: "sample",
  fields: { amount: { value: 1200, confidence: 1, source: "user" } },
  status: "mapped",
};

const ctx = (currentRecord: CaaFRecord | null = record): IntentContext => ({
  app,
  recentMessages: ["1200円 旅費"],
  currentRecord,
});

describe("buildIntentPrompt", () => {
  it("system lists all 7 intents and the schema field names", () => {
    const { system } = buildIntentPrompt(app, ctx(), "やっぱり1500円に直して");
    for (const i of ["add", "correct", "remove", "execute", "cancel", "reroute", "out_of_scope"]) {
      expect(system).toContain(i);
    }
    expect(system).toContain("date, amount, memo");
  });

  it("user embeds the input, recent messages and current values", () => {
    const { user } = buildIntentPrompt(app, ctx(), "やっぱり1500円に直して");
    expect(user).toContain("やっぱり1500円に直して");
    expect(user).toContain("1200円 旅費"); // recent
    expect(user).toContain("amount"); // current value
  });

  it("handles an empty record gracefully", () => {
    const { user } = buildIntentPrompt(app, ctx(null), "経費登録");
    expect(user).toContain("まだ何も入力されていません");
  });
});

describe("parseIntentResponse (FW §6)", () => {
  it("keeps a valid intent with target and explicit value", () => {
    expect(parseIntentResponse({ intent: "correct", target: "amount", value: 1500 })).toEqual({
      intent: "correct",
      target: "amount",
      value: 1500,
    });
  });

  it("falls back to add for an unknown intent (no value fabrication)", () => {
    expect(parseIntentResponse({ intent: "frobnicate" })).toEqual({ intent: "add" });
  });

  it("drops empty target and null value", () => {
    expect(parseIntentResponse({ intent: "add", target: "", value: null })).toEqual({
      intent: "add",
    });
  });

  it("keeps reason when present", () => {
    expect(parseIntentResponse({ intent: "execute", reason: "登録指示" })).toEqual({
      intent: "execute",
      reason: "登録指示",
    });
  });

  it("is defensive against malformed input", () => {
    expect(parseIntentResponse(null)).toEqual({ intent: "add" });
    expect(parseIntentResponse({})).toEqual({ intent: "add" });
  });
});
