"use client";

/**
 * Client-side Providers
 * UserProvider を含む全クライアントコンテキストをここで束ねる。
 */

import { UserProvider } from "@/lib/user-context";
import type { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return <UserProvider>{children}</UserProvider>;
}
