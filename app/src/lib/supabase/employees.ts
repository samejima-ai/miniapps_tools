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

/**
 * employee_id または profile_id (auth.uid()) で社員を1件取得。
 * Platform 経由の Gate バイパス用。Platform は auth.uid() = profile_id を送る。
 */
export async function fetchEmployeeByUid(uid: string): Promise<Employee | null> {
  try {
    const supabase = await createPublicServerClient();

    // まず employee_id で検索
    const { data: byEmpId } = await supabase
      .from("employees")
      .select("employee_id, family_name, given_name")
      .eq("employee_id", uid)
      .eq("status", "active")
      .is("deleted_at", null)
      .maybeSingle();

    if (byEmpId) {
      return {
        id: byEmpId.employee_id as string,
        name: `${byEmpId.family_name ?? ""} ${byEmpId.given_name ?? ""}`.trim() || "(無名)",
      };
    }

    // 次に profile_id (auth.uid()) で検索
    const { data: byProfile } = await supabase
      .from("employees")
      .select("employee_id, family_name, given_name")
      .eq("profile_id", uid)
      .eq("status", "active")
      .is("deleted_at", null)
      .maybeSingle();

    if (byProfile) {
      return {
        id: byProfile.employee_id as string,
        name: `${byProfile.family_name ?? ""} ${byProfile.given_name ?? ""}`.trim() || "(無名)",
      };
    }

    console.warn("[fetchEmployeeByUid] no match for uid:", uid);
    return null;
  } catch (err) {
    console.error("[fetchEmployeeByUid] exception:", err);
    return null;
  }
}
