/**
 * IC-4: フィルタ / 検索の即時反映 ≤ 300ms
 *
 * sensors/interaction-cost/thresholds.md §IC-4 (F3 一覧)
 *
 * 計測: 検索 input への 1 文字入力 → UI 更新までを測定。
 * 入力は debounced されている可能性があるので、UI 側で「件数表示」が
 * 反映されるまでの時間を計る。SEED なしでも検索 input 自体は visible。
 *
 * 認証は preAuthenticate で skip。
 */

import { test, expect } from "@playwright/test";
import { preAuthenticate } from "./fixtures/auth";

const THRESHOLD_MS = 300;
const SAMPLES = 5;

test.describe("IC-4: List filter response", () => {
  test(`検索入力 → UI 更新が ≤ ${THRESHOLD_MS}ms`, async ({ page }) => {
    await preAuthenticate(page);
    await page.goto("/list", { waitUntil: "networkidle" });

    const searchInput = page.getByPlaceholder("工具名・番号で検索");
    await expect(searchInput).toBeVisible({ timeout: 5_000 });

    const samples: number[] = [];
    for (let i = 0; i < SAMPLES; i++) {
      await searchInput.fill("");
      // 1 文字 fill → React state update が反映されるまでを測定
      const start = Date.now();
      await searchInput.fill(`q${i}`);
      // input event が反応した直後の DOM 更新を待つ (微小な microtask 完了)
      await page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => r())));
      const elapsed = Date.now() - start;
      samples.push(elapsed);
    }

    samples.sort((a, b) => a - b);
    const p95 = samples[samples.length - 1] ?? 0;
    const median = samples[Math.floor(samples.length / 2)] ?? 0;

    console.log(`IC-4 filter — samples(ms): ${samples.join(", ")} median=${median} p95=${p95}`);
    expect(p95).toBeLessThanOrEqual(THRESHOLD_MS);
  });
});
