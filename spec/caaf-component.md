# CaaF Component — 設計ドキュメント（gen-1 / 第一世代）

> **ステータス: gen-1（superseded-in-progress）。** 本書は第一世代「ストローク対話モデル」
> （`app/src/lib/caaf/`、単一ドメイン・Router/Intent 層なし）の設計記録。
> 2026-06-07 の L0 対話で **gen-2 汎用FW v1.0.0** への全面書き換えが確定した。
> - gen-2 Core 仕様（利用者非依存）: `packages/caaf-core/SPEC.md`
> - gen-1 → gen-2 移行・工具 binding: `spec/caaf-migration.md`
> gen-1 は移行マイルストン M-F（パリティ検証）まで到達可能なまま残す。本書は履歴として保持。

## 概要

CaaF (Chat as a Form) をドメイン非依存な汎用コンポーネントとして `src/lib/caaf/` に抽出。
工具管理ミニアプリを最初のクライアントとしてリファクタ。
（gen-2 ではこの「ドメイン非依存」意図を `@caaf/core` 別パッケージ + Adapter 抽象 + 多App Router まで深化させる。）

## モジュール構成

```
src/lib/caaf/
├── index.ts        # Public API (re-exports)
├── types.ts        # 汎用型定義 (Signal, StrokePhase, StrokeItem<T>, CaafConfig<...>)
├── use-caaf.ts     # ストローク状態機械フック (useCaaF)
├── llm.ts          # Gemini API ユーティリティ (callGemini, callGeminiJSON)
├── signal.ts       # 汎用信号色判定 (determineSignal)
└── alias.ts        # エイリアス自動学習 UPSERT (learnAlias)
```

## 抽出した 5 層

| 層 | ファイル | 責務 |
|----|----------|------|
| 1. ストローク状態機械 | `use-caaf.ts` | input→extract→review→confirm→done の遷移管理 |
| 2. LLM 抽出パイプライン | `llm.ts` | Gemini API 呼出 + JSON パース + エラーハンドリング |
| 3. 信号色システム | `signal.ts` | confidence × ambiguities → Signal 判定 |
| 4. エイリアス学習 | `alias.ts` | 確認後の alias UPSERT (use_count + last_used_at) |
| 5. ピッカー UI | （ドメイン側） | 候補バッジ・番号バッジ等は StrokeItemCard がドメイン固有実装 |

## 型パラメータ

```typescript
useCaaF<TExtraction, TResolved, TProject = null>(config, userId)
```

| パラメータ | 工具管理での具体型 | 用途 |
|-----------|-------------------|------|
| `TExtraction` | `CaaFExtractionResult` | LLM 抽出結果の型 |
| `TResolved` | `ResolvedItem` | マスタ照合済みアイテムの型 |
| `TProject` | `ResolvedProject` | 案件コンテキスト（省略可） |

## CaafConfig インターフェース

ドメインが実装する設定オブジェクト:

| フィールド | 必須 | 説明 |
|-----------|------|------|
| `extractAction` | ○ | テキスト → 抽出+照合のサーバーアクション |
| `clarifyAction` | △ | 対話修正のサーバーアクション |
| `confirmAction` | ○ | 確定時の永続化アクション |
| `getExtractedName` | ○ | ResolvedItem → 表示名 |
| `makeItemKey` | ○ | ResolvedItem → 一意キー |
| `isConfirmable` | ○ | 確定可能かの判定 |
| `placeholders` | △ | 入力フィールドのプレースホルダー |

## 設計原則の遵守

- **D-5**: LLM は抽出のみ。`callGeminiJSON` はパース専用、補完ロジックなし
- **D-4**: Phase 0 全件確認。`confirmAction` はユーザー確定後にのみ呼出
- **罠A**: 状態カラムなし。`StrokeItem.status` はクライアント側の UI 状態のみ
- **D-1**: alias.ts の UPSERT は alias テーブル対象（item_movements は append-only 維持）
- **SSOT**: 型定義は `spec/domain.ts` が正。caaf/types.ts は汎用層のみ定義

## ドメイン側の責務（工具管理の例）

1. `actions.ts` — サーバーアクション群（extract/clarify/confirm）+ ドメイン固有の照合ロジック
2. `page.tsx` — `TOOL_CAAF_CONFIG` 定義 + UI レンダリング
3. `stroke-item-card.tsx` — `StrokeItem<ResolvedItem>` を受け取るドメイン固有カード
4. `router.ts` — ドメイン固有の `determineSignal` ラッパー（return→red チェック追加）

## 信号色の分担

```
汎用 (caaf/signal.ts):
  items.length === 0     → red
  minConfidence ≥ 0.8    → green
  minConfidence ≥ 0.6    → yellow
  else                   → orange

ドメイン追加 (router.ts / actions.ts):
  action === "return"    → red  (工具管理固有)
```
