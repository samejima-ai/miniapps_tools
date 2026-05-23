/**
 * E2E-011: マスタページの基本レンダリング (smoke)
 *
 * F6 マスタ管理画面の固有要素を確認:
 *  - 「マスタ管理」見出し
 *  - 工具 / 個体 / 場所 の 3 タブボタン
 *
 * CRUD は実行しない (SEED 依存を回避)。
 *
 * SEED 非依存。
 */

import { test, expect } from "@playwright/test";

test.describe("E2E-011: Master page renders", () => {
  test("マスタタブから「マスタ管理」見出し + 工具/個体/場所 タブが表示される", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByText("社員を選択")).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button").filter({ hasText: /^.+$/ }).first().click();
    await expect(page.getByText("工具管理")).toBeVisible({ timeout: 5_000 });

    await page.getByRole("link", { name: /マスタ/ }).click();
    await expect(page).toHaveURL(/.*\/master/);

    // ── マスタページ固有要素 ──
    await expect(page.getByText("マスタ管理")).toBeVisible();
    // タブセグメントの 3 ボタン (工具 / 個体 / 場所)
    await expect(page.getByRole("button", { name: "工具", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "個体", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "場所", exact: true })).toBeVisible();

    // 下部タブバーで「マスタ」リンクが表示されている (アクティブ状態は未検証)
    await expect(page.getByRole("link", { name: /マスタ/ })).toBeVisible();
  });
});
