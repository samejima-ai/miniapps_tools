-- ============================================================================
-- 0006_lost_found_views.sql
--
-- v_unit_current_status を lost/found 対応に更新 + v_lost_units を新設。
-- 0005 で追加した enum 値を view 内で参照する。
-- ============================================================================

-- v_unit_current_status: lost / found を考慮した case 文に置換
create or replace view miniapps_tools.v_unit_current_status as
with latest as (
  select distinct on (unit_id)
    unit_id, item_id, movement_type, to_location_id, project_id,
    holder_id, moved_by, moved_at
  from miniapps_tools.item_movements
  where unit_id is not null
  order by unit_id, moved_at desc, id desc
)
select
  u.id            as unit_id,
  u.item_id,
  i.name          as item_name,
  u.unit_number,
  case
    when l.movement_type = 'lost'                    then 'lost'  -- 紛失中
    when l.movement_type in ('checkout','transfer')  then 'out'   -- 持出中
    when l.movement_type in ('return','found')       then 'in'    -- 在庫
    else 'in'
  end             as current_status,
  l.project_id    as current_project_id,
  l.holder_id     as current_holder_id,
  l.moved_at      as last_moved_at,
  case when l.movement_type in ('checkout','transfer')
       then extract(day from (now() - l.moved_at))::int end as days_out,
  -- 紛失後の経過日数（紛失中表示用）
  case when l.movement_type = 'lost'
       then extract(day from (now() - l.moved_at))::int end as days_lost
from miniapps_tools.individual_units u
join miniapps_tools.items i on i.id = u.item_id
left join latest l on l.unit_id = u.id
where u.is_active;
comment on view miniapps_tools.v_unit_current_status is
  '個体の現在状態を movements 最新行から導出。in/out/lost。罠A回避の中核。';

-- v_currently_out: 既存通り out のみ（lost は含めない）
create or replace view miniapps_tools.v_currently_out as
select
  s.unit_id, s.item_id, s.item_name, s.unit_number,
  s.current_project_id, s.current_holder_id, s.last_moved_at, s.days_out
from miniapps_tools.v_unit_current_status s
where s.current_status = 'out';

-- v_lost_units: 紛失中の個体一覧
create or replace view miniapps_tools.v_lost_units as
select
  s.unit_id, s.item_id, s.item_name, s.unit_number,
  s.current_project_id, s.current_holder_id, s.last_moved_at, s.days_lost
from miniapps_tools.v_unit_current_status s
where s.current_status = 'lost';
comment on view miniapps_tools.v_lost_units is
  '紛失中の個体一覧。/lost ページ・統計用。発見時は found イベント INSERT で復帰。';
