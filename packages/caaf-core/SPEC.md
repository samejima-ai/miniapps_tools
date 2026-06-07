# CaaF — 汎用チャット入力インターフェース定義

**Chat as a Form / Universal Conversational Input Layer**

| | |
|---|---|
| バージョン | 1.0.0 |
| 種別 | 汎用FW定義（単一ファイル・利用者非依存） |
| パッケージ | `@caaf/core` |
| 更新日 | 2026-06-07 |

> 本書は CaaF を**特定の利用者・業務に依存しない汎用FW**として定義する自己完結ドキュメント。具体ドメイン（会計・建設・人事…）は「利用者が注入する設定」であり、本書には固有名詞を含めない。固有の例は §11 に注入例として最小限だけ示す。
>
> **本パッケージ（`@caaf/core`）が Core の実装である。** 各 § とソースモジュールの対応は §13 を参照。

---

## 1. 定義

CaaF は、**自然言語入力（テキスト/音声）を、任意の構造化データストアへの書き込みに変換する汎用入力レイヤー**である。

従来のフォームは「人間がシステムのスキーマに合わせる」。CaaF はこれを逆転し、「システムが人間の意図に合わせてスキーマを埋める」。ユーザーは構造を意識せず、話すだけでよい。

**スコープ**: CaaF が担うのは入力（capture → 構造化 → 書き込み）のみ。データの一覧・編集・業務ロジックは対象外（利用側が持つ）。

---

## 2. 設計原則（不変）

| # | 原則 | 内容 |
|---|------|------|
| 1 | **Core純度** | Core に特定利用者・業務の固有名詞/分岐を含めない。ドメインは外部注入 |
| 2 | **抽出のみ・生成禁止** | LLMは抽出と分類のみ。値を創作・捏造しない。不明は `null` |
| 3 | **確定はユーザー** | 推論値は候補。書き込み確定はユーザーの明示操作のみ |
| 4 | **サーバーサイドLLM** | LLM呼び出しはサーバー側。APIキーをクライアントに出さない。Core は LLM SDK 非依存（分類器/抽出器はインターフェース注入） |
| 5 | **不可逆操作の保護** | 必須未充足では書き込まない。実行は明示トリガーのみ |
| 6 | **文脈完全リセット** | App切替時はチャット履歴・入力データを破棄（復元しない） |
| 7 | **Adapter抽象** | 書き込み先（DB/MCP/Sheets/API…）はAdapterで抽象化 |

---

## 3. アーキテクチャ（7層パイプライン）

```
L0    Capture   入力受け取り（テキスト/音声）
L0.3  Intent    文脈込みで意図分類（高速・軽量モデル）
L0.5  Route     App未確定時、どのAppかを判定（明示/意図ハイブリッド）
L1    Extract   schema準拠で値抽出（中量モデル・intent=add時のみ）
L2    Validate  不足検出・型チェック・制約チェック
L3    Execute   Adapter経由で書き込み（明示トリガーのみ）
L4    Feedback  結果表示
```

**Core / Config 分離**:

```
Core（汎用・固有禁止 = @caaf/core）   Config（固有・Core外 = 利用者プロジェクト）
  Router / Intent / Mapper            App定義（context+schema+dont+routing）
  Resolver / Guards                   Adapter接続設定（getSchema/write/read 実装）
  Adapter Interface                   IntentClassifier / Extractor / RouterScorer 実装
  （UI Components は host 側）    ←inject(CaaFApp[], adapters, llm)── 利用者が結線
```

**2回LLM呼び出しの役割分離**: L0.3意図分類＝高速軽量（毎ターン）、L1抽出＝中量（add時のみ）。execute/cancel/correct等は抽出を回さずコスト効率を保つ（`intentNeedsExtraction`）。

---

## 4. データモデル

実装は `src/types.ts`。

### 4.1 CaaFApp（最上位単位）

1アプリ = スキーマ + コンテキスト + 制約 + 接続 + ルーティングヒント。App切替＝文脈の切替。

```typescript
interface CaaFApp {
  id: string;
  name: string;
  icon?: string;
  context: { role: string; description: string; examples?: string[] };
  schema: CaaFField[];
  dont: string[];                     // App固有の禁止（ソフト制約・LLM注入）
  adapter: { type: "db" | "mcp" | "sheets" | "api" | string; config: Record<string, any> };
  routing: { keywords?: string[]; description: string; priority?: number };
}
```

### 4.2 CaaFField

```typescript
type CaaFFieldType =
  | "string" | "number" | "date" | "datetime"
  | "boolean" | "enum" | "reference" | "array";

interface CaaFField {
  name: string;
  type: CaaFFieldType;
  required: boolean;
  label: string;
  description?: string;     // AIマッピング用ヒント
  options?: string[];       // enum選択肢
  default?: any;
  referenceAdapter?: string;
}
```

### 4.3 CaaFRecord（ランタイム）

```typescript
interface CaaFRecord {
  app: string;
  fields: Record<string, { value: any; confidence: number; source: "ai" | "user" | "default" | "context" }>;
  status: "draft" | "mapped" | "confirmed" | "executed" | "error";
}
```

**ステータス遷移**: `draft → mapped → confirmed → executed`（任意時点からリセットで draft へ）。

---

## 5. Router（L0.5）— ハイブリッド振り分け

実装は `src/router.ts`。Coreは個別Appを知らず、注入された `CaaFApp[]` の `routing` だけで判定する。

| モード | 主体 | 動作 |
|--------|------|------|
| 明示切替 | ユーザー | UIで直接選択。常設・確実 |
| 意図ルーティング | Router | 入力から推定し候補提示→1タップ確定 |

**確信度による分岐**（`routeByScores`）:

```
最高スコア ≥ 高閾値(0.8)  → auto      （「○○として記録」と表示）
中閾値(0.6) ≤ スコア < 高 → candidate （「○○でいいですか？ [はい][別]」）
スコア < 中閾値           → fallback  （明示選択UIへ）
```

スコアは LLM（`RouterScorer`）またはキーワード（`keywordScores`、LLM不要のベースライン）で算出。決定は純関数 `routeByScores`。

---

## 6. Intent（L0.3）— 意図解析

実装は `src/intent.ts`。App確定中の全発話は、抽出の前に意図解析を通る。

| intent | 説明 | L1抽出 |
|--------|------|--------|
| `add` | 新規入力・追記 | 走る |
| `correct` | 既存値の修正 | 不要 |
| `remove` | 値の削除 | 不要 |
| `execute` | 登録指示 | 不要 |
| `cancel` | 全リセット | 不要 |
| `reroute` | 別種別と判明 | 不要 |
| `out_of_scope` | App範囲外 | 不要 |

**出力**: `{ intent, target?, value?, reason? }`。
**原則**: 分類のみ。値を作らない。correct/removeでtarget不明時は add にフォール（`normalizeIntent`）。
分類器 `IntentClassifier` は Config 側（サーバー・軽量モデル）が注入する。

---

## 7. Engine（L1–L2）

### 7.1 Mapper（L1抽出）— `src/mapper.ts`

`intent=add`時、確定Appの`schema`をプロンプトに展開し、スキーマ準拠の JSON 抽出を LLM にさせる。抽出器 `Extractor` は Config 側が注入。`buildRecord` が抽出結果を CaaFRecord にマージ（ユーザー確定値は上書きしない）。

- 書かれていない項目は必ず `null`。創作禁止。enum 該当なしは `null`。相対日付は実日付化。フィールドごとの確信度を返す。
- **マッピング優先順位**: ①明示指定 → ②ドメインスキル推論（Config側）→ ③コンテキスト補完 → ④デフォルト値（`applyDefaults`）。

### 7.2 Validate / Resolver（L2）— `src/validate.ts`, `src/resolver.ts`

不足必須フィールドを会話で1つずつ埋める（純関数 reducer）。

- `validateRecord` が必須未充足・型エラーを検出。
- `nextRequiredField` が schema 順で次の質問1つを返す（1応答1質問）。
- enum型はインライン選択肢、任意フィールドは `skipOptional`。
- `isComplete` で全必須充足→サマリーカード＋実行ボタン。Form UI を開かずラリーだけで完了→実行できる。

### 7.3 信号度スコア — `src/signal.ts`

| 範囲 | Core Signal |
|------|------|
| 0.80–1.0 | green |
| 0.60–0.79 | yellow |
| 0.00–0.59 | red |

Core は 3 色に閉じる（`confidenceSignal`）。`recordSignal` は必須フィールドの最小確信度で律速。利用者ドメインは Config 側で overlay 色を足してよい。

---

## 8. Adapter インターフェース（L3）— `src/adapter.ts`

書き込み先を抽象化。全Adapterが3メソッドを実装。Coreはこのインターフェースだけに依存する。

```typescript
interface CaaFAdapter {
  id: string;
  getSchema(target: string): Promise<CaaFField[]>;
  write(app: CaaFApp, record: CaaFRecord): Promise<{ success: boolean; id?: string | number; error?: string }>;
  read(app: CaaFApp, query?: Record<string, any>): Promise<any[]>;
}
```

`read()` で「前回と同じ値」「マスタから選択」等のコンテキスト補完が可能。

---

## 9. UI 仕様（host 側責務）

Core は UI を持たない（host が実装）。Chat-First 原則・レスポンシブ（Desktop 2ペイン / Mobile 切替）・チャット内インライン要素（enum 選択肢 / スキップ / サマリーカード / Router候補カード / Intent確認カード）は host が Core の純関数 API を読んで描画する。

---

## 10. 制約ポリシー（Don't）

### 10.1 FW-level（共通・ハード制約／コード強制）— `src/guards.ts`

| # | Don't | 強制 |
|---|-------|------|
| 1 | スキーマ外フィールドを生成しない | `dropForeignFields` / `sanitizeRecord` / `canExecute` |
| 2 | 必須未充足で `write()` を呼ばない | `canExecute` / `executeRecord` |
| 3 | ユーザー確認なしに書き込まない | `executeRecord`（status="confirmed" 必須） |
| 4 | 低確信度の推論値を確定扱いしない | `clampConfidence` + source 管理 |
| 5 | 過去履歴を別Appのスキーマに流用しない | App切替で record 破棄（host） |
| 6 | Coreに固有名詞・固有分岐を書かない | `scripts/purity-check.mjs`（grep検証・CI） |

### 10.2 App-level（アプリごと・ソフト制約／LLM注入）

`CaaFApp.dont` に定義しシステムプロンプトへ注入。コード強制せず、LLMへの指示として働く。

---

## 11. 利用方法（注入例）

```typescript
const myApp: CaaFApp = {
  id: "expense", name: "経費登録",
  context: { role: "経費登録アシスタント", description: "経費を1件ずつ登録する場。日付・金額・科目を集める。" },
  schema: [
    { name: "date",   type: "date",   required: true,  label: "日付" },
    { name: "amount", type: "number", required: true,  label: "金額" },
    { name: "account",type: "enum",   required: true,  label: "勘定科目", options: ["旅費交通費","消耗品費","会議費"] },
    { name: "memo",   type: "string", required: false, label: "摘要" },
  ],
  dont: ["税務アドバイスはしない", "経費と無関係な話題は入力に戻す"],
  adapter: { type: "db", config: { table: "expenses" } },
  routing: { keywords: ["経費","支払","購入","交通費"], description: "経費の登録", priority: 1 },
};
// 結線：複数Appを渡せば Router が振り分ける
// <CaaF apps={[myApp, ...]} adapters={{...}} llm={serverSideLLM} />
```

---

## 12. 用語

| 用語 | 定義 |
|------|------|
| CaaF | Chat as a Form。本FW |
| Core | 汎用エンジン（`@caaf/core`）。固有名詞を持たない |
| Config | 利用者固有の設定（App定義・Adapter実装・LLM実装） |
| App | context+schema+dont+adapter+routing の最上位単位 |
| Router (L0.5) | どのAppかを判定 |
| Intent (L0.3) | 文脈込みの意図分類 |
| Mapper (L1) | schema準拠の値抽出 |
| Resolver (L2) | 不足を会話で埋めるラリー |
| Adapter (L3) | 書き込み先の抽象化 |

---

## 13. 実装対応表（§ ↔ モジュール）

| FW § | モジュール | 提供物 |
|------|-----------|--------|
| §4 データモデル | `src/types.ts` | CaaFApp / CaaFField / CaaFRecord / Signal / Confidence … |
| §5 Router | `src/router.ts` | `routeByScores` / `keywordScores` / `RouterScorer`(inject) |
| §6 Intent | `src/intent.ts` | `normalizeIntent` / `intentNeedsExtraction` / `IntentClassifier`(inject) |
| §7.1 Mapper | `src/mapper.ts` | `buildRecord` / `Extractor`(inject) |
| §7.2 Validate | `src/validate.ts` | `validateRecord` / `checkFieldType` |
| §7.2 Resolver | `src/resolver.ts` | `nextRequiredField` / `applyAnswer` / `skipOptional` / `applyDefaults` / `isComplete` |
| §7.3 Signal | `src/signal.ts` | `confidenceSignal` / `recordSignal` |
| §8 Adapter | `src/adapter.ts` | `CaaFAdapter` interface |
| §10.1 Guards | `src/guards.ts` | `sanitizeRecord` / `canExecute` / `dropForeignFields` / `clampConfidence` |
| §3 L3 Execute | `src/execute.ts` | `executeRecord` / `confirmRecord` / `CaaFExecuteBlockedError` |
| §10.1 Don't#6 | `scripts/purity-check.mjs` | Core純度の grep 検証 |

**注入点（Config が実装する 4 つ）**: `CaaFAdapter`（getSchema/write/read）、`IntentClassifier`、`Extractor`、`RouterScorer`。これらにより LLM 呼び出しと DB アクセスは Core 外（サーバー側 Config）に閉じる。

---

## 14. 実装ステータス（v0.1.0 — L0 着手時点）

| 層 | 状態 |
|----|------|
| データモデル（§4） | ✅ 実装・型検査・runtime smoke 済 |
| Validate / Resolver / Signal / Guards（純ロジック） | ✅ 実装・unit test・runtime smoke 済 |
| Router 決定ロジック（`routeByScores` / `keywordScores`） | ✅ 実装・test 済 |
| Intent 正規化 / コスト分岐 | ✅ 実装・test 済 |
| Execute（guards 連動 write） | ✅ 実装・test 済 |
| Adapter / IntentClassifier / Extractor / RouterScorer 実装 | ⏳ Config 側（L1）。tools ドメイン binding は `../../spec/caaf-migration.md` 参照 |
| host UI（Chat-First ラリー UI） | ⏳ L1（gen-1 stroke UI を置換） |

移行ロードマップ（gen-1 → gen-2、工具ドメイン binding）は `../../spec/caaf-migration.md`。
