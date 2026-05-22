# L0-5 認可マトリクス（簡易モード）

MVP は **認証ユーザー一律のRLS**。OpenFGA 化は Platform 統合フェーズの候補。
本書は将来の精緻化に備えた **ロール × リソース × 操作** のマトリクス雛形。

---

## ロール定義

| ロール | 説明 | MVP / 統合フェーズ |
|---|---|---|
| `anonymous` | 未認証 | 全機能アクセス不可 |
| `authenticated` | Supabase Auth でログイン済の社員 | **MVPの唯一の active ロール** |
| `admin`（将来） | マスタ管理権限を持つ管理者 | 統合フェーズで分離 |
| `holder_of_unit`（将来） | 特定 unit_id の現在保持者 | OpenFGA relation 化候補 |

---

## リソース × 操作（MVP 認可マトリクス）

| リソース | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `items` | ✓ authenticated | ✓ authenticated | ✓ authenticated | ✗ |
| `individual_units` | ✓ authenticated | ✓ authenticated | ✓ authenticated | ✗ |
| `locations` | ✓ authenticated | ✓ authenticated | ✗ | ✗ |
| `item_movements` | ✓ authenticated | ✓ authenticated | **✗ 全ロール禁止** | **✗ 全ロール禁止** |
| View `v_*` | ✓ authenticated（基底テーブルRLSで継承） | — | — | — |

### 重要な禁止項目

- `item_movements` の UPDATE / DELETE は **どのロールも実行不能**（append-only 担保、D-1）
- 物理削除 `DELETE FROM items WHERE ...` は不能（`is_active=false` での論理削除のみ）
- 訂正は新規 INSERT（打消しイベント）で表現

---

## RLS ポリシー（DDL からの抜粋確認）

```sql
-- 認証ユーザーは全テーブル read 可
create policy p_items_read on miniapps_tools.items
  for select using (auth.role() = 'authenticated');
create policy p_units_read on miniapps_tools.individual_units
  for select using (auth.role() = 'authenticated');
create policy p_loc_read on miniapps_tools.locations
  for select using (auth.role() = 'authenticated');
create policy p_mv_read on miniapps_tools.item_movements
  for select using (auth.role() = 'authenticated');

-- INSERT は認証ユーザーに許可
create policy p_mv_insert on miniapps_tools.item_movements
  for insert with check (auth.role() = 'authenticated');

-- マスタ編集は MVP では認証ユーザー一律
create policy p_items_write on miniapps_tools.items
  for insert with check (auth.role() = 'authenticated');
create policy p_items_update on miniapps_tools.items
  for update using (auth.role() = 'authenticated');
create policy p_units_write on miniapps_tools.individual_units
  for insert with check (auth.role() = 'authenticated');
create policy p_units_update on miniapps_tools.individual_units
  for update using (auth.role() = 'authenticated');
create policy p_loc_write on miniapps_tools.locations
  for insert with check (auth.role() = 'authenticated');

-- ※ item_movements の UPDATE / DELETE ポリシーは「作成しない」＝禁止
```

---

## アプリケーションレイヤの追加チェック

RLS は最下層の防御。アプリレイヤでも以下を追加チェックする:

| チェック | 場所 | 内容 |
|---|---|---|
| `holder_id` の整合 | `src/lib/movement/` | INSERT 時に `holder_id` が指定されていることを確認（checkout 時、return 時は null OK） |
| `moved_by = currentUserId` | 同上 | 入力者は常にログイン中ユーザー（クライアント側で偽装不可性は RLS で担保不能のため将来 Edge Function 化候補） |
| 個体/数量の排他 | Zod `ItemMovement.refine` | DB CHECK 制約と二重防御 |

---

## 将来の OpenFGA 化シナリオ（参考、MVP外）

Platform 統合フェーズで以下を導入候補:

```fga
# 概念モデル（雛形、MVPでは実装しない）
type employee
type project
type item
type unit
  relations
    define current_holder: [employee]   # View 経由で計算

# 関係定義
- holder_of_unit: unit.current_holder == employee
- can_return_unit: holder_of_unit OR admin
- can_view_all_units: admin OR project_member
```

これは **Phase 2 候補**。本MVPは認証一律のため OpenFGA は導入しない（DONT.md スコープ外項目）。
