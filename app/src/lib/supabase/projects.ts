"use server";

/**
 * Server Action: 本番 public.projects の参照系。
 *
 * - 部分一致検索: 案件選択 UI / 自然言語抽出時のマッチング
 * - ID 一括取得: 一覧の project_id → project_name 解決
 */

import { createPublicServerClient } from "@/lib/supabase/server";

export type ProjectRef = {
  projectId: string;
  name: string;
};

/** 案件名で部分一致検索（削除済除外、上位N件） */
export async function searchProjects(
  query: string,
  limit = 10,
): Promise<ProjectRef[]> {
  const q = query.trim();
  if (!q) return [];

  const supabase = await createPublicServerClient();
  const { data, error } = await supabase
    .from("projects")
    .select("project_id, name")
    .ilike("name", `%${q}%`)
    .is("deleted_at", null)
    .limit(limit);

  if (error || !data) return [];
  return data.map((p) => ({
    projectId: p.project_id as string,
    name: p.name as string,
  }));
}

/** project_id の配列 → 名前マッピングを一括取得 */
export async function fetchProjectsByIds(
  ids: string[],
): Promise<Record<string, string>> {
  if (ids.length === 0) return {};
  const supabase = await createPublicServerClient();
  const { data, error } = await supabase
    .from("projects")
    .select("project_id, name")
    .in("project_id", ids);

  if (error || !data) return {};
  return Object.fromEntries(
    data.map((p) => [p.project_id as string, p.name as string]),
  );
}

/** employee_id の配列 → 名前マッピングを一括取得 */
export async function fetchEmployeesByIds(
  ids: string[],
): Promise<Record<string, string>> {
  if (ids.length === 0) return {};
  const supabase = await createPublicServerClient();
  const { data, error } = await supabase
    .from("employees")
    .select("employee_id, family_name, given_name")
    .in("employee_id", ids);

  if (error || !data) return {};
  return Object.fromEntries(
    data.map((e) => [
      e.employee_id as string,
      `${e.family_name ?? ""} ${e.given_name ?? ""}`.trim() || "(無名)",
    ]),
  );
}
