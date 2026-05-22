# L0 サブフェーズ選定記録

> **注**: Phase 1 時点では本ファイルが選定結果の唯一の記録先。
> Phase 2 で `regime-assessment.md` 改訂時に REGIME.md に統合される予定（pre-official 規約）。

## 選定日
2026-05-22

## 選定モード（L0 サブフェーズ）

| サブフェーズ | 判定 | モード | 理由 | 確度 |
|---|---|---|---|---|
| L0-1 業務意図 | 起動済み | — | SPEC.md / DONT.md / DESIGN.md 生成済み | — |
| L0-2 ドメインモデル | 起動 | **完全** | DDL 存在（Supabase PostgreSQL）+ Zod併走でLLM抽出結果検証 / API I/O 検証に意義あり | 確定 |
| L0-3 API 契約 | 起動 | **簡易** | 外部公開API は Phase 2 候補。MVP は内部API のみ（Next.js Server Actions + Supabase Client） | 確定 |
| L0-4 状態遷移 | 起動 | **完全** | Gate → 2タブ → モード切替（閲覧/返却）の 5 状態以上、CaaFカードのライフサイクル含む | 確定 |
| L0-5 認可 | 起動 | **簡易** | MVPは認証ユーザー一律。Platform統合フェーズで OpenFGA 化候補 | 確定 |
| L0-6 不変条件 | 起動 | — | 4 サブフェーズ起動による自動判定。罠A・append-only・holder≠moved_by を Gherkin で機械可読化 | 確定 |

## 実行順

L0-1 → L0-2 → (L0-3 ‖ L0-4) → L0-5 → L0-6

## 基本 5 問の回答記録

- **S1 データ保存・DB使用？**: YES（Supabase PostgreSQL、item_movements が append-only な台帳）
- **S2 外部API連携？**: YES（LLM router 経由で Gemini Flash Lite / Claude API、+ Supabase Auth/REST）
- **S3 画面数・遷移の複雑度？**: 4画面構成（Gate / 入力 / 一覧 / 一覧返却モード）+ CaaFカードの内部ライフサイクル
- **S4 マルチユーザー・権限差？**: マルチユーザー（社員 10〜30人）、MVPは権限差なし（認証一律RLS）、将来Platform統合で Role 化想定
- **S5 時間/承認での自動状態変化？**: 弱（`days_out` の計算のみで自動遷移なし、Phase 0 は全件人手確認）

## 成果物一覧

- `spec/domain.ts` — L0-2 ドメインモデル（Zod + TypeScript）
- `spec/api-signatures.ts` — L0-3 API契約（簡易モード、関数シグネチャのみ）
- `spec/state-machine.ts` — L0-4 状態遷移（XState v5）
- `spec/state-diagrams.md` — L0-4 Mermaid 図
- `spec/authz-matrix.md` — L0-5 認可マトリクス（簡易モード）
- `spec/invariants.feature` — L0-6 層間不変条件（Gherkin Happy/Sad/Evil）

## 事後変更ログ

| 日付 | 変更内容 | 理由 |
|---|---|---|
| — | — | — |
