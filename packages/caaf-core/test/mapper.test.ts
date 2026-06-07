import { describe, expect, it } from "vitest";
import { buildRecord } from "../src/mapper.js";
import type { CaaFFieldValue, CaaFRecord } from "../src/types.js";
import { sampleApp } from "./fixtures.js";

const ai = (value: unknown, confidence = 0.9): CaaFFieldValue => ({
  value,
  confidence,
  source: "ai",
});
const user = (value: unknown): CaaFFieldValue => ({ value, confidence: 1, source: "user" });

describe("buildRecord (FW §7.1 / Don't #1)", () => {
  it("does not overwrite a user-confirmed value with an AI value (設計原則 3)", () => {
    const base: CaaFRecord = { app: "sample", fields: { amount: user(100) }, status: "mapped" };
    const r = buildRecord(sampleApp, { amount: ai(999) }, base);
    expect(r.fields.amount).toEqual(user(100));
  });

  it("ignores null/undefined extracted values so existing values are not erased", () => {
    const base: CaaFRecord = { app: "sample", fields: { memo: ai("keep") }, status: "mapped" };
    const r = buildRecord(sampleApp, { memo: ai(null) }, base);
    expect(r.fields.memo).toEqual(ai("keep"));
  });

  it("drops schema-foreign keys from both extracted and base (Don't #1)", () => {
    const base: CaaFRecord = { app: "sample", fields: { injected: ai("x") }, status: "mapped" };
    const r = buildRecord(sampleApp, { ghost: ai("y"), amount: ai(5) }, base);
    expect(Object.keys(r.fields)).toEqual(["amount"]);
  });

  it("merges valid extracted fields and marks status mapped", () => {
    const r = buildRecord(sampleApp, { date: ai("2026-06-07"), amount: ai(1200) });
    expect(r.status).toBe("mapped");
    expect(r.fields.date?.value).toBe("2026-06-07");
    expect(r.fields.amount?.value).toBe(1200);
  });
});
