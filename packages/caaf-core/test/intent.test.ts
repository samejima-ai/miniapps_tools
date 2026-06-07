import { describe, expect, it } from "vitest";
import { intentNeedsExtraction, normalizeIntent } from "../src/intent.js";
import { sampleApp } from "./fixtures.js";

describe("intentNeedsExtraction (cost split, FW §3/§6)", () => {
  it("runs L1 extraction only for add", () => {
    expect(intentNeedsExtraction("add")).toBe(true);
    for (const i of ["correct", "remove", "execute", "cancel", "reroute", "out_of_scope"] as const) {
      expect(intentNeedsExtraction(i)).toBe(false);
    }
  });
});

describe("normalizeIntent (FW §6 原則: target 不明は add にフォール)", () => {
  it("keeps correct/remove when target is a real schema field", () => {
    const r = normalizeIntent({ intent: "correct", target: "amount", value: 99 }, sampleApp);
    expect(r.intent).toBe("correct");
    expect(r.target).toBe("amount");
  });

  it("falls back to add when correct has no resolvable target", () => {
    expect(normalizeIntent({ intent: "correct" }, sampleApp).intent).toBe("add");
    expect(normalizeIntent({ intent: "remove", target: "ghost" }, sampleApp).intent).toBe("add");
  });

  it("leaves non-correct/remove intents untouched", () => {
    expect(normalizeIntent({ intent: "execute" }, sampleApp).intent).toBe("execute");
  });
});
