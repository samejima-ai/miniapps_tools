import { describe, expect, it } from "vitest";
import { checkFieldType, validateRecord } from "../src/validate.js";
import type { CaaFFieldValue } from "../src/types.js";
import { emptyRecord, sampleApp } from "./fixtures.js";

const fv = (value: unknown): CaaFFieldValue => ({ value, confidence: 1, source: "user" });

describe("validateRecord", () => {
  it("reports all missing required fields on an empty record", () => {
    const r = validateRecord(sampleApp, emptyRecord());
    expect(r.ok).toBe(false);
    expect(r.missingRequired.sort()).toEqual(["amount", "category", "date"]);
  });

  it("is ok when all required fields are present and well-typed", () => {
    const record = emptyRecord();
    record.fields = { date: fv("2026-06-07"), amount: fv(1200), category: fv("a") };
    const r = validateRecord(sampleApp, record);
    expect(r.ok).toBe(true);
    expect(r.missingRequired).toEqual([]);
    expect(r.typeErrors).toEqual([]);
  });

  it("flags a type error for a wrong-typed field", () => {
    const record = emptyRecord();
    record.fields = { date: fv("2026-06-07"), amount: fv("not-a-number"), category: fv("a") };
    const r = validateRecord(sampleApp, record);
    expect(r.ok).toBe(false);
    expect(r.typeErrors.map((e) => e.field)).toContain("amount");
  });

  it("rejects an enum value outside options", () => {
    const record = emptyRecord();
    record.fields = { date: fv("2026-06-07"), amount: fv(10), category: fv("z") };
    const r = validateRecord(sampleApp, record);
    expect(r.typeErrors.map((e) => e.field)).toContain("category");
  });
});

describe("checkFieldType", () => {
  it("treats empty/absent values as type-ok (handled by required check)", () => {
    const field = sampleApp.schema[1]; // amount: number
    expect(field && checkFieldType(field, undefined)).toBe(true);
  });
});
