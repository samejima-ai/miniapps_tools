# VERIFICATION.md — CaaF gen-2 M-F（gen-1 撤去 + gen-2 既定化）

## 判定: PASS（E2E 実機は preview 申し送り）

独立検証（実装コンテキスト隔離）。対象: 撤去差分全体 + 昇格した `/input`（gen-2）+ 退避した `lib/llm/gemini.ts` + importer 更新。
体制: M2 / autonomous / LC=1。**人間 sign-off「M-F実行」受領**（§8 撤去前提条件）。上位仕様: `spec/caaf-migration.md` §6/§8。

---

## 1. スコープ適合（§6 M-F 完了条件）

| 完了条件 | 充足 | 根拠 |
|---|---|---|
| gen-1 stroke + 旧 input path 削除 | PASS | `src/lib/caaf/`（use-caaf/types/index/signal/alias）+ 旧 input/{page,actions} + stroke-item-card/signal-card + dead router.ts 削除 |
| gen-1 参照ゼロ | PASS | 機械 sweep でコード参照ゼロ。残存は設計由来コメントのみ（機能依存なし） |
| 撤去 PR を独立 land | PASS | 本 PR は撤去 + 昇格に限定（機能追加なし） |
| E2E 緑 | 条件付き | tsc/unit/build 緑 + E2E-010 を gen-2 文言に追従。**Playwright 実機は preview で要実行**（本環境にブラウザ無し） |

## 2. 正当性（逐点）

| # | 観点 | 判定 | 根拠 |
|---|---|---|---|
| A | 共有 Gemini の保全 | PASS | `caaf/llm.ts`（callGeminiJSON/isGeminiConfigured）は `/master` notes が使用 → `lib/llm/gemini.ts` へ退避し importer 2 件更新。tsc 解決 |
| B | URL/ナビ不変 | PASS | `/input` のまま中身を gen-2 に置換。bottom-tabs（→/input）無変更。`/input2` 消滅 |
| C | 他ルート無傷 | PASS | build で /list /master /lost / が従前どおり出力。これらは gen-1 stroke に非依存（確認済 sweep） |
| D | 型整合 | PASS | gen-1 actions の export（ResolvedItem 等）の外部 consumer は削除済 component のみ → 撤去で dangling ゼロ。tsc PASS |
| E | dead code 除去の安全性 | PASS | router.ts は import 元ゼロ（sweep 確認）→ 削除で影響なし。signal.ts は router 専用 → 連鎖削除可 |
| F | 不変条件 | PASS | item_movements 書き込み（M-C 経由）・台帳・migration・View・RLS 無変更。罠A/D-1/D-7/D-11/D-3 維持 |
| G | 可逆性 | PASS | 全削除は git 履歴に保全（§8）。revert で gen-1 復帰可能 |
| H | Core 純度 | PASS | packages/caaf-core 無変更。purity 緑 |

## 3. 三軸

| 軸 | 判定 | 根拠 |
|---|---|---|
| 仕様適合 | PASS | §8（パリティ後撤去・可逆）順守。人間 sign-off 取得。gen-2 が唯一の入力経路に |
| 動作 | PASS（静的） | tsc / vitest 79 / next build（/input=gen-2、他ルート健在）/ biome 緑。E2E 実機は申し送り |
| ユーザビリティ | PASS | URL・タブ不変でユーザー導線は維持。入力体験は検証済み gen-2（利用者承認済み） |

## 4. 配置 / 履歴整合性（LC=1）
- DELIVERY/VERIFICATION は `app/delivery/`。M-A〜M-E の積み上げの最終回収。却下案再実装なし。廃止は計画（§8）どおり。

## 5. 提起（非 FAIL）
1. **E2E Playwright 実機未実行**（環境制約）→ preview で実行推奨。撤去によるルート/文言変更は E2E-010 に追従済み。
2. **CLAUDE.md の router 旧記述**（軽微）→ 次回 governance 更新で是正。
3. **learnAlias 未移植** → M-E.4 候補（git 履歴に保全）。

## 最終判定
**PASS** — gen-1 を可逆・安全に撤去し、gen-2 を `/input` 既定に昇格。逐点 A〜H・仕様/動作/ユーザビリティ PASS。
唯一の留保は E2E 実機（環境制約による申し送り）で、撤去差分は静的検証（tsc/build/sweep）で担保済み。
**CaaF v1.0.0 移行ロードマップ（M-A〜M-F）完了。**
