# VERIFICATION.md — CaaF gen-2 M-E.1（host 会話エンジン backbone）

## 判定: PASS

独立検証（実装コンテキスト隔離）。対象: `app/src/lib/caaf-config/{host-turn.ts, host-turn.test.ts, host-server.ts, tools-mapping.ts(拡張), tools-adapter.ts, index.ts, server.ts}`。
体制: M2 / autonomous / LC=1。上位仕様: `packages/caaf-core/SPEC.md`、`spec/caaf-migration.md` §2/§6（M-E）/§7/§8。

---

## 1. スコープ適合（migration §6 M-E の第 1 スライス）

| 要件 | 充足 | 根拠 |
|---|---|---|
| gen-1 `useCaaF` 相当を Core 駆動で再構成 | PASS | `host-turn.ts` が capture→候補分岐→tracking切替→rally→ready→confirm を Core 純関数で実装 |
| Resolver ラリーが schema 駆動で回る | PASS | M-D の `toolsAppForTracking` を effective app に採用し `nextRequiredField/isComplete` で進行（テスト 6 件） |
| gen-1 を到達可能に保つ（§8） | PASS | gen-1 ファイル・新ルートとも無変更/未追加。running app 未 import |
| backbone-first の妥当性 | PASS | UI runtime 検証不可な本環境で、純粋判断を 69 テストで固定するのは妥当なリスク低減 |

## 2. 正当性（逐点）

| # | 観点 | 判定 | 根拠 |
|---|---|---|---|
| A | pure/server 分離 | PASS | host-turn は @caaf/core + 純 Config のみ import（server-only 無し）。69 テストが jsdom で PASS＝実証。host-server のみ `server-only` |
| B | 候補分岐 0/1/N | PASS | `applyItemCandidates`: 0→not_found+issue、1→確定解決、N→candidates（各テスト） |
| C | tracking 切替の健全性 | PASS | individual→quantity 除外 / quantity→units 除外を `sanitizeRecord(effectiveApp)` で実施（テストで field 不在を確認） |
| D | units 解決 | PASS | `resolveRequestedUnits` が resolved/missing/alreadyOut を分離（直接 test 3 + 間接）。missing/already_out を issue 化 |
| E | **空 units 充足バグの是正** | PASS | Core `hasValue([])=true` による ready 化を、解決個体ありの時のみ units 確定する修正で回避（テストが回帰を固定） |
| F | site/holder の write 安全性 | PASS | 未解決名を record へ入れず `pendingRefs` 退避（テスト: site/holder field が record に不在、pendingRefs に保持） |
| G | Don't #1/#2/#3 | PASS | WRITABLE_FIELDS 限定 + sanitize（#1）、ready=isComplete・execute=canExecute（#2）、confirmForExecute=confirmed（#3） |
| H | D-11 の扱い | PASS | host は alreadyOut を **issue 提示のみ**（checkout 限定、return は非提示）。最終的な write 拒否は M-C buildMovementRows（無変更） |
| I | serializability | PASS | HostState は plain data（app/record/candidates/文字列）。関数・クラス非混入＝Server Action 越しに受け渡し可能 |
| J | execute 経路の整合 | PASS | `executeRecord(effectiveApp, confirmed, adapter)`。recordToMovementInput は field 名で読むため individual/quantity いずれでも整合（M-C 仕様）|

## 3. 三軸（仕様適合 / 動作 / ユーザビリティ）

| 軸 | 判定 | 根拠 |
|---|---|---|
| 仕様適合 | PASS | FW spec §3 パイプライン（Capture→Intent→Extract→Validate→Execute）を単一 App 工具向けに結線。§6 M-E の脳部分を満たす |
| 動作 | PASS（静的） | tsc / vitest 69 / next build 8 / biome / purity すべて緑。会話進行は純関数テストで end-to-end 実証 |
| ユーザビリティ | 申し送り | UI は M-E.2。本 PR は脳のみ＝体感は未検証（runtime 不可）。preview 検証は M-E.2 で実施 |

## 4. 配置規則 / クレジット / 履歴整合性（LC=1）
- DELIVERY/VERIFICATION は `app/delivery/` 配下。ルート直下メモ混入なし。
- 過去 INTENT と矛盾なし。§8（gen-1 到達可能維持）を順守。却下案再実装・廃止機能回帰なし。

## 5. 提起（非 FAIL／M-E.2 申し送り）
1. **site/holder の name→id 解決が未実装**。adapter.read の resolve-site/resolve-holder 拡張を M-E.2 で。それまで write に site/holder は載らない（安全側）。
2. **会話中の自由文 correct/remove 未処理**（capture は add 中心、rally は回答/ボタン前提）。M-E.2 で Intent 駆動の修正導線を。
3. **UI ルート未追加**。M-E.2 で `/input2`（gen-1 据え置き）に結線 → Vercel preview で sanity check。
4. **runtime 実測未実施**（DB/LLM キー無し）。判断ロジックは純粋テストで担保済。capture/execute の実 I/O は M-E.2 の preview で確認。

## 最終判定
**PASS** — M-E backbone（Core 駆動の会話エンジン + server 結線）として逐点 A〜J・仕様/動作で PASS。
ユーザビリティ軸と提起 4 件は M-E.2（UI 実装 + preview 検証）への申し送りであり、backbone PR の差戻し事由ではない。
gen-1 非干渉・実挙動ゼロ影響のため安全に land 可能。
