# 計算的センサー

決定論的で高速な検証。1分以内に完了する制約。L1 自己検証 / layer1-independent-reviewer 双方が参照する。

## ビルド
- コマンド: `pnpm run build`
- 成功条件: exit code 0、`.next/` 配下に成果物生成
- 制約: 1分以内

## 型チェック
- コマンド: `pnpm run typecheck`（`tsc --noEmit`）
- 成功条件: エラー 0 件
- 制約: `tsconfig.json` で `strict: true`、`noUncheckedIndexedAccess: true`

## リンター / フォーマッタ
- コマンド: `pnpm run lint`（Biome）
- 成功条件: エラー 0 件（warning は許容）
- 制約: 30秒以内

## Unit テスト
- コマンド: `pnpm run test`（Vitest）
- 成功条件: 全件 PASS（テスト0件でも framework 起動成功で OK、scaffold 段階）
- 制約: 1分以内

## Gherkin 不変条件チェック
- コマンド: `pnpm run test:invariants`（vitest + cucumber-feature ローダ）
- 入力: `spec/invariants.feature`
- 成功条件: 全 Happy / Sad / Evil シナリオが期待通り PASS / FAIL
- 制約: 1分以内

## 罠A 違反検出（grep ベース）

### 1. items / individual_units に status カラム追加検出
```bash
rg --type sql 'alter\s+table\s+miniapps_tools\.(items|individual_units)\s+add\s+column\s+(status|current_holder|current_location)' supabase/
```
- 期待: 検出件数 0
- 違反時: 罠A 違反、`spec/invariants.feature` Sad シナリオ 1 が fail

### 2. item_movements への UPDATE/DELETE policy 検出
```bash
rg --type sql 'create\s+policy\s+\S+\s+on\s+miniapps_tools\.item_movements\s+for\s+(update|delete)' supabase/
```
- 期待: 検出件数 0
- 違反時: append-only 違反、`spec/invariants.feature` Sad シナリオ 2/3 が fail

### 3. service_role 経由の DELETE FROM item_movements 検出
```bash
rg 'delete\s+from\s+miniapps_tools\.item_movements|DELETE\s+FROM\s+miniapps_tools\.item_movements' src/ scripts/ 2>/dev/null
```
- 期待: 検出件数 0
- 違反時: append-only 違反

### 4. DESIGN.md トークン外の HEX リテラル混入検出
```bash
# DESIGN.md の YAML フロントマターに定義された HEX 以外が src/ にあるか
rg --type tsx --type ts --type css '#[0-9a-fA-F]{3,6}\b' src/ | \
  grep -v -F -f .lint-design-token-allowlist 2>/dev/null
```
- 期待: 検出件数 0
- 違反時: DESIGN.md トークン参照経由でないスタイリング、独立検証で reject

### 5. confidence ベース自動 INSERT 検出（D-4 違反）
```bash
rg 'confidence\s*[<>=]+\s*[0-9.]+\s*[)&|]+\s*await\s+\w*[iI]nsertMovement|if\s*\(.*confidence.*\)\s*\{\s*\w*\.?insertMovement' src/
```
- 期待: 検出件数 0
- 違反時: Phase 0 違反、ADR + Council 諮問必須

### 6. items テーブルへの直接 status 参照（罠A 補助検出）
```bash
rg 'item(s)?\.status|item(s)?\.current_holder|item(s)?\.current_location' src/
```
- 期待: 検出件数 0
- 違反時: View 経由でない状態参照、罠A 違反

### 7. SSOT 整合チェック（DDL ↔ Zod）
- コマンド: `pnpm run check:ssot`
- 内容: `supabase/migrations/0001_init_miniapps_tools.sql` のカラム名（snake_case）と `spec/domain.ts` のフィールド名（camelCase）の整合
- 期待: 全カラムが対応

## DESIGN.md トークン一貫性検査

### YAML 定義キー vs Markdown `{...}` 参照の整合
```bash
# 未定義参照（Markdown 内 {colors.X} のうち YAML に存在しないキー）
# 未使用定義（YAML 内 colors.X のうち Markdown から参照されないキー）
pnpm run check:design-tokens
```
- 期待: 未定義参照 0、未使用定義は warning のみ

## E2E（critical 機能対象）

Priority `critical` 機能（F1〜F4）は第 2 層 E2E を必ず通す。
- コマンド: `pnpm run test:e2e`
- 入力: `sensors/e2e/scenarios.md` を実装した Playwright tests
- 成功条件: 全シナリオ PASS、`delivery/screenshots/` にスクショ保存

## Interaction Cost 測定

UX Must 閾値の機械測定（第 3 層）。
- コマンド: `pnpm run test:interaction-cost`
- 入力: `sensors/interaction-cost/thresholds.md` の閾値
- 成功条件: 全閾値 PASS（クリック数 / 応答時間 / 遷移深度）

## WCAG コントラスト比

DESIGN.md `## Do's and Don'ts` のアクセシビリティ要件。
- コマンド: `pnpm run test:a11y`（Lighthouse Accessibility / axe-core）
- 成功条件: WCAG AA 違反 0 件（コントラスト比 4.5:1 以上）
