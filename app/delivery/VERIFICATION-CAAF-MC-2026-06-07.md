# VERIFICATION.md — CaaF gen-2 M-C（tools db Adapter）

## 判定: PASS

独立検証（実装コンテキスト隔離）。成果物を再読込し、FW Don't 実装を grep + 構造で確認、計算的センサーを独立再実行した。
対象仕様: `spec/caaf-migration.md` §6 M-C / §4 / `packages/caaf-core/SPEC.md` §8。体制: M2 / autonomous / LC=1。

---

## 仕様合致（§6 M-C 受け入れ基準）

| 基準 | 結果 | 独立確認 |
|---|---|---|
| getSchema 実装 | PASS | `getSchema()` → `TOOLS_FIELDS`（CaaFField[]） |
| read 実装（alias→ILIKE） | PASS | `resolve-item`: alias 完全一致 → items ILIKE → 候補 + units + v_currently_out 持出状態。Layer C は明示的に未実装（提起 1） |
| write 実装（既存 Supabase 移植） | PASS | `recordToMovementInput` → `buildMovementRows` → `insertMovement`（既存 append-only helper 再利用） |
| **罠A/D-1/D-7/D-11/D-3 を test で固定** | PASS | `tools-mapping.test.ts` 13 件で各 Don't を固定（下表） |
| **pnpm purity 緑** | PASS | `packages/caaf-core` 無変更、purity 独立再実行で緑 |

## FW Don't（コード + テストで担保）

| Don't | 結果 | 独立確認 |
|---|---|---|
| 罠A（状態カラム書かない） | PASS | mapping は INSERT 行のみ生成。`current_holder`/`current_status`/`.set(`/UPDATE/DELETE への書き込みなし（grep: コメント以外ヒットなし） |
| D-1（append-only） | PASS | `buildMovementRows` は常に行を push（`movementType=action`）。永続化は `insertMovement`（UPDATE/DELETE 非提供）に委譲 |
| D-7（holder≠moved_by） | PASS | `holderId = checkout ? (holderId ?? movedBy) : null`、`movedBy: input.movedBy` を別に保持（test: 明示 holder / フォール / return=null） |
| D-11（二重持出拒否） | PASS | `checkout && currentHolderId` → エラーで行を作らない。return は拒否しない（test 2 件で固定） |
| D-3（confidence は log のみ） | PASS | `MovementRow.confidence` にのみ載る。`recordToMovementInput` は log 用に item field の confidence を拾うのみ。採否ロジックに不使用（test: 低 confidence でも行数不変） |

## 動作・整合確認（独立再実行）

| 観点 | 結果 |
|---|---|
| app typecheck（createToolsAdapter が Core CaaFAdapter 型を満たす） | PASS |
| caaf-config vitest 33 件（うち tools-mapping 13） | PASS |
| biome（新規ファイル） | PASS（clean） |
| next build（8 ページ） | PASS |
| Core純度（purity） | PASS（Core 無変更） |

## サーバーサイド隔離（設計原則 4）

`import "server-only"` は **`llm.ts` + `tools-adapter.ts` のみ**（grep 確認）。純データ/純関数 `tools-fields.ts` / `tools-mapping.ts` は server-only・Supabase 非依存（33 テストが jsdom 下で PASS = 実証）。DB 結線は tools-adapter に隔離。

## スコープ妥当性

M-C = Adapter 実装 + 純写像 + test のみ。tools CaaFApp 定義（M-D）/ host UI（M-E）には未着手。`app/src` 変更は caaf-config のみ（`item_movements` 台帳・migration・View・RLS 無変更）。

## 提起（非 FAIL）

### 提起 1（Layer C 未実装の明示）
migration §4 の read は「alias → ILIKE → Layer C」。M-C は alias→ILIKE（決定的解決）まで実装し、Layer C（LLM 意味マッチング）は**明示的に未実装**（コード・adapter コメントに記載）。M-C 完了条件（Don't の test 固定 + purity）には Layer C は含まれないため PASS。Layer C は M-E で M-B の Extractor / 曖昧性提示と組み合わせるのが妥当。

### 提起 2（write の partial-success 意味論）
`write()` は行ごとに `insertMovement` し、一部 DB 失敗時は `success:true` + `error` 併記で返す（append-only ゆえ挿入済みは事実として残る）。gen-1 の `insertedCount + errors` と同型で妥当。**host（M-E）は `success:true` でも `error` を必ず surface すること**（申し送り）。

### 提起 3（D-11 の鮮度は read 時点に依存）
D-11 判定は read() 解決時の `currentHolderId` に基づく。read→write 間に他者が持出すと TOCTOU の隙がある（gen-1 と同型）。SPEC の「並行 INSERT は楽観的並行制御で OK」方針と整合するため PASS だが、M-E では write 直前に units を再解決すると堅牢（refinement 申し送り）。

## 履歴整合性（LC=1）
ADR-007 §6 ロードマップ M-C に一致。過去 INTENT 矛盾・廃止機能回帰・却下案再実装：なし。罠A/D-1〜D-12 の既存方針を Adapter 内で維持（回帰なし）。

## 最終判定

**PASS** — §6 M-C 受け入れ基準（Don't の test 固定 + purity 緑）を独立確認。提起 3 件はいずれも M-E への申し送り / スコープ確認であり差戻し事由ではない。
