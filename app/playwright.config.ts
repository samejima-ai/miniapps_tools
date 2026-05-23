import { defineConfig, devices } from "@playwright/test";

// BASE_URL を env で上書き可能。デフォルトは pnpm run dev が立てる :3000。
// 既存 dev サーバー (preview_start などで起動済) を再利用したい場合は
// `BASE_URL=http://localhost:XXXXX pnpm run test:e2e` で指定できる。
const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const useOwnDevServer = !process.env.BASE_URL;

export default defineConfig({
  testDir: "tests/e2e",
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
