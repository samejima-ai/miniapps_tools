/**
 * E2E-008: ユーザー切替
 *
 * sensors/e2e/scenarios.md §E2E-008 (standard, F1)
 *
 * 検証: ログイン済の状態でヘッダー「切替」をタップすると Gate に戻る。
 * 別社員の再選択は flaky (gate-screen の async employees load 後の競合) なので
 * 本テストは Gate への遷移のみ検証。再選択は E2E-001 が既にカバー。
 *
 * SEED 非依存。
 */

import { test, expect } from "@playwright/test";

test.describe("E2E-008: User switch", () => {
  test("切替ボタンで Gate 画面に戻る", async ({ page }) => {
    await page.goto("/");

    // 1人目を選択して認証済 state にする
    await expect(page.getByText("社員を選択")).toBeVisible({ timeout: 10_000 });
    const firstBtn = page.getByRole("button").filter({ hasText: /^.+$/ }).first();
    await firstBtn.click();
    await expect(page.getByText("工具管理")).toBeVisible({ timeout: 5_000 });

    // 切替ボタンタップ → Gate へ戻る
    await page.getByRole("button", { name: /切替/ }).click();
    await expect(page.getByText("社員を選択")).toBeVisible({ timeout: 5_000 });
  });
});
