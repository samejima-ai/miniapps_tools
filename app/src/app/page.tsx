"use client";

/**
 * Root Page — Gate or List
 *
 * 入口の整理:
 * - ?uid=xxx あり + マッチ        → 自動ログイン → /list
 * - ?uid=xxx あり + マッチなし     → 黙って Gate にフォールバック
 * - ?uid=xxx なし                 → Gate（社員選択）
 * - sessionStorage に既存ユーザー  → /list へリダイレクト
 *
 * 仮運用ルート（Gate）は Platform 統合 (M3) で閉鎖予定。
 */

import { GateScreen } from "@/components/gate-screen";
import { fetchEmployeeByUid } from "@/lib/supabase/employees";
import { useUser } from "@/lib/user-context";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

type AutoLoginState = "none" | "pending" | "done";

function RootPageInner() {
  const { currentUser, selectUser } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const autoLoginAttempted = useRef(false);
  const uid = searchParams.get("uid");
  const [autoLoginState, setAutoLoginState] = useState<AutoLoginState>(
    uid ? "pending" : "none",
  );

  useEffect(() => {
    if (currentUser) {
      router.replace("/list");
      return;
    }

    if (!uid || autoLoginAttempted.current) return;
    autoLoginAttempted.current = true;

    // employee_id と profile_id の両方で照合（Platform は auth.uid() = profile_id を送る）
    fetchEmployeeByUid(uid).then((employee) => {
      if (employee) {
        selectUser(employee);
        // selectUser → currentUser 反映 → 上の useEffect で /list へ
      } else {
        // マッチしなければ Gate にフォールバック（黙って）
        setAutoLoginState("done");
      }
    });
  }, [currentUser, router, uid, selectUser]);

  if (currentUser) {
    return null;
  }

  // uid 試行中だけ "ログイン中..." を見せる
  if (autoLoginState === "pending") {
    return (
      <main className="flex-1 flex items-center justify-center">
        <div className="text-body-sm text-text-secondary">ログイン中...</div>
      </main>
    );
  }

  // 仮運用ルート: 直接アクセス / uid 不一致時のフォールバック
  return <GateScreen />;
}

export default function RootPage() {
  return (
    <Suspense>
      <RootPageInner />
    </Suspense>
  );
}
