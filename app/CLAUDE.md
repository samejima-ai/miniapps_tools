# 工具管理ミニアプリ — エージェントルール

## 原則
- SSOT優先順位: `.ts > .sql > .md`。乖離時は **DDL が正**（`supabase/migrations/0001_init_miniapps_tools.sql`）
- 「ヒト > モノ > コト」の設計階層を維持する。`item_movements` がコト = 唯一の真実
- 状態カラムを実体テーブルに持たせない（罠A）。状態は View 経由で導出する
- `item_movements` は append-only。UPDATE / DELETE しない（D-1）
- `holder_id`（保持者）と `moved_by`（入力者）は別カラム（D-7）
- Phase 0 = 全件確認。自動 INSERT ロジックは作らない（D-4）
- DESIGN.md のトークン参照経由でスタイリングする。HEX リテラルを `src/` に直書きしない

## コーディング規約

### TypeScript
- `strict: true`、`noUncheckedIndexedAccess: true`
- Zod スキーマで API 入出力・LLM 抽出結果を検証する（`spec/domain.ts` 参照）
- DB アクセスは Supabase クライアント経由。直接 SQL は migrations と View 定義のみ
- LLM 呼び出しは `src/lib/llm/` 配下の router 経由。直接 SDK 呼び出しを `src/app/` 配下で行わない

### Next.js (App Router)
- Server Components 優先。Client Components は対話的 UI のみ（CaaF入力 / 返却モード切替）
- データ取得は Server Components + `revalidate`。クライアント側 fetch は最小限
- Supabase RLS を信頼。サーバー側で余計な権限チェックを重複しない

### 命名
- ファイル: kebab-case（`item-movement-card.tsx`）
- React コンポーネント: PascalCase（`ItemMovementCard`）
- 関数: camelCase
- DB / 型: snake_case を Zod で camelCase にマッピング

### ファイル構成
```
src/
├── app/               # Next.js App Router
│   ├── (auth)/        # ゲート画面（社員選択）
│   ├── input/         # F2 CaaF入力タブ
│   ├── list/          # F3/F4/F7 一覧タブ
│   └── master/        # F6 マスタ管理（最小）
├── components/        # 共有UIコンポーネント
├── lib/
│   ├── supabase/      # Supabaseクライアント / View読込
│   └── llm/           # LLMルーター（Gemini / Claude 切替）
└── types/             # Zod スキーマ + 型定義（spec/domain.ts と同期）
```

### スタイリング
- Tailwind CSS + DESIGN.md トークン
- `tailwind.config.ts` で DESIGN.md の YAML フロントマターを参照
- HEX リテラル直書きは grep 検査の対象（`sensors/computational.md`）

## 禁止事項

### 罠A群（絶対遵守）
- 実体テーブルに `status` / `current_holder` / `current_location` 等の状態カラムを追加しない
- `item_movements` を UPDATE / DELETE しない（訂正は打消しイベント INSERT）
- 状態判定に `confidence` を使わない（D-3）
- LLM に欠損情報を補完させない（D-5）
- テーブル名を `tools` にしない（D-6）
- `holder_id` と `moved_by` を統合しない（D-7）

### UI
- スワイプ / ロングプレス（D-8）
- 一覧カードの閲覧モードでの誤タップ可能化
- DESIGN.md トークン外の HEX リテラル直書き
- スクロール禁止のフルスクリーン

### LLM
- 自動 INSERT ロジック（Phase 0 は全件確認、D-4）
- LLM 出力 JSON 以外の文章を受理しない（プロンプトで強制）
- 「電動工具全返却」のような曖昧表現を LLM で展開しない

### ストレージ
- Google Workspace を業務データのプライマリ保存先にしない（D-9）
- `localStorage` / IndexedDB に業務データを長期保存しない

## 参照
- 仕様: INDEX.md
- 視覚仕様: DESIGN.md
- 体制: REGIME.md
- スコープ外: DONT.md
- 構造化サブフェーズ: spec/subphase-manifest.md
- センサー: sensors/
- スキル: .claude/skills/

## 検証
- 計算的: sensors/computational.md（型・lint・unit test・grep規約）
- 推論的: sensors/inferential.md（SPEC合致・「動く」「使える」の自己評価）
- レビュー: sensors/review-checklist.md（layer1-independent-reviewer 向け固有観点）
- E2E: sensors/e2e/scenarios.md（Playwright 主要4画面）
- Interaction Cost: sensors/interaction-cost/thresholds.md（UX Must 閾値）
