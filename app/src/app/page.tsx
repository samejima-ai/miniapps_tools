"use client";

/**
 * Root Page — Gate or List
 *
 * - Platform 経由 (?uid=xxx) → 自動ログインして /list へ
 * - 認証済み → /list へリダイレクト
 * - 未認証 + uid なし → GateScreen（社員選択）※仮運用用、本番運用時に閉鎖
 */

import { GateScreen } from "@/components/gate-screen";
import { fetchActiveEmployees } from "@/lib/supabase/employees";
import { useUser } from "@/lib/user-context";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";

function RootPageInner() {
  const { currentUser, selectUser } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const autoLoginAttempted = useRef(false);

  useEffect(() => {
    if (currentUser) {
      router.replace("/list");
      return;
    }

    const uid = searchParams.get("uid");
    if (!uid || autoLoginAttempted.current) return;
    autoLoginAttempted.current = true;

    fetchActiveEmployees().then((employees) => {
      const match = employees.find((e) => e.id === uid);
      if (match) {
        selectUser(match);
      }
    });
  }, [currentUser, router, searchParams, selectUser]);

  if (currentUser) {
    return null;
  }

  const uid = searchParams.get("uid");
  if (uid) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <div className="text-body-sm text-text-secondary">ログイン中...</div>
      </main>
    );
  }

  // 仮運用ルート: Platform 統合後に閉鎖予定
  return <GateScreen />;
}

export default function RootPage() {
  return (
    <Suspense>
      <RootPageInner />
    </Suspense>
  );
}
