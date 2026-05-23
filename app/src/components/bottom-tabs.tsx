"use client";

/**
 * BottomTabs — 下部タブナビゲーション
 *
 * - 入力（CaaF）タブ / 一覧タブ の2つ
 * - DESIGN.md: primary for active, text-secondary for inactive
 * - タッチターゲット 44px 以上 (DESIGN.md Do)
 */

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/list", label: "一覧", icon: "📋" },
  { href: "/input", label: "入力", icon: "✏️" },
] as const;

export function BottomTabs() {
  const pathname = usePathname();

  return (
    <nav className="border-t border-divider bg-surface px-lg py-xs flex">
      {tabs.map((tab) => {
        const isActive = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex-1 flex flex-col items-center justify-center py-sm min-h-[44px] transition-colors ${
              isActive ? "text-primary font-bold" : "text-text-secondary"
            }`}
          >
            <span className="text-[18px]" aria-hidden="true">
              {tab.icon}
            </span>
            <span className="text-label-xs mt-0.5">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
