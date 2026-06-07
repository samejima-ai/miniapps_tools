import { describe, expect, it } from "vitest";
import {
  applyAnswer,
  applyDefaults,
  isComplete,
  nextRequiredField,
  skipOptional,
} from "../src/resolver.js";
import { emptyRecord, sampleApp } from "./fixtures.js";

describe("Resolver rally (FW §7.2)", () => {
  it("asks for the first missing required field in schema order", () => {
    const f = nextRequiredField(sampleApp, emptyRecord());
    expect(f?.name).toBe("date");
  });

  it("advances to the next required field after answering", () => {
    let r = emptyRecord();
    r = applyAnswer(r, "date", "2026-06-07");
    expect(nextRequiredField(sampleApp, r)?.name).toBe("amount");
    r = applyAnswer(r, "amount", 1200);
    expect(nextRequiredField(sampleApp, r)?.name).toBe("category");
    r = applyAnswer(r, "category", "a");
    expect(nextRequiredField(sampleApp, r)).toBeNull();
    expect(isComplete(sampleApp, r)).toBe(true);
  });

  it("applyAnswer marks the value as user-confirmed (confidence 1)", () => {
    const r = applyAnswer(emptyRecord(), "amount", 50);
    expect(r.fields.amount).toEqual({ value: 50, confidence: 1, source: "user" });
  });

  it("skipOptional drops an optional field but never a required one", () => {
    let r = applyAnswer(emptyRecord(), "memo", "hello");
    r = skipOptional(sampleApp, r, "memo");
    expect(r.fields.memo).toBeUndefined();
    // required is not skippable
    r = applyAnswer(r, "date", "2026-06-07");
    const r2 = skipOptional(sampleApp, r, "date");
    expect(r2.fields.date).toBeDefined();
  });

  it("applyDefaults fills only empty fields with default source", () => {
    const r = applyDefaults(sampleApp, emptyRecord());
    expect(r.fields.channel).toEqual({ value: "default", confidence: 1, source: "default" });
  });
});
