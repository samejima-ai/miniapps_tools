-- ============================================================================
--  Migration: 0002_item_name_aliases
--  エイリアス自動学習テーブル（フィードバックループ）
--
--  ユーザーの修正→確定から「入力名→正式名」マッピングを蓄積。
--  次回のマスタ照合・LLM プロンプト注入で精度を継続改善。
-- ============================================================================

create table miniapps_tools.item_name_aliases (
  id             uuid primary key default gen_random_uuid(),
  alias          text not null,       -- ユーザー入力名（lowercase で格納）
  item_id        uuid not null references miniapps_tools.items(id),
  canonical_name text not null,       -- マスタ正式名（表示用キャッシュ）
  use_count      int  not null default 1,
  created_at     timestamptz not null default now(),
  last_used_at   timestamptz not null default now()
);

-- 1 alias → 1 item（最新の人間判断が正）
create unique index idx_alias_unique on miniapps_tools.item_name_aliases (alias);

-- use_count 降順で高頻度エイリアスを高速取得（LLM プロンプト注入用）
create index idx_alias_use_count on miniapps_tools.item_name_aliases (use_count desc);

comment on table miniapps_tools.item_name_aliases is
  'CaaF フィードバックループ。確定時に extractedName≠matchedName を自動学習。resolveAgainstMaster の ILIKE 前段で使用。';

-- ── GRANT ──────────────────────────────────────────────────────
-- anon: SELECT（照合用）+ INSERT/UPDATE（学習書き込み用）
-- default privileges は SELECT のみなので INSERT/UPDATE は明示付与
grant select, insert, update on miniapps_tools.item_name_aliases to anon;
grant select, insert, update on miniapps_tools.item_name_aliases to authenticated;

-- ── RLS ───────────────────────────────────────────────────────
alter table miniapps_tools.item_name_aliases enable row level security;

create policy p_aliases_read   on miniapps_tools.item_name_aliases
  for select using (true);
create policy p_aliases_insert on miniapps_tools.item_name_aliases
  for insert with check (true);
create policy p_aliases_update on miniapps_tools.item_name_aliases
  for update using (true) with check (true);
