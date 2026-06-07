# VERIFICATION.md — CaaF gen-2 M-B（Extractor / IntentClassifier 注入実装）

## 判定: PASS

独立検証（実装コンテキスト隔離）。成果物を再読込し、計算的センサーを独立再実行、FW 原則を grep + 構造で確認した。
対象仕様: `spec/caaf-migration.md` §6 M-B / `packages/caaf-core/SPEC.md` §6・§7.1。体制: M2 / autonomous / LC=1。

---

## 仕様合致（§6 M-B 受け入れ基準）

| 基準 | 結果 | 独立検証 |
|---|---|---|
| IntentClassifier（L0.3）実装 | PASS | `createIntentClassifier(): IntentClassifier`。7 種を分類（buildIntentPrompt が 7 intent を列挙）、parseIntentResponse が enum 検証 |
| Extractor（L1）実装 | PASS | `createExtractor(): Extractor`。schema 駆動プロンプト + parseExtraction |
| Intent 7 種分類 | PASS | INTENTS 配列 = add/correct/remove/execute/cancel/reroute/out_of_scope。不正値は add フォール |
| add 時のみ抽出のコスト分岐 | PASS（建付け） | Intent は temperature 0（軽量・決定的）、Extract は別呼び出し（temperature 0.1）。per-turn の add-only ゲートは Core `intentNeedsExtraction` + host ループ（M-E）で実現。M-B は注入実体まで（提起 1） |
| unit test | PASS | extractor 10 + intent 8 = 18 件、独立再実行で全 PASS |

## 動作・整合確認（独立再実行）

| 観点 | 結果 |
|---|---|
| app typecheck（factories が Core の Extractor/IntentClassifier 型を満たす） | PASS |
| caaf-config vitest 18 件 | PASS（@caaf/core も app vitest で解決） |
| biome lint（新規 7 ファイル） | PASS（clean） |
| next build（型チェック含む production） | PASS（8 ページ） |

## FW 原則 / DONT

| 検査 | 結果 | 根拠（独立確認） |
|---|---|---|
| 設計原則 2 / D-5（抽出のみ・生成禁止） | PASS | `parseExtraction`: `if (value === null) continue`（absent/不正を省く、創作なし）。`parseIntentResponse`: 不正 intent→add、value 空→undefined（値創作なし） |
| Don't #1（schema 外フィールド生成禁止） | PASS | `parseExtraction` は `for (const field of app.schema)` で schema を反復 → 外部キーは構造的に混入不能 |
| 設計原則 4（サーバーサイド LLM） | PASS | `import "server-only"` は **llm.ts のみ**（grep 確認）。純関数 extractor.ts/intent.ts は server-only 非依存（jsdom 下で 18 テスト PASS が実証）。factories.ts が llm を結線し server 境界に隔離 |
| D-3（confidence は表示・ログのみ） | PASS | confidence は CaaFFieldValue.confidence に格納のみ。状態/自動判定に未使用 |
| Core純度 | PASS | `packages/caaf-core` 無変更。caaf-config は Config 側（固有名詞 OK） |
| 罠A / append-only | 非接触 | `git status app/src` = caaf-config のみ。台帳・View・migration・RLS 無変更 |

## 型契約

`createExtractor(): Extractor` / `createIntentClassifier(): IntentClassifier` は Core の注入インターフェースを返り値型注釈で宣言。app typecheck PASS により、両ファクトリの実体が Core の契約（引数・返り値）を厳密に満たすことが型で保証される。

## スコープ妥当性

M-B = 注入実装（純関数 + server ファクトリ）+ unit test のみ。host UI 連結（M-E）/ db Adapter（M-C）/ tools CaaFApp 定義（M-D）には未着手。`_wiring-check.ts`（M-A プレースホルダ）を実利用で置換。**スコープ過大なし**。

## 提起（非 FAIL）

### 提起 1（スコープ境界の明確化）
「add 時のみ抽出」の **per-turn ゲートループ自体は M-B に含まれない**（Core `intentNeedsExtraction` + host の Engine ループ = M-E）。M-B は (a) 2 つの独立注入関数、(b) Intent=低温/Extract=別呼び出し、というコスト分離の **建付け**を提供する。これはマイルストン境界として正しい（migration §6: M-B=注入実装 / M-E=host 連結）。FAIL ではなくスコープ確認。

### 提起 2（テスト到達範囲）
LLM 呼び出し（factories の async 本体）は非決定的・API キー依存のためユニットテスト対象外。M-B の「動く」は純関数（プロンプト生成・パース）+ 型契約レベルで担保。実 LLM 挙動の end-to-end 検証は M-E（host 連結）/ 手動で行う。これは LLM 結線の一般的境界であり妥当。

## 履歴整合性（LC=1）
ADR-007 §6 ロードマップ M-B に一致。過去 INTENT 矛盾・廃止機能回帰・却下案再実装：なし。

## 最終判定

**PASS** — §6 M-B 受け入れ基準を全て独立確認。FW 原則（抽出のみ / Don't #1 / サーバーサイド LLM 隔離）を grep + 構造 + テストで検証。提起 2 件はいずれもマイルストン境界の確認であり差戻し事由ではない。
