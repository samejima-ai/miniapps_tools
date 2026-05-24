-- ============================================================================
-- 0004_grant_anon_master_write.sql
--
-- 仮運用フェーズの権限調整。
-- Gate バイパス (?uid=xxx) + 直接アクセス (社員選択 Gate) の両方で
-- Supabase Auth セッションを持たずに動くため、現状 anon ロールで全操作が走る。
-- マスタ追加・notes 自動生成・movements 記録などの書き込みを動作させるため、
-- anon に INSERT/UPDATE を付与する。
--
-- セキュリティ前提:
-- - 社内 10〜30 人規模、URL を知っている人だけがアクセスする運用モデル
-- - PII / 決済データなし、社内データのみ
-- - Platform 統合時 (M3) に auth.users セッション経由に切り替え、本付与を撤回予定
-- - item_movements の DELETE/UPDATE は付与しない（append-only / D-1 維持）
-- ============================================================================

-- マスタ系 (items / individual_units / locations) への INSERT/UPDATE を anon に付与
grant insert, update on miniapps_tools.items            to anon;
grant insert, update on miniapps_tools.individual_units to anon;
grant insert, update on miniapps_tools.locations        to anon;

-- コト系 (item_movements) は INSERT のみ (append-only / D-1)
grant insert on miniapps_tools.item_movements to anon;

-- エイリアス学習系 (item_name_aliases / project_name_aliases) は INSERT/UPDATE
grant insert, update on miniapps_tools.item_name_aliases    to anon;
grant insert, update on miniapps_tools.project_name_aliases to anon;
