"use client";

/**
 * GateScreen — F1 社員選択ゲート画面
 *
 * 起動時に未認証ならこの画面を表示し、社員一覧から1人を選ばせる。
 * MVP は Supabase Auth のユーザー一覧から取得。
 * Supabase 未接続時はフォールバックのデモ社員リストを表示。
 *
 * SPEC F1:
 * - 起動時に未認証ならゲート画面を表示
 * - 社員一覧から1人を選ぶ
 * - currentUserId をクライアントセッションに保持
 */

import { useUser } from "@/lib/user-context";
import type { Employee } from "@/types";
import { useCallback, useEffect, useState } from "react";

/** デモ用社員リスト（Supabase 未接続時のフォールバック） */
const DEMO_EMPLOYEES: Employee[] = [
  { id: "00000000-0000-0000-0000-000000000001", name: "しょーや" },
  { id: "00000000-0000-0000-0000-000000000002", name: "大内" },
  { id: "00000000-0000-0000-0000-000000000003", name: "田中" },
  { id: "00000000-0000-0000-0000-000000000004", name: "佐藤" },
];

export function GateScreen() {
  const { selectUser } = useUser();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [supabaseConnected, setSupabaseConnected] = useState(false);

  useEffect(() => {
    // Supabase から社員リスト取得を試みる。失敗時はデモデータ。
    async function loadEmployees() {
      try {
        // Supabase 接続チェック: env が未設定なら即フォールバック
        if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
          setEmployees(DEMO_EMPLOYEES);
          return;
        }

        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();

        // MVP: employees テーブルは miniapps_tools スキーマの DDL に含まれないため
        // Supabase 接続時も常にデモ社員にフォールバックする。
        // 将来: platform.employees テーブル追加後に実データ取得に切替え。
        // 現時点では Supabase が接続可能であることの疎通確認のみ実施。
        const { error } = await supabase.from("items").select("id").limit(1);
        if (!error) {
          setSupabaseConnected(true);
        }
        setEmployees(DEMO_EMPLOYEES);
      } catch {
        setEmployees(DEMO_EMPLOYEES);
      } finally {
        setLoading(false);
      }
    }

    loadEmployees();
  }, []);

  const handleSelect = useCallback(
    (employee: Employee) => {
      selectUser(employee);
    },
    [selectUser],
  );

  return (
    <main className="flex-1 flex flex-col items-center justify-center px-lg py-xl gap-xl">
      {/* ロゴエリア */}
      <div className="text-center">
        <div className="text-headline-lg text-primary">工具管理</div>
        <div className="text-body-sm text-text-secondary mt-xs">カクマン工業</div>
      </div>

      {/* 社員選択 */}
      <div className="w-full max-w-[320px]">
        <div className="text-headline-md text-ink mb-md">社員を選択</div>
        {loading ? (
          <div className="text-body-sm text-text-secondary text-center py-xl">読み込み中...</div>
        ) : (
          <div className="flex flex-col gap-sm">
            {employees.map((emp) => (
              <button
                key={emp.id}
                type="button"
                onClick={() => handleSelect(emp)}
                className="flex items-center gap-md bg-surface border border-divider rounded-lg px-lg py-md min-h-[44px] hover:bg-primary-light hover:border-primary transition-colors text-left"
              >
                {/* アバター */}
                <div className="w-10 h-10 rounded-full bg-primary-light text-primary flex items-center justify-center text-headline-md flex-shrink-0">
                  {emp.name.charAt(0)}
                </div>
                <span className="text-body-md text-ink font-bold">{emp.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 情報 */}
      <div className="text-label-xs text-text-secondary text-center">
        {supabaseConnected ? "Supabase 接続済（デモ社員）" : "デモモード（Supabase 未接続）"}
      </div>
    </main>
  );
}
