/**
 * E2E-009: タブ間遷移 (smoke)
 *
 * F3 一覧 / F2 入力 / F6 マスタ の 3 タブ往復を検証。
 * sensors/e2e/scenarios.md に明記はないが、ナビゲーションの基本回帰検知として追加。
 *
 * SEED 非依存。
 */

import { test, expect } from "@playwright/test";

test.describe("E2E-009: Tab navigation", () => {
  test("一覧 ↔ 入力 ↔ マスタ をタブで遷移できる", async ({ page }) => {
    await page.goto("/");

    // 認証
    await expect(page.getByText("社員を選択")).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button").filter({ hasText: /^.+$/ }).first().click();
    await expect(page.getByText("工具管理")).toBeVisible({ timeout: 5_000 });

    // 入力タブ
    await page.getByRole("link", { name: /入力/ }).click();
    await expect(page).toHaveURL(/.*\/input/);
    await expect(page.getByText("LINE と同じノリで入力してください")).toBeVisible({ timeout: 5_000 });

    // マスタタブ
    await page.getByRole("link", { name: /マスタ/ }).click();
    await expect(page).toHaveURL(/.*\/master/);

    // 一覧タブに戻る
    await page.getByRole("link", { name: /一覧/ }).click();
    await expect(page).toHaveURL(/.*\/list/);
  });
});
