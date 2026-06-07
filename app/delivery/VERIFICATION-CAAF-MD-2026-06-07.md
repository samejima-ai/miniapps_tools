# VERIFICATION.md — CaaF gen-2 M-D（工具 CaaFApp 定義 + tracking_type 条件付き必須 overlay）

## 判定: PASS

独立検証（実装コンテキスト隔離）。対象: `app/src/lib/caaf-config/{tools-app.ts, tools-app.test.ts, tools-adapter.ts(getSchema), index.ts}`。
体制: M2 / autonomous / LC=1。上位仕様: `packages/caaf-core/SPEC.md`、`spec/caaf-migration.md` §3/§6（M-D 完了条件「schema 駆動で Resolver ラリーが回る」）。

---

## 1. スコープ適合（migration §3 / §6 M-D）

| 要件 | 充足 | 根拠 |
|---|---|---|
| 工具 CaaFApp 定義（§3 概形） | PASS | `toolsApp` が id/name/context/schema/dont/adapter/routing を備え Core `CaaFApp` を型充足（tsc PASS） |
| schema は M-C `TOOLS_FIELDS` 再利用 | PASS | `schema: TOOLS_FIELDS`（参照同一）。M-C 依存を素直に satisfy |
| tracking_type 条件付き必須 overlay | PASS | `toolsAppForTracking` が individual→units必須/quantity除外、quantity→quantity必須/units除外 |
| schema 駆動 Resolver ラリーが回る（完了条件） | PASS | Core 純関数 + effective app で item→units/quantity の順にラリーが進み isComplete に至る（テスト 5 件） |

## 2. 正当性（逐点）

| # | 観点 | 判定 | 根拠 |
|---|---|---|---|
| A | overlay の required 切替 | PASS | individual で `units.required=true`・quantity 不在、quantity で `quantity.required=true`・units 不在（テスト 2 件で固定） |
| B | 他フィールド不変 | PASS | action(必須+default=checkout)/item(必須 reference)/site・holder(optional) は両 tracking で不変（テスト） |
| C | 純粋性（副作用なし） | PASS | `toolsAppForTracking` は `TOOLS_FIELDS.filter(...).map(...)` で新配列を生成し `{...toolsApp, schema}` を返す。ベース `toolsApp` 不変をテストで確認 |
| D | 混在防止 | PASS | 無関係フィールドを schema から除外 → Core `sanitizeRecord`/`dropForeignFields` が record からも落とす（個体に数量・数量に番号が混ざらない） |
| E | Don't #2（必須未充足では write しない） | PASS | individual で units 空なら `missingRequired` に units、`isComplete=false`（テスト）。overlay により units/quantity も schema で表現可能に |
| F | getSchema overlay 後方互換 | PASS | `target` が "individual"/"quantity" のときのみ overlay、その他（"checkout"/""）は従来 `TOOLS_FIELDS`。M-C の既存挙動を破壊しない |
| G | Core純度 | PASS | `pnpm purity:core` 緑。`packages/caaf-core` 無変更。固有名詞は Config 側（tools-app.ts）に閉じる |
| H | server-only 非依存 | PASS | tools-app.ts は純データ/純関数（server-only import なし）。`index.ts`（client/test 安全）から再エクスポート。14 テストが jsdom で PASS = 実証 |

## 3. 三軸（仕様適合 / 動作 / ユーザビリティ）

| 軸 | 判定 | 根拠 |
|---|---|---|
| 仕様適合 | PASS | FW spec §4.1（CaaFApp 形）/ §7.2（Resolver ラリー = 1 応答 1 質問）/ migration §3 の概形に一致。tracking 条件付き必須を Config overlay で表現（§3 注記どおり） |
| 動作 | PASS | tsc / vitest 48（tools-app 14）/ next build 8 ページ / biome clean。ラリー進行はテストで end-to-end 実証 |
| ユーザビリティ | PASS | item 解決後に「番号 or 数量」の一方だけを過不足なく尋ねる導線が schema で確定。誤って両方/無関係を尋ねない |

## 4. Don't / 安全
- read/write・台帳・migration・View・RLS 非接触。罠A/D-1/D-7/D-11/D-3 は M-C に保持され無変更。
- D-5/D-11 を `toolsApp.dont` に LLM 注入用ソフト制約として明文化（FW spec §10.2）。
- running app 未 import = 実挙動ゼロ影響（UI 連結は M-E）。

## 5. 配置規則 / クレジット / 履歴整合性（LC=1）
- DELIVERY/VERIFICATION は `app/delivery/` 配下。ルート直下メモ混入なし。
- 過去 INTENT との矛盾・廃止機能回帰・却下案再実装なし。M-A〜M-C の積み上げを素直に継続。

## 6. 提起（非 FAIL）
1. **getSchema の target 多義性**: `target` を operation（"checkout"）と tracking（"individual"）の双方に使う形。
   SSOT は純関数 `toolsAppForTracking` であり、M-E はそちらを直接使えば曖昧さは生じない（getSchema は便宜 API）。
2. **2 App 目までは Router 非点灯**: keyword スコアは粗く、単一 App では LLM スコアラ前提（migration §1）。本 PR の Router テストは Core の写像が正しいことの固定に留め、運用点灯は資材統合 Phase 2 で。

## 最終判定
**PASS** — migration §3/§6 M-D の要件（CaaFApp 定義 + tracking 条件付き必須 + schema 駆動ラリー）を充足。
逐点 A〜H・三軸ともに PASS。提起 2 件は M-E への設計申し送りであり差戻し事由ではない。
