"use client";

/**
 * (main) Layout — 認証済みユーザー向けのレイアウト
 *
 * Header + children + BottomTabs を配置。
 * 未認証時は Gate（ルート）へリダイレクト。
 */

import { BottomTabs } from "@/components/bottom-tabs";
import { Header } from "@/components/header";
import { useUser } from "@/lib/user-context";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect } from "react";

export default function MainLayout({ children }: { children: ReactNode }) {
  const { currentUser } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!currentUser) {
      router.replace("/");
    }
  }, [currentUser, router]);

  if (!currentUser) {
    return null;
  }

  return (
    <>
      <Header />
      <div className="flex-1 flex flex-col overflow-y-auto">{children}</div>
      <BottomTabs />
    </>
  );
}
