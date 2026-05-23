/**
 * Supabase Browser Client
 * @supabase/ssr を使用し、クライアントサイドでの DB アクセスを提供。
 * RLS を信頼し、サーバー側での余計な権限チェックは行わない (CLAUDE.md)。
 */

import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
        "Set them in app/.env.local",
    );
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey, {
    db: { schema: "miniapps_tools" },
  });
}
