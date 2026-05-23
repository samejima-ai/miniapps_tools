"use client";

/**
 * AppShell — 認証後のアプリ外殻
 *
 * Gate → 認証済み の判定と、Header + BottomTabs のラッピングを担当。
 * XState appMachine の概念を React コンポーネントで体現。
 *
 * - currentUser null → GateScreen
 * - currentUser あり → Header + children + BottomTabs
 */

import { useUser } from "@/lib/user-context";
import type { ReactNode } from "react";
import { BottomTabs } from "./bottom-tabs";
import { GateScreen } from "./gate-screen";
import { Header } from "./header";

export function AppShell({ children }: { children: ReactNode }) {
  const { currentUser } = useUser();

  if (!currentUser) {
    return <GateScreen />;
  }

  return (
    <>
      <Header />
      <main className="flex-1 flex flex-col overflow-y-auto">{children}</main>
      <BottomTabs />
    </>
  );
}
