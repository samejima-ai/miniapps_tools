"use server";

/**
 * Server Action: 本番 public.employees から active 社員一覧を取得。
 *
 * クライアント側で別スキーマアクセスを直接行うと CORS / Accept-Profile
 * 設定が複雑になるため、Server Action 経由で取得して返す。
 */

import { createPublicServerClient } from "@/lib/supabase/server";
import type { Employee } from "@/types";

export async function fetchActiveEmployees(): Promise<Employee[]> {
  try {
    const supabase = await createPublicServerClient();
    const { data, error } = await supabase
      .from("employees")
      .select("employee_id, family_name, given_name")
      .eq("status", "active")
      .is("deleted_at", null)
      .order("family_name", { ascending: true });

    if (error) {
      console.error("[fetchActiveEmployees] error:", error);
      return [];
    }
    if (!data) return [];

    return data.map((e) => ({
      id: e.employee_id as string,
      name: `${e.family_name ?? ""} ${e.given_name ?? ""}`.trim() || "(無名)",
    }));
  } catch (err) {
    console.error("[fetchActiveEmployees] exception:", err);
    return [];
  }
}
