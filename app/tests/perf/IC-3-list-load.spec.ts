/**
 * IC-3: 一覧初期表示時間 p95 ≤ 2,000ms
 *
 * sensors/interaction-cost/thresholds.md §IC-3 (F3 一覧)
 *
 * 計測:
 *  - goto("/list") から DOM ready までを 5 回測定
 *  - p95 (5 サンプル中 5 番目 = max) を assert
 *
 * 認証は preAuthenticate で skip。
 */

import { test, expect } from "@playwright/test";
import { preAuthenticate } from "./fixtures/auth";

const THRESHOLD_MS = 2000;
const SAMPLES = 5;

test.describe("IC-3: List page initial load", () => {
  test(`/list が p95 ≤ ${THRESHOLD_MS}ms で表示される`, async ({ page }) => {
    await preAuthenticate(page);

    const samples: number[] = [];
    for (let i = 0; i < SAMPLES; i++) {
      const start = Date.now();
      await page.goto("/list", { waitUntil: "domcontentloaded" });
      const elapsed = Date.now() - start;
      samples.push(elapsed);
    }

    samples.sort((a, b) => a - b);
    // p95 ≒ 5 サンプル中の最大値 (小サンプルの簡易近似)
    const p95 = samples[samples.length - 1] ?? 0;
    const median = samples[Math.floor(samples.length / 2)] ?? 0;

    console.log(`IC-3 list load — samples(ms): ${samples.join(", ")} median=${median} p95=${p95}`);
    expect(p95).toBeLessThanOrEqual(THRESHOLD_MS);
  });
});
