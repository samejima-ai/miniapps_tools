import { describe, expect, it } from "vitest";
import {
  canExecute,
  clampConfidence,
  dropForeignFields,
  sanitizeRecord,
} from "../src/guards.js";
import type { CaaFFieldValue, CaaFRecord } from "../src/types.js";
import { sampleApp } from "./fixtures.js";

const fv = (value: unknown): CaaFFieldValue => ({ value, confidence: 1, source: "user" });

function confirmedComplete(): CaaFRecord {
  return {
    app: "sample",
    fields: { date: fv("2026-06-07"), amount: fv(1200), category: fv("a") },
    status: "confirmed",
  };
}

describe("dropForeignFields (Don't #1)", () => {
  it("removes fields not present in schema", () => {
    const clean = dropForeignFields(sampleApp, {
      amount: fv(10),
      injected: fv("evil"),
    });
    expect(Object.keys(clean)).toEqual(["amount"]);
  });
});

describe("canExecute", () => {
  it("allows a confirmed, complete, clean record", () => {
    const g = canExecute(sampleApp, confirmedComplete());
    expect(g.allowed).toBe(true);
    expect(g.reasons).toEqual([]);
  });

  it("blocks when status is not confirmed (Don't #3)", () => {
    const r = { ...confirmedComplete(), status: "mapped" as const };
    const g = canExecute(sampleApp, r);
    expect(g.allowed).toBe(false);
    expect(g.reasons).toContain("not_confirmed");
  });

  it("blocks when a required field is missing (Don't #2)", () => {
    const r = confirmedComplete();
    delete r.fields.amount;
    const g = canExecute(sampleApp, r);
    expect(g.allowed).toBe(false);
    expect(g.reasons).toContain("missing_required");
  });

  it("detects foreign fields that bypassed sanitize (Don't #1)", () => {
    const r = confirmedComplete();
    r.fields.injected = fv("evil");
    const g = canExecute(sampleApp, r);
    expect(g.allowed).toBe(false);
    expect(g.reasons).toContain("foreign_fields");
    // sanitize should make it pass
    const g2 = canExecute(sampleApp, sanitizeRecord(sampleApp, r));
    expect(g2.reasons).not.toContain("foreign_fields");
  });
});

describe("clampConfidence (Don't #4 前段)", () => {
  it("clamps out-of-range and NaN", () => {
    expect(clampConfidence(1.5)).toBe(1);
    expect(clampConfidence(-0.2)).toBe(0);
    expect(clampConfidence(Number.NaN)).toBe(0);
    expect(clampConfidence(0.73)).toBeCloseTo(0.73);
  });
});
