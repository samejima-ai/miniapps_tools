"use client";

/**
 * Header — アプリヘッダー
 *
 * - Kakuman Blue 背景
 * - ユーザー表示名 + 「切替」ボタン (F1)
 * - DESIGN.md: primary background, surface text
 */

import { useUser } from "@/lib/user-context";

export function Header() {
  const { currentUser, switchUser } = useUser();

  if (!currentUser) return null;

  return (
    <header className="shrink-0 relative z-20 bg-primary px-lg py-md flex items-center justify-between">
      <div className="flex items-center gap-sm">
        {/* アバター: 名前の頭文字 */}
        <div className="w-8 h-8 rounded-full bg-primary-light text-primary-dark flex items-center justify-center text-body-sm font-bold">
          {currentUser.name.charAt(0)}
        </div>
        <div>
          <div className="text-surface text-headline-md">工具管理</div>
          <div className="text-primary-light text-label-xs">{currentUser.name}</div>
        </div>
      </div>
      <button
        type="button"
        onClick={switchUser}
        className="text-primary-light text-body-sm border border-primary-light/40 rounded-md px-md py-xs hover:bg-primary-dark transition-colors"
      >
        切替
      </button>
    </header>
  );
}
