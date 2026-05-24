-- ============================================================================
-- 0005_lost_found_movements.sql (enum 拡張のみ)
--
-- movement_type に 'lost' / 'found' を追加。
-- ALTER TYPE ADD VALUE は同一トランザクション内で参照できないため、
-- view 更新は別 migration (0006) に分離する。
--
-- 設計原則:
-- - 罠A 維持: 状態カラムを実体テーブルに足さない。状態は View で導出
-- - append-only: 紛失/発見も新規 INSERT。UPDATE/DELETE しない
-- - is_active=false (廃棄) と lost (所在不明) は別概念
-- ============================================================================

alter type miniapps_tools.movement_type add value if not exists 'lost';
alter type miniapps_tools.movement_type add value if not exists 'found';
