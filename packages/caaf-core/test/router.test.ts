import { describe, expect, it } from "vitest";
import { keywordScores, routeByScores } from "../src/router.js";
import type { CaaFApp } from "../src/types.js";
import { sampleApp } from "./fixtures.js";

const second: CaaFApp = {
  ...sampleApp,
  id: "other",
  name: "Other",
  routing: { keywords: ["other", "misc"], description: "other entry", priority: 2 },
};
const apps = [sampleApp, second];

describe("routeByScores (FW §5 確信度分岐)", () => {
  it("auto-confirms when top score >= high threshold", () => {
    const d = routeByScores([{ appId: "sample", score: 0.9 }], apps);
    expect(d.mode).toBe("auto");
    expect(d.appId).toBe("sample");
  });

  it("proposes a candidate in the mid band", () => {
    const d = routeByScores(
      [
        { appId: "sample", score: 0.7 },
        { appId: "other", score: 0.65 },
      ],
      apps,
    );
    expect(d.mode).toBe("candidate");
    expect(d.appId).toBe("sample");
    expect(d.candidates?.[0]?.appId).toBe("sample");
  });

  it("falls back below the mid threshold", () => {
    const d = routeByScores([{ appId: "sample", score: 0.3 }], apps);
    expect(d.mode).toBe("fallback");
  });

  it("breaks ties by routing.priority", () => {
    const d = routeByScores(
      [
        { appId: "sample", score: 0.9 },
        { appId: "other", score: 0.9 },
      ],
      apps,
    );
    // both >= high; sorted by priority desc → "other" (priority 2) wins
    expect(d.appId).toBe("other");
  });

  it("returns fallback for empty scores", () => {
    expect(routeByScores([], apps).mode).toBe("fallback");
  });

  it("ignores scores for appIds absent from apps (defensive against bad scorer output)", () => {
    // "ghost" は apps に存在しない。スコア最高でも採用せず、既知の "sample" で判定する。
    const d = routeByScores(
      [
        { appId: "ghost", score: 0.99 },
        { appId: "sample", score: 0.85 },
      ],
      apps,
    );
    expect(d.mode).toBe("auto");
    expect(d.appId).toBe("sample");
  });

  it("falls back when every score references an unknown app", () => {
    const d = routeByScores([{ appId: "ghost", score: 0.99 }], apps);
    expect(d.mode).toBe("fallback");
    expect(d.appId).toBeUndefined();
  });
});

describe("keywordScores", () => {
  it("scores by fraction of matched keywords", () => {
    const scores = keywordScores("this is a sample entry", apps);
    const sample = scores.find((s) => s.appId === "sample");
    expect(sample?.score).toBe(1); // both "sample" and "entry" hit
    const other = scores.find((s) => s.appId === "other");
    expect(other?.score).toBe(0);
  });
});
