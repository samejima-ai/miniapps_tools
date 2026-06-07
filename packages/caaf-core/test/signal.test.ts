import { describe, expect, it } from "vitest";
import { confidenceSignal, recordSignal } from "../src/signal.js";
import type { CaaFFieldValue } from "../src/types.js";
import { emptyRecord, sampleApp } from "./fixtures.js";

const fv = (value: unknown, confidence: number): CaaFFieldValue => ({
  value,
  confidence,
  source: "ai",
});

describe("confidenceSignal (FW §7.3)", () => {
  it("maps confidence bands to 3 colors", () => {
    expect(confidenceSignal(0.95)).toBe("green");
    expect(confidenceSignal(0.8)).toBe("green");
    expect(confidenceSignal(0.79)).toBe("yellow");
    expect(confidenceSignal(0.6)).toBe("yellow");
    expect(confidenceSignal(0.59)).toBe("red");
    expect(confidenceSignal(0)).toBe("red");
  });
});

describe("recordSignal", () => {
  it("is red when required fields are missing", () => {
    expect(recordSignal(sampleApp, emptyRecord())).toBe("red");
  });

  it("is governed by the weakest required field's confidence", () => {
    const r = emptyRecord();
    r.fields = { date: fv("2026-06-07", 0.95), amount: fv(1200, 0.65), category: fv("a", 0.9) };
    expect(recordSignal(sampleApp, r)).toBe("yellow"); // amount 0.65 律速
  });

  it("is green when all required fields are confident", () => {
    const r = emptyRecord();
    r.fields = { date: fv("2026-06-07", 0.9), amount: fv(1200, 0.85), category: fv("a", 0.95) };
    expect(recordSignal(sampleApp, r)).toBe("green");
  });
});
