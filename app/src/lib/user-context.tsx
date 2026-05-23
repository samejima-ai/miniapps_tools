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

type UserContextValue = {
  /** 現在選択中のユーザー (null = 未選択 = Gate 表示) */
  currentUser: Employee | null;
  /** 社員選択 → currentUserId をセット */
  selectUser: (employee: Employee) => void;
  /** ユーザー切替（Gate へ戻る） */
  switchUser: () => void;
};

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<Employee | null>(null);

  const selectUser = useCallback((employee: Employee) => {
    setCurrentUser(employee);
  }, []);

  const switchUser = useCallback(() => {
    setCurrentUser(null);
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
