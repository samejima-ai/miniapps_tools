/**
 * Service Worker entry — serwist 経由で生成される PWA SW。
 *
 * - precaching: Next.js のビルド成果物 (__SW_MANIFEST)
 * - runtime caching: defaultCache (一覧 / マスタ 等の GET レスポンス)
 * - skipWaiting: 新版が来たら即時切替
 *
 * D-9 注意: Supabase 業務データ (item_movements 等) は永続キャッシュしない。
 * defaultCache の NetworkFirst で短時間のみ retain される範疇に留める。
 */

import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
});

serwist.addEventListeners();
