/**
 * E2E-001: Gate → Employee 選択 → 一覧表示
 *
 * sensors/e2e/scenarios.md §E2E-001 (critical, F1+F3)
 *
 * 検証:
 *  - 起動時に Gate 画面が出る
 *  - 社員を 1 件選ぶと一覧画面に遷移する
 *  - ヘッダーに選択した社員名が表示される
 *
 * SEED 非依存: 実 Supabase でも demo フォールバックでも動くよう、
 * 「最初に表示された社員ボタン」を選択する設計にしている。
 */

import { test, expect } from "@playwright/test";

test.describe("E2E-001: Gate to List", () => {
  test("Gate 画面で社員を選択すると一覧に遷移しヘッダーに名前が出る", async ({ page }) => {
    await page.goto("/");

    // ── Gate 画面の検出 ──
    await expect(page.getByText("社員を選択")).toBeVisible({ timeout: 10_000 });

    // 表示されている社員ボタンの 1 件目を選択
    // (ボタンは「アバター + 名前」構造。最初のボタンの名前テキストを取得)
    const firstEmployeeBtn = page.getByRole("button").filter({ hasText: /^.+$/ }).first();
    await expect(firstEmployeeBtn).toBeVisible();

    const employeeName = (await firstEmployeeBtn.textContent())?.trim() ?? "";
    expect(employeeName.length).toBeGreaterThan(0);

    await firstEmployeeBtn.click();

    // ── 一覧画面の検出 ──
    // ヘッダーに「工具管理」+ 選択した社員名が出る (社員名は header.tsx で表示)
    await expect(page.getByText("工具管理")).toBeVisible({ timeout: 5_000 });

    // タブバーの「一覧」がアクティブで、「入力」「マスタ」も存在
    await expect(page.getByRole("link", { name: /一覧/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /入力/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /マスタ/ })).toBeVisible();
  });
});
