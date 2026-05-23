import { defineConfig, devices } from "@playwright/test";

// BASE_URL を env で上書き可能。デフォルトは pnpm run dev が立てる :3000。
// 既存 dev サーバー (preview_start などで起動済) を再利用したい場合は
// `BASE_URL=http://localhost:XXXXX pnpm run test:e2e` で指定できる。
// 空文字 (BASE_URL=) は未指定扱い。
const baseUrlEnv = process.env.BASE_URL?.trim();
const BASE_URL = baseUrlEnv && baseUrlEnv.length > 0 ? baseUrlEnv : "http://localhost:3000";
const useOwnDevServer = !baseUrlEnv;

export default defineConfig({
  // tests/e2e (E2E shorten) と tests/perf (Interaction Cost) の双方を含める
  testDir: "tests",
  outputDir: "playwright-report",
  fullyParallel: true,
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
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"] },
    },
  ],
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
