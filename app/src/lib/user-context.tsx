"use client";

/**
 * UserContext — F1 ユーザー識別
 *
 * currentUserId を React Context で管理する。
 * Supabase Auth セッションと併用し、クライアントセッションに保持。
 * 「切替」で再選択可能（同一端末を複数人で共有する想定）。
 *
 * 将来 Platform SSO 統合時は、このコンテキストの userId 解決を
 * platform.employees(id) に差し替えるだけで済む構造。
 */

import type { Employee } from "@/types";
import { type ReactNode, createContext, useCallback, useContext, useState } from "react";

/**
 * sessionStorage キー。テストからも参照されるので export している
 * (tests/perf/fixtures/auth.ts が pre-authenticate で利用)。
 */
export const SESSION_KEY = "miniapps_tools_current_user";

type UserContextValue = {
  /** 現在選択中のユーザー (null = 未選択 = Gate 表示) */
  currentUser: Employee | null;
  /** 社員選択 → currentUserId をセット */
  selectUser: (employee: Employee) => void;
  /** ユーザー切替（Gate へ戻る） */
  switchUser: () => void;
};

const UserContext = createContext<UserContextValue | null>(null);

/** sessionStorage から復元（リロード時にゲートに戻らない） */
function loadFromSession(): Employee | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { id?: string; name?: string };
    if (parsed.id && parsed.name) {
      return { id: parsed.id, name: parsed.name };
    }
  } catch {
    // ignore
  }
  return null;
}

export function UserProvider({ children }: { children: ReactNode }) {
  // 初期レンダーで sessionStorage から同期復元（hydration バウンス防止）
  const [currentUser, setCurrentUser] = useState<Employee | null>(() => loadFromSession());

  const selectUser = useCallback((employee: Employee) => {
    setCurrentUser(employee);
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(employee));
    } catch {
      // ignore
    }
  }, []);

  const switchUser = useCallback(() => {
    setCurrentUser(null);
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      // ignore
    }
  }, []);

  return (
    <UserContext.Provider value={{ currentUser, selectUser, switchUser }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser(): UserContextValue {
  const ctx = useContext(UserContext);
  if (!ctx) {
    throw new Error("useUser must be used within UserProvider");
  }
  return ctx;
}
