"use client";

/**
 * Root Page — Gate or List
 *
 * - 未認証 → GateScreen（社員選択）
 * - 認証済み → /list へリダイレクト
 */

import { GateScreen } from "@/components/gate-screen";
import { useUser } from "@/lib/user-context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function RootPage() {
  const { currentUser } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (currentUser) {
      router.replace("/list");
    }
  }, [currentUser, router]);

  if (currentUser) {
    return null;
  }

  return <GateScreen />;
}
