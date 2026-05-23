-- ============================================================================
--  Migration: 0003_project_name_aliases
--  プロジェクト名エイリアス自動学習（フィードバックループ）
--
--  ユーザーの修正→確定から「site 入力 → projects.project_id」マッピングを蓄積。
--  例: "池下" → "(仮称)池下様邸 改修工事"、"ネクステージ" → 複数候補から選択された案件。
--  次回 LLM 抽出 site でエイリアス hit → ピッカー不要で即解決。
-- ============================================================================

create table miniapps_tools.project_name_aliases (
  id             uuid primary key default gen_random_uuid(),
  alias          text not null,       -- ユーザー入力 site（lowercase で格納）
  project_id     uuid not null,       -- 対応する public.projects.project_id（schema 跨ぎのため FK なし）
  canonical_name text not null,       -- 案件正式名のキャッシュ
  use_count      int  not null default 1,
  created_at     timestamptz not null default now(),
  last_used_at   timestamptz not null default now()
);

-- 1 alias → 1 project（最新の人間判断が正、items 同様）
create unique index idx_project_alias_unique on miniapps_tools.project_name_aliases (alias);

-- use_count 降順インデックス（高頻度エイリアス取得用）
create index idx_project_alias_use_count on miniapps_tools.project_name_aliases (use_count desc);

comment on table miniapps_tools.project_name_aliases is
  'CaaF プロジェクト名フィードバックループ。確定/ピッカー選択時に extractedSite≠canonicalName を自動学習。';

-- ── GRANT ──────────────────────────────────────────────────────
grant select, insert, update on miniapps_tools.project_name_aliases to anon;
grant select, insert, update on miniapps_tools.project_name_aliases to authenticated;

-- ── RLS ───────────────────────────────────────────────────────
alter table miniapps_tools.project_name_aliases enable row level security;

create policy p_project_aliases_read   on miniapps_tools.project_name_aliases
  for select using (true);
create policy p_project_aliases_insert on miniapps_tools.project_name_aliases
  for insert with check (true);
create policy p_project_aliases_update on miniapps_tools.project_name_aliases
  for update using (true) with check (true);
