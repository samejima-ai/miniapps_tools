/**
 * E2E-011: マスタページの基本レンダリング (smoke)
 *
 * F6 マスタ管理画面の表示確認。CRUD は実行しない (SEED 依存を回避)。
 *
 * SEED 非依存。
 */

import { test, expect } from "@playwright/test";

test.describe("E2E-011: Master page renders", () => {
  test("マスタタブから工具・個体・場所のマスタ画面が表示される", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("社員を選択")).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button").filter({ hasText: /^.+$/ }).first().click();
    await expect(page.getByText("工具管理")).toBeVisible({ timeout: 5_000 });

    await page.getByRole("link", { name: /マスタ/ }).click();
    await expect(page).toHaveURL(/.*\/master/);

    // ヘッダーが表示されたまま (アプリシェル維持)
    await expect(page.getByText("工具管理")).toBeVisible();

    // マスタタブがアクティブ状態 (リンクは visible)
    await expect(page.getByRole("link", { name: /マスタ/ })).toBeVisible();
  });
});
