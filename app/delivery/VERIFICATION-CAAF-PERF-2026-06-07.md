# VERIFICATION.md — gen-1 CaaF 入力フロー 高速化（behavior-preserving 性能リファクタ）

## 判定: PASS（runtime 実測は preview 申し送り）

独立検証（実装コンテキスト隔離）。`git diff -w`（空白無視）で論理デルタを抽出し、behavior 等価性を逐点照合した。
対象: `app/src/app/(main)/input/actions.ts`（gen-1・LIVE）。体制: M2 / autonomous / LC=1。

---

## 論理デルタ（whitespace-ignored diff で確認、diff の大半は再インデント）

1. `resolveAgainstMaster`: `for (const item of extraction.items)` 直列 → `Promise.all(extraction.items.map(async item => {...}))` 並列。
2. 3 つの終端 `resolved.push(X)`(+`continue`) → `return X`（candidates_proposed / not_found / matched）。
3. 未使用 `const unitMap` 削除（dead code）。
4. `extractAction`(本番/demo) と `clarifyAction`: 直列 `resolveAgainstMaster`→`resolveProjectFromSite` → `Promise.all([...])`。

**論理デルタは上記のみ**（-w diff に他の変更なし）。

## behavior 等価性（逐点）

| # | 観点 | 判定 | 根拠（独立確認） |
|---|---|---|---|
| A | 出力等価 | PASS | `Promise.all(items.map(...))` は入力順を保持 ⇒ `resolved[i]` は `items[i]` の解決で push 順と同一。3 分岐が返すオブジェクトは元の push 対象とフィールド完全一致（-w diff で本文不変を確認）。 |
| B | 取りこぼし無し | PASS | `resolveAgainstMaster` 内に `resolved.push` 残存ゼロ（-w diff で 3 件全て return 化）。stray `continue` ゼロ（残る continue は `augmentNotFoundWithCandidates`/`confirmCheckoutAction` の既存ループ、本変更対象外）。typecheck PASS = ループ外 continue 無し。 |
| C | 並行安全 | PASS | item 間で共有可変状態なし（各 item が独自 ResolvedItem を生成）。alias `use_count` UPDATE は同名重複時のみ楽観的 race（analytics のみ、correctness 無影響、SPEC「並行 INSERT は楽観的並行制御で OK」と整合）。 |
| D | 案件並列の独立性 | PASS | `resolveProjectFromSite`（`extraction.site` のみ参照、独自 public/tools client）と `resolveAgainstMaster`（`extraction.items` のみ参照）は共有状態なし。`signal` 計算は両解決後で順序不変。 |
| E | Don't 非接触 | PASS | 変更は read 解決のみ。`confirmCheckoutAction`（write/INSERT/append-only/D-7/D-11）は無変更。罠A/D-3/D-5 非接触。 |
| F | NUL バイト | 既存 | working tree と origin/master ともに NUL=1（本変更由来でない既存アーティファクト）。 |

## 仕様適合 / 動作 / ユーザビリティ（3 軸、refactor-intent-map 不在につき意図軸スキップ）

| 軸 | 判定 | 根拠 |
|---|---|---|
| 仕様適合 | PASS | F2 CaaF 抽出の解決出力を不変に保ちつつ、UX Must「LLM 応答 p95 5 秒以内」(SPEC F2) の達成に寄与。Layer C（2回目 LLM）は不変だが、その手前の N+1 直列待ちと案件直列を除去。 |
| 動作 | PASS（静的） | app typecheck / next build（8 ページ）/ biome(actions.ts) clean。behavior 等価は機械的変換 + -w diff で担保。 |
| ユーザビリティ | PASS | UI フロー・カード・候補提示は不変（体験は同じで速くなる）。利用者の主訴「遅い」に直接対応。 |

## 配置規則 / クレジット
- VERIFICATION.md は `app/delivery/` 配下。ルート直下作業メモ混入なし。クレジット該当変更なし。

## 履歴整合性（LC=1）
SPEC F2 UX制約「LLM 応答 p95 5 秒以内」を**補強**する方向。過去 INTENT との矛盾・廃止機能回帰・却下案再実装：なし。

## 提起（非 FAIL）

### 提起 1（runtime 実測の申し送り）
DB/LLM キーが本環境に無いため wall-clock 実測は未実施。behavior 等価は機械的変換 + 静的検証で担保済だが、**preview で sanity check（代表入力数件で「同じ結果」かつ「体感が速い」）を推奨**。LIVE 経路につき human-review-needed 妥当。

### 提起 2（次段の最適化余地、任意）
さらなる高速化候補（本 PR スコープ外）: ①item 内の units+currently_out を Promise.all 化 ②alias/ILIKE/units/out/employees の `.in()` バッチ化（N+1 → 定数） ③Layer C（not_found 時の 2 回目 LLM）の遅延/オンデマンド化。gen-2 の M-C `read()` にも同最適化を織り込むと一貫。

## 最終判定

**PASS** — 論理デルタは behavior-preserving と逐点確認（A〜F）。3 軸 PASS。提起 2 件は preview 実測の申し送りと将来最適化であり差戻し事由ではない。LIVE 経路ゆえ human-review-needed で人間の preview 確認を経て merge を推奨。
