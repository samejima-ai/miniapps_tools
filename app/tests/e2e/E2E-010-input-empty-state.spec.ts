/**
 * E2E-010: 入力ページのエンプティ状態 + テキスト入力 (smoke)
 *
 * CaaF 入力ページの基本動作 (プレースホルダ表示、テキスト入力可) を検証。
 * LLM 抽出は実行しない (Gemini 依存・SEED 依存を回避)。
 *
 * SEED 非依存。
 */

import { test, expect } from "@playwright/test";

test.describe("E2E-010: Input empty state", () => {
  test("入力ページにプレースホルダが表示され、テキストエリアに入力できる", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("社員を選択")).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button").filter({ hasText: /^.+$/ }).first().click();
    await expect(page.getByText("工具管理")).toBeVisible({ timeout: 5_000 });

    await page.getByRole("link", { name: /入力/ }).click();
    await expect(page).toHaveURL(/.*\/input/);

    // エンプティ状態のプレースホルダ
    await expect(page.getByText("LINE と同じノリで入力してください")).toBeVisible();

    // テキストエリアに入力できる
    const textarea = page.getByPlaceholder("工具名・番号・現場を入力...");
    await expect(textarea).toBeVisible();
    await textarea.fill("テスト入力");
    await expect(textarea).toHaveValue("テスト入力");

    // 送信ボタンが存在し visible (テキスト送信 UI が組み立てられていること)
    // 本テストでは送信は行わない (LLM 呼出は別シナリオで検証)。
    // input ページの送信ボタンは textarea の隣に配置された type="button"。
    const sendBtn = page.locator("button[type='button']").last();
    await expect(sendBtn).toBeVisible();
  });
});
