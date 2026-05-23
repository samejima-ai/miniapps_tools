import { defineConfig, devices } from "@playwright/test";

// BASE_URL を env で上書き可能。デフォルトは pnpm run dev が立てる :3000。
// 既存 dev サーバー (preview_start などで起動済) を再利用したい場合は
// `BASE_URL=http://localhost:XXXXX pnpm run test:e2e` で指定できる。
// 空文字 (BASE_URL=) は未指定扱い。
const baseUrlEnv = process.env.BASE_URL?.trim();
const BASE_URL = baseUrlEnv && baseUrlEnv.length > 0 ? baseUrlEnv : "http://localhost:3000";
const useOwnDevServer = !baseUrlEnv;

export default defineConfig({
  // tests/e2e (機能 smoke) と tests/perf (Interaction Cost) を別 project で扱う
  testDir: "tests",
  outputDir: "playwright-report",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      // 機能 smoke (tests/e2e/) — parallel 実行で安定
      name: "e2e",
      testDir: "tests/e2e",
      fullyParallel: true,
      use: { ...devices["Pixel 7"] },
    },
    {
      // Interaction Cost (tests/perf/) — 計測は parallel と相性が悪い (CPU 競合で
      // 数値ブレ)、workers:1 + fullyParallel:false で逐次実行
      name: "perf",
      testDir: "tests/perf",
      fullyParallel: false,
      use: { ...devices["Pixel 7"] },
    },
  ],
  // 両 project が並走するが、project ごとに fullyParallel 設定が尊重される。
  // e2e のみ走らせたい場合: `pnpm run test:e2e -- --project=e2e`
  // perf のみ走らせたい場合: `pnpm run test:e2e -- --project=perf`
  workers: process.env.CI ? 1 : undefined,
  // BASE_URL 指定時は外部 dev サーバーを使うため、Playwright 内で起動しない
  webServer: useOwnDevServer
    ? {
        command: "pnpm run dev",
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
      }
    : undefined,
  snapshotDir: "delivery/screenshots/baseline",
});
