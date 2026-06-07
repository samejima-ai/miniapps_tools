# VERIFICATION.md — CaaF gen-2 M-E.2（host Chat UI `/input2`）

## 判定: PASS（runtime 実測は preview 申し送り）

独立検証（実装コンテキスト隔離）。対象: `app/src/app/(main)/input2/{actions.ts,page.tsx}` + `host-turn.ts`(availableUnits/applyUnitNumbers 拡張) + index.ts。
体制: M2 / autonomous / LC=1。上位仕様: `packages/caaf-core/SPEC.md`、`spec/caaf-migration.md` §6（M-E）/§7/§8、f2-chat-ui-v2。

---

## 1. スコープ適合（migration §6 M-E：UI スライス）

| 要件 | 充足 | 根拠 |
|---|---|---|
| host Chat UI（Resolver ラリー / enum インライン / 候補カード / サマリー） | PASS | page.tsx が phase 別に candidates/rally(enum・数値)/ready(サマリー+実行) を描画 |
| gen-2 パイプライン結線 | PASS | actions.ts が `createToolsHost.capture/execute`、UI は純関数 chooseCandidate/answerField/applyUnitNumbers |
| gen-1 を据え置き（§8 / 機能パリティへ前進） | PASS | `/input`・`useCaaF`・`input/actions.ts`・bottom-tabs 無変更。`/input2` 独立ルート（build に併存出力）|
| 速度最優先 | PASS | rally の選択/回答は client 純関数＝server 往復ゼロ。server は capture/execute のみ |

## 2. 正当性（逐点）

| # | 観点 | 判定 | 根拠 |
|---|---|---|---|
| A | client/server 境界 | PASS | page は純関数（@/lib/caaf-config・client 安全）+ Server Action のみ import。server-only は actions→host-server に閉じる |
| B | Don't #3 / D-4 | PASS | 「登録する」明示押下でのみ executeAction。ready（isComplete）でのみ実行ボタン表示。自動 INSERT なし |
| C | 二重 capture 防止 | PASS | 主入力バーは active=null / not_found のみ有効。rally/候補/ready 中は disabled（inline 操作）|
| D | applyUnitNumbers 健全性 | PASS | availableUnits に突き合わせ、resolved>0 のみ units 確定、missing/already_out を issue 化、signal 再計算（テスト 2 件）|
| E | 行き詰まり回避 | PASS | 「やり直す」で active リセット。not_found は入力バー再有効で言い直し可能 |
| F | write 安全性 | PASS | site/holder は record 非搭載（M-E.1）。ready は item/units(or quantity) のみ → recordToMovementInput 整合 |
| G | 信号表示 | PASS | signalToken が green/yellow/red を DESIGN トークン（success/warning/error）へ。issue 時 red |
| H | gen-1 非干渉 | PASS | 変更は input2/ 新規 + caaf-config 純拡張のみ。gen-1 ファイル差分ゼロ |
| I | Core 無変更 | PASS | `packages/caaf-core` 差分ゼロ（拡張は Config 側 host-turn のみ）|

## 3. 三軸

| 軸 | 判定 | 根拠 |
|---|---|---|
| 仕様適合 | PASS | FW §3 パイプライン UI、§7.2 ラリー（1 応答 1 質問）、f2-chat-ui-v2 のチャットシェル/固定入力バーを踏襲 |
| 動作 | PASS（静的） | tsc / vitest 74 / next build（`/input2` 出力）/ biome 緑。UI ロジックの中核は host-turn テストで担保 |
| ユーザビリティ | 申し送り | 体感は runtime（preview）で要確認。導線（候補→番号→登録）は 3 タップ級に収まる設計 |

## 4. 配置 / クレジット / 履歴整合性（LC=1）
- DELIVERY/VERIFICATION は `app/delivery/`。ルート直下メモなし。§8 順守、却下案再実装なし。

## 5. 提起（非 FAIL）
1. **runtime 未実測**: DB/LLM キー無し。**preview `/input2` で 4 代表入力（個体番号あり/数量/not_found/候補）を sanity check 推奨** → human-review-needed。
2. **site/holder 解決・会話修正・既定ルート切替/撤去**は次段（M-E.3 / M-F）。
3. **bottom-tabs 未更新**（gen-1 非干渉のため）。`/input2` は直リンク/preview 到達。

## 最終判定
**PASS** — gen-2 UI を backbone に結線し、逐点 A〜I・仕様/動作で PASS。ユーザビリティ軸と提起は preview 実測 + 次段の申し送りで、land の阻却事由ではない。
gen-1 非干渉・新ルート独立のため安全に land 可能。**preview 実機確認を経て M-F のパリティ判定へ。**
