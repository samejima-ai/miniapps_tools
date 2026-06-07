# DELIVERY.md — CaaF gen-2 M-C（tools db Adapter）

## 体制情報
- Mode: M2 / LC=1 / dev_mode: autonomous / scope: full
- マイルストン: M-C（`spec/caaf-migration.md` §6 ロードマップ第 3 段）
- 自律修正回数: 1 / 上限 3（biome format 1 回）

## 実装済み（M-C スコープ = Adapter 実装 + 純写像 + test）
`app/src/lib/caaf-config/`:
- `tools-fields.ts`（純データ）: `TOOLS_FIELDS: CaaFField[]` + `TOOLS_FIELD` 定数（工具入力スキーマ。M-D が再利用）
- `tools-mapping.ts`（純関数）: `recordToMovementInput` / `buildMovementRows`。FW Don't をコードで担保
- `tools-mapping.test.ts`: 13 件。罠A/D-1/D-7/D-11/D-3/個体/数量/エラーを固定
- `tools-adapter.ts`（server-only）: `createToolsAdapter(ctx).getSchema/read/write`。既存 `insertMovement`（append-only）+ `v_currently_out` + items/alias を再利用
- `index.ts` / `server.ts`: 純関数 / adapter を再エクスポート

## 自己検証（5層検出スタック）
| 層 | 対象 | 結果 |
|---|---|---|
| Shift Left 基盤 | migration §6 M-C / §4 / SPEC §8 照合 | PASS |
| 第1層 計算的センサー | app typecheck + vitest 33 件 + biome(new) + purity | PASS |
| 第2層 ビルド機械検証 | `next build`（8 ページ） | PASS |
| 第3層 Interaction Cost | UI 変更なし（M-E 範囲） | N/A |
| 第4層 推論的センサー | 「仕様に合う・動く」= CaaFAdapter 契約充足 + 純写像がテストで動く | PASS |
| 第5層 独立検証 | layer1-independent-reviewer | PASS（`VERIFICATION-CAAF-MC-2026-06-07.md`） |

## FW Don't（test で固定）
- 罠A: INSERT 行のみ生成（状態カラム書かない） / D-1: append-only（insertMovement 委譲、UPDATE/DELETE なし）
- D-7: holder_id（checkout=holderId??movedBy / return=null）≠ moved_by（入力者）
- D-11: checkout で持出中 unit を行生成せずエラー（return は拒否しない）
- D-3: confidence は MovementRow.confidence（log 列）のみ。採否に不使用

## M-E への申し送り（独立検証 提起）
1. **Layer C 未実装**: read は alias→ILIKE（決定的）まで。LLM 意味マッチングは M-E で M-B Extractor / 曖昧性提示と組合せ
2. **partial-success**: `write()` は `success:true` でも `error` 併記しうる（append-only の一部成功）。host は `error` を必ず surface
3. **D-11 鮮度**: 判定は read 時点の持出状態に依存（TOCTOU、gen-1 同型）。write 直前の units 再解決で堅牢化推奨

## 仕様改訂提案（Type C）/ 異常献上（Type D）
なし。

## opt-in/opt-out 判定（§7.5）
- **opt-out（暗黙オート）**: 追加的 Config コード + テストのみ。build-topology / migration / DONT 抵触 / 不可逆操作なし。running app から未 import（UI 連結は M-E）= 実挙動への影響ゼロ。→ ラベル付与せず。

## 体制事後評価
- M2 妥当。M-C は写像ロジックの Don't 担保が肝で、独立検証が grep + テストで有効に機能。
- L2 閾値未接近。次は M-D（tools CaaFApp 定義、M-C の TOOLS_FIELDS を使う）。M-E（host UI）は M-B + M-D + M-C 依存。
