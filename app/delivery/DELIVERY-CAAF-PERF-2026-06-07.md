# DELIVERY.md — gen-1 CaaF 入力フロー 高速化（behavior-preserving 性能リファクタ）

## 体制情報
- Mode: M2 / LC=1 / dev_mode: autonomous / scope: full
- 種別: 性能リファクタ（gen-1 LIVE 経路）。利用者の主訴「だいぶ遅い」への即効対応
- ブランチ: `claude/caaf-gen1-perf`（利用者明示許可で M-C の PR #18 と分離。base=master）
- 自律修正回数: 0 / 上限 3（biome format のみ）

## 背景
gen-1（LIVE）の CaaF 入力 `extractAction` は、抽出 LLM の後に `resolveAgainstMaster` が
**各 item を直列**で解決し、さらに `resolveProjectFromSite` を**直列**で待っていた（N+1 直列待ち）。
速度が最重要との要請に対し、behavior を変えずに直列待ちを除去する。

## 変更（`app/src/app/(main)/input/actions.ts` のみ）
1. `resolveAgainstMaster`: item 解決を `for` 直列 → `Promise.all(items.map(...))` 並列。各分岐の `push`+`continue` を `return` に置換（出力順は map が保持）。
2. 未使用 `const unitMap` 削除（dead code）。
3. `extractAction`（本番/demo）/ `clarifyAction`: `resolveAgainstMaster` と `resolveProjectFromSite` を `Promise.all` で並列化（互いに独立）。

論理デルタは上記のみ（`git diff -w` で確認）。diff の大半は map callback 化に伴う再インデント。

## 期待効果
- N 件入力の解決レイテンシ ≈ 直列(Σ) → 並列(max 1 件相当)。案件照合も重畳で除去。
- 抽出 LLM（1 回）と Layer C（not_found 時の 2 回目 LLM）は不変＝AI 往復回数は変えていない。
  さらなる高速化（units+out の item 内並列 / `.in()` バッチ化 / Layer C 遅延）は次段候補。

## 自己検証
| 層 | 対象 | 結果 |
|---|---|---|
| Shift Left | behavior 等価性（`git diff -w` 逐点） | PASS |
| 第1層 計算的 | app typecheck / biome(actions.ts) clean | PASS |
| 第2層 ビルド | `next build`（8 ページ） | PASS |
| 第4層 推論的 | 「仕様に合う・動く」= 解決出力不変・UX Must「p95 5秒以内」に寄与 | PASS（静的） |
| 第5層 独立検証 | layer1-independent-reviewer | PASS（`VERIFICATION-CAAF-PERF-2026-06-07.md`） |

## Don't 非接触
read 解決のみの変更。`confirmCheckoutAction`（write/INSERT/append-only/D-7/D-11）・罠A・D-3・D-5 は無変更。

## 提起 / 申し送り
1. **runtime 実測未実施**（DB/LLM キーが本環境に無い）。behavior 等価は機械的変換＋静的検証で担保。**preview で代表入力数件の sanity check（同結果＋体感速度）を推奨** → human-review-needed。
2. NUL バイト 1 個は origin/master と同数＝既存（本変更由来でない）。
3. 次段最適化（任意）: ①item 内 units+out 並列 ②alias/ILIKE/units/out/employees の `.in()` バッチ化 ③Layer C 遅延/オンデマンド化。gen-2 M-C `read()` にも織り込み推奨。

## opt-in/opt-out 判定（§7.5）
- **opt-in（`human-review-needed`）**: LIVE 経路（実利用される core 解決）の変更。behavior 等価だが runtime 未実測のため、preview 確認を経て merge する安全側に倒す。

## 追補（Copilot review #19 対応）
1. **同時実行の上限化**: 上限なし `Promise.all` は items 数次第で DB 同時接続が膨らむため、`mapLimit(items, RESOLVE_CONCURRENCY=6, fn)`（順序保持）に変更。typical 入力（数件）は全並列、巨大入力でも 6 並列に抑制。
2. **alias use_count の race 解消**: 並列内の read-then-write race（同名 alias の重複出現で undercount）を排除。alias ヒットを並列中に in-memory 収集（JS push は race-free）し、並列完了後に id 単位で加算回数を合算して 1 回ずつ UPDATE → 直列時と同一の決定論的加算。

## 体制事後評価
M2 妥当。LIVE コードの behavior-preserving 性能改善は独立検証（`git diff -w` 等価照合）が有効に機能。Copilot の LIVE 信頼性 2 指摘（unbounded 並列 / alias race）も同 PR 内で解消。L2 閾値未接近。
