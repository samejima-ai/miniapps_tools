-- ============================================================================
--  Kakuman Platform / 工具管理ミニアプリ MVP DDL
--  Schema: miniapps_tools.*
--  Migration: 0001_init_miniapps_tools
--  Generated: 2026-05-22
-- ----------------------------------------------------------------------------
--  設計原則（DON'T を最優先で明記）
--   [罠A] 状態(status)・現在所在・現在保持者を実体テーブルにカラムとして持たない。
--         必ず item_movements（コト）の最新行から View で導出する。
--   [SSOT] コト = item_movements が唯一の真実。append-only（UPDATE/DELETEしない）。
--   [ヒト>モノ>コト] employees(ヒト) / items+units(モノ) を movements(コト) が束ねる。
--   [器は資材まで] テーブル名は tools でなく items。tracking_type で個体/数量を分岐。
--         MVPの運用は category='tool' のみ。material は器だけ用意。
--   [将来統合] holder_id は employees を参照。Platform SSO uid への差替えは
--         employees 側の対応で吸収し、本スキーマは変更不要にする。
-- ============================================================================

create schema if not exists miniapps_tools;

-- ----------------------------------------------------------------------------
-- 拡張機能（gen_random_uuid() のため pgcrypto を有効化）
-- ----------------------------------------------------------------------------
create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- ENUM 定義
-- ----------------------------------------------------------------------------

-- モノの追跡方式：個体管理（番号工具）/ 数量管理（消耗品・資材）
do $$ begin
  create type miniapps_tools.tracking_type as enum ('individual', 'quantity');
exception when duplicate_object then null; end $$;

-- モノの分類：MVPは tool のみ運用。material は将来の資材統合用の器。
do $$ begin
  create type miniapps_tools.item_category as enum ('tool', 'material', 'consumable');
exception when duplicate_object then null; end $$;

-- コト（移動イベント）の種別。所在・保持の変化を表す。
--   checkout : 倉庫→現場（持出。holder と project が埋まる）
--   return   : 現場→倉庫（返却。holder/project は null へ向かう）
--   transfer : 現場→現場（将来）
--   inbound  : 入庫（新規購入・数量補充。将来の資材で主に使用）
--   outbound : 出庫（消費・廃棄。将来）
do $$ begin
  create type miniapps_tools.movement_type as enum
    ('checkout', 'return', 'transfer', 'inbound', 'outbound');
exception when duplicate_object then null; end $$;

-- ============================================================================
-- A. CORE（モノのマスタ）
-- ============================================================================

-- A-1. items : 工具/資材の共通マスタ（モノの種類を表す。個体そのものではない）
create table if not exists miniapps_tools.items (
  id              uuid primary key default gen_random_uuid(),
  item_code       text unique,                       -- QR/識別子（任意。将来QR運用で必須化）
  name            text not null,                      -- 例: マキタ18Vバッテリー
  category        miniapps_tools.item_category not null default 'tool',
  tracking_type   miniapps_tools.tracking_type not null,
  -- 数量管理時の在庫基準（individual では null）
  is_active       boolean not null default true,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
  -- ※ current_holder / current_location / status は持たない（罠A）
);
comment on table  miniapps_tools.items is 'モノのマスタ。工具/資材の「種類」。個体は individual_units、状態は View で導出。';
comment on column miniapps_tools.items.tracking_type is 'individual=番号で個体管理 / quantity=数量管理。units と movements の使い方を分岐させる。';

-- A-2. individual_units : 個体（tracking_type='individual' のみ）
--   「マキタ18Vバッテリー 7,8,9,10番」の各番号が1行。
create table if not exists miniapps_tools.individual_units (
  id           uuid primary key default gen_random_uuid(),
  item_id      uuid not null references miniapps_tools.items(id) on delete cascade,
  unit_number  integer not null,                      -- 例: 7, 8, 18
  is_active    boolean not null default true,         -- 廃棄/紛失で false（削除はしない）
  notes        text,
  created_at   timestamptz not null default now(),
  unique (item_id, unit_number)                       -- 同一工具内で番号は一意
  -- ※ ここにも status を持たない（罠A）。所在は movements から導出。
);
comment on table miniapps_tools.individual_units is '個体ユニット。バッテリー#7 等。番号は item 内で一意。状態カラムは持たない。';

-- A-3. locations : 保管場所（MVPは倉庫＋現場の最小）
--   MVP方針：専用テーブルは持つが運用は「倉庫」+ projects 連携で最小。
create table if not exists miniapps_tools.locations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,                          -- 例: 本社倉庫
  kind        text not null default 'warehouse',      -- warehouse / site（現場はprojectと連携）
  project_id  uuid,                                   -- 現場の場合 platform.projects(id) を参照（疎結合のためFK制約は将来付与）
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);
comment on table miniapps_tools.locations is '保管場所。MVPは倉庫中心。現場は project_id で platform.projects と疎結合。';

-- ============================================================================
-- B. TRANSACTION（コト＝移動イベント。SSOT・append-only）
-- ============================================================================

-- B-1. item_movements : ヒト×モノ×コトの結節点。所在・状態の唯一の真実。
create table if not exists miniapps_tools.item_movements (
  id              uuid primary key default gen_random_uuid(),

  -- モノ（個体なら unit_id、数量なら quantity を使う。排他はCHECKで担保）
  item_id         uuid not null references miniapps_tools.items(id),
  unit_id         uuid references miniapps_tools.individual_units(id),  -- individual時のみ
  quantity        integer,                                              -- quantity時のみ

  -- コト（どうした）
  movement_type   miniapps_tools.movement_type not null,

  -- どこ（from/to）。checkout は to=現場, return は to=倉庫 が基本。
  from_location_id uuid references miniapps_tools.locations(id),
  to_location_id   uuid references miniapps_tools.locations(id),
  project_id       uuid,                               -- 現場（platform.projects と疎結合）

  -- ヒト（holder=実際の保持者, moved_by=入力者）。「大内くん持出をしょーやが入力」を区別。
  holder_id       uuid,                                -- platform... employees(id) を参照（疎結合。将来FK付与）
  moved_by        uuid,                                -- 同上。入力者。

  -- いつ／メモ
  moved_at        timestamptz not null default now(),
  source          text not null default 'caaf',        -- caaf / quick_return / manual / line / image（将来）
  confidence      numeric(3,2),                         -- CaaF抽出の確信度ログ（自動登録判定の運用分析用）
  notes           text,
  created_at      timestamptz not null default now(),

  -- 個体/数量の排他制約：individual なら unit_id 必須・quantity null、
  --                       quantity   なら quantity 必須・unit_id null
  constraint chk_individual_xor_quantity check (
    (unit_id is not null and quantity is null)
    or
    (unit_id is null and quantity is not null)
  )
);
comment on table  miniapps_tools.item_movements is 'コト＝移動イベント。所在・状態の唯一の真実。append-only。UPDATE/DELETE禁止（訂正は打消しイベントを足す）。';
comment on column miniapps_tools.item_movements.holder_id is '実際の保持者。投稿者と異なる場合あり（例:大内くん）。';
comment on column miniapps_tools.item_movements.moved_by  is '入力者。holder と分離して代理入力を表現。';
comment on column miniapps_tools.item_movements.confidence is 'CaaF抽出確信度のログ。自動登録(Phase1)の安全性分析に使う。状態判定には使わない。';

-- 最新行を高速に引くためのインデックス
create index if not exists idx_mv_unit_latest on miniapps_tools.item_movements (unit_id, moved_at desc);
create index if not exists idx_mv_item_latest on miniapps_tools.item_movements (item_id, moved_at desc);
create index if not exists idx_mv_holder      on miniapps_tools.item_movements (holder_id, moved_at desc);
create index if not exists idx_mv_project     on miniapps_tools.item_movements (project_id, moved_at desc);

-- ============================================================================
-- C. ACTIVITY（導出 View。罠A回避の実体。状態はここでのみ計算する）
-- ============================================================================

-- C-1. v_unit_current_status : 個体ごとの「現在の所在・保持者・状態」
--   movements の最新行から導出。checkout 系なら持出中、return/倉庫なら在庫。
create or replace view miniapps_tools.v_unit_current_status as
with latest as (
  select distinct on (unit_id)
    unit_id, item_id, movement_type, to_location_id, project_id,
    holder_id, moved_by, moved_at
  from miniapps_tools.item_movements
  where unit_id is not null
  -- id desc を tiebreaker に置く（同 timestamp 時の非決定性を排除）
  order by unit_id, moved_at desc, id desc
)
select
  u.id            as unit_id,
  u.item_id,
  i.name          as item_name,
  u.unit_number,
  -- 状態を「最新イベント種別」から動的に導出（カラムではない）
  case
    when l.movement_type in ('checkout','transfer') then 'out'   -- 持出中
    when l.movement_type = 'return'                  then 'in'    -- 在庫
    else 'in'
  end             as current_status,
  l.project_id    as current_project_id,
  l.holder_id     as current_holder_id,
  l.moved_at      as last_moved_at,
  -- 経過日数（返却漏れ可視化用。閾値判定はアプリ側）
  case when l.movement_type in ('checkout','transfer')
       then extract(day from (now() - l.moved_at))::int end as days_out
from miniapps_tools.individual_units u
join miniapps_tools.items i on i.id = u.item_id
left join latest l on l.unit_id = u.id
where u.is_active;
comment on view miniapps_tools.v_unit_current_status is '個体の現在状態を movements 最新行から導出。罠A回避の中核。一覧/返却UIの源。';

-- C-2. v_item_quantity_status : 数量モノの現在在庫（将来の資材用。inbound-outbound等で集計）
create or replace view miniapps_tools.v_item_quantity_status as
select
  i.id as item_id, i.name,
  coalesce(sum(
    case m.movement_type
      when 'inbound'  then m.quantity
      when 'return'   then m.quantity
      when 'outbound' then -m.quantity
      when 'checkout' then -m.quantity
      else 0 end
  ), 0) as on_hand_quantity
from miniapps_tools.items i
left join miniapps_tools.item_movements m on m.item_id = i.id and m.quantity is not null
where i.tracking_type = 'quantity'
group by i.id, i.name;
comment on view miniapps_tools.v_item_quantity_status is '数量モノの現在在庫。MVPでは器のみ（運用はPhase2資材）。';

-- C-3. v_currently_out : 「いま持出中」一覧（UIの一覧/返却の主データ）
create or replace view miniapps_tools.v_currently_out as
select
  s.unit_id, s.item_id, s.item_name, s.unit_number,
  s.current_project_id, s.current_holder_id, s.last_moved_at, s.days_out
from miniapps_tools.v_unit_current_status s
where s.current_status = 'out';
comment on view miniapps_tools.v_currently_out is '現在持出中の個体一覧。一覧(自分軸)・クイック返却の源。holder_idで自分軸フィルタ。';

-- ============================================================================
-- D. RLS（Row Level Security）
--   MVP方針：社内全員が閲覧・登録可。将来 Platform ロールで精緻化。
--   重要：返却=movementのINSERTで表現。実体の更新削除はさせない（append-only担保）。
-- ============================================================================

alter table miniapps_tools.items            enable row level security;
alter table miniapps_tools.individual_units enable row level security;
alter table miniapps_tools.locations        enable row level security;
alter table miniapps_tools.item_movements   enable row level security;

-- 認証ユーザーは参照可
create policy p_items_read   on miniapps_tools.items            for select using (auth.role() = 'authenticated');
create policy p_units_read   on miniapps_tools.individual_units for select using (auth.role() = 'authenticated');
create policy p_loc_read     on miniapps_tools.locations        for select using (auth.role() = 'authenticated');
create policy p_mv_read      on miniapps_tools.item_movements   for select using (auth.role() = 'authenticated');

-- コトの追加（持出/返却）は認証ユーザーに許可
create policy p_mv_insert    on miniapps_tools.item_movements   for insert with check (auth.role() = 'authenticated');

-- append-only 担保：movements の UPDATE/DELETE ポリシーは作らない＝禁止。
--   訂正は「打消しイベント」を新規 INSERT して表現する。

-- マスタ編集（items/units/locations の登録・更新）はMVPでは認証ユーザー可。
--   将来 admin ロールに絞る。
create policy p_items_write  on miniapps_tools.items            for insert with check (auth.role() = 'authenticated');
create policy p_items_update on miniapps_tools.items            for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy p_units_write  on miniapps_tools.individual_units for insert with check (auth.role() = 'authenticated');
create policy p_units_update on miniapps_tools.individual_units for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy p_loc_write    on miniapps_tools.locations        for insert with check (auth.role() = 'authenticated');

-- ============================================================================
-- E. updated_at 自動更新トリガ（items のみ）
-- ============================================================================
create or replace function miniapps_tools.set_updated_at()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

drop trigger if exists trg_items_updated on miniapps_tools.items;
create trigger trg_items_updated before update on miniapps_tools.items
  for each row execute function miniapps_tools.set_updated_at();

-- ============================================================================
--  END. 統合時の接続ポイント（メモ）
--   - holder_id / moved_by → platform.employees(id) に FK を将来付与
--   - project_id           → platform.projects(id)  に FK を将来付与
--   - アクティビティフィード → item_movements を時系列で読むだけ（追加テーブル不要）
--   - 資材統合             → category='material' + tracking_type='quantity' で同テーブル運用
-- ============================================================================
