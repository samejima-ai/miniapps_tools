/**
 * Perf テスト用認証ヘルパー。
 *
 * Gate 画面を踏まず、sessionStorage に user を直接セットして
 * /list 等の認証必須画面に直接遷移できるようにする。
 *
 * SESSION_KEY はアプリ本体 (user-context.tsx) から import する。
 * テスト側でハードコードすると app 側変更で静かに壊れる。
 */

import type { Page } from "@playwright/test";
import { SESSION_KEY } from "@/lib/user-context";

const DEMO_USER = {
  id: "00000000-0000-0000-0000-000000000001",
  name: "しょーや",
};

/**
 * baseURL でブランクページを開き、sessionStorage にダミー user を仕込む。
 * 次の page.goto で認証済として動く。
 */
export async function preAuthenticate(page: Page): Promise<void> {
  // sessionStorage はオリジン単位なので、対象オリジンに 1 度遷移してからセット
  await page.goto("/");
  await page.evaluate(
    ({ key, user }) => {
      sessionStorage.setItem(key, JSON.stringify(user));
    },
    { key: SESSION_KEY, user: DEMO_USER },
  );
}
