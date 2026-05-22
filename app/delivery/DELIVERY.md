# L0 献上物 — 工具管理ミニアプリ MVP

- **献上日**: 2026-05-22
- **献上者**: layer0-spec-architect (Claude Opus 4.7, persona: sheep-navigator)
- **受領者**: layer1-autonomous-dev（または crosscut-issue-implementer 経由）
- **対象ブランチ**: claude/tool-management-mini-app-01kgI
- **配置ルート**: `/home/user/miniapps_tools/app/`

---

## サマリ

カクマン工業の現場職人向け **工具持出・返却管理ミニアプリ (MVP)** の L0 仕様策定・開発環境構築が完了。Kakuman Platform への将来統合を前提に、独立稼働（kakuman-fleet-v2 方式）でスタート。

### 判定結果

- **モード**: **M2 標準モード**（S=4, U=1, R=2, N=3、合計 S+U+R=7、R≥2 で M2 強制）
- **dev_mode**: **autonomous + autonomous_scope: full**（AI 主導でガンガン進める）
- **ARC**: **monolith**（Supabase + Next.js App Router + LLM router の単一サービス）
- **CTL**: 0（新規プロジェクト、council-data 未初期化）
- **persona**: sheep-navigator（default_state: Normal）
- **権限レベル**: L0-2（デフォルト）

### 設計の核

- **ヒト > モノ > コト** — `item_movements` が SSOT
- **罠A 遵守** — 状態カラムを実体テーブルに持たせず、View で導出
- **append-only** — 訂正は打消しイベントで表現
- **CaaF（Chat as a Form）** — LINE 自然文をそのまま入力に
- **Phase 0 = 全件確認** — LLM 抽出結果は人間タップで確定

---

## 生成物一覧

### 中核ドキュメント（A 領域）
- `INDEX.md` — 全体目次
- `SPEC.md` — 機能仕様（F1〜F7、UX 制約、機能間相互作用、データモデル進化）
- `DONT.md` — スコープ外定義（罠A群、D-1〜D-9 を明文化）
- `REGIME.md` — モード判定（M2 + autonomous full + monolith + persona）
- `DESIGN.md` — 視覚仕様（YAML トークン 45 件 + Markdown 本体 + Do's and Don'ts）
- `CLAUDE.md` — エージェント RL
- `README.md` — プロジェクト紹介 + クレジット
- `.gitignore` — 除外設定

### サブフェーズ成果物（L0-2 〜 L0-6）
- `spec/subphase-manifest.md` — 選定記録
- `spec/domain.ts` — Zod + TypeScript ドメインモデル
- `spec/api-signatures.ts` — 内部 API シグネチャ
- `spec/state-machine.ts` — XState v5（AppMachine + CaaFCardMachine）
- `spec/state-diagrams.md` — Mermaid 図
- `spec/authz-matrix.md` — 認可マトリクス（簡易モード）
- `spec/invariants.feature` — Gherkin Happy/Sad/Evil（19 シナリオ）

### センサー
- `sensors/computational.md` — 計算的（ビルド/型/lint/test/grep規約/SSOT整合）
- `sensors/inferential.md` — 推論的（仕様合致/動く/使える/罠A運用)
- `sensors/review-checklist.md` — layer1-independent-reviewer 向け固有観点 16 項目
- `sensors/interaction-cost/thresholds.md` — UX Must 閾値 6 項目
- `sensors/e2e/scenarios.md` — Playwright 8 シナリオ

### scaffold（Next.js App Router）
- `package.json` / `tsconfig.json` / `next.config.ts`
- `tailwind.config.ts`（DESIGN.md トークン展開）/ `postcss.config.js`
- `biome.json` / `vitest.config.ts` / `playwright.config.ts`
- `src/app/layout.tsx` / `src/app/page.tsx` / `src/app/globals.css`
- `public/manifest.webmanifest`

### Supabase migration（SSOT）
- `supabase/migrations/0001_init_miniapps_tools.sql` — 提供 DDL を migration 化（PostgreSQL 構文検証済み）

### ADR
- `history/ARCH-DECISIONS.md` — ADR-001（Next.js 仮確定）/ ADR-002（LLM router）/ ADR-003（スキーマ配置）

### autonomous-drive deployment
- `.github/workflows/auto-merge.yml` — opt-out 反転モデル、`ALLOWED_AUTHORS=claude`
- `.github/workflows/gemini-review.yml` — 工具管理ミニアプリ向けに paths + prompt 調整

### 設定
- `.claude/settings.json` — Permissions + env

---

## L0 自己検証結果

詳細は `delivery/SELF-VERIFICATION-2026-05-22.md` を参照。

| §7.4 検査項目 | 結果 |
|---|---|
| broken reference 検査 | PASS |
| scaffold smoke test | **DEFER**（pnpm install 未実行、L1 着手前必須） |
| DONT 自己照合 | PASS |
| DESIGN.md トークン一貫性 | PASS（未定義参照 0 / 未使用定義は warning） |
| Pre-flight 充足 | PASS（11 リファレンス読了） |
| 受け入れ基準充足 | PASS（with documented defer on #3） |

---

## 人間に申し送る事項（P3 事後確認の素材）

### 1. 確認お願い事項

- **リポジトリ配置**: `/home/user/miniapps_tools/app/` 配下にミニアプリの仕様・実装を集約しました。DH 本体と物理同居・仕様分離する形でよかったか
- **フロントエンドスタック**: Next.js (App Router) で仮確定（ADR-001）。Kakuman Platform 側の標準スタックが明らかになったら ADR-001-v2 で切替可能な作りにしてあります
- **autonomous_scope: full**: auto-merge + gemini-review を `.github/workflows/` に配置済。**GitHub Secrets と Labels は人間による手動セットアップが必要**（下記）

### 2. 人間による手動セットアップが必要なもの

| 項目 | 場所 | 内容 |
|---|---|---|
| Secret `GH_REVIEW_PAT` | Repo Settings → Secrets | Fine-grained PAT（Pull requests: Read+Write） |
| Secret `GEMINI_API_KEY` | 同上 | Google AI Studio（無料 tier） |
| Label `do-not-merge` | Repo Labels | stop ラベル |
| Label `human-review-needed` | 同上 | 同上 |
| Label `pickup-failed` | 同上 | 同上 |

これらは AI が単独でセットアップできないため、P3 のタイミングで人間が実施してください。

### 3. crosscut-autonomous-drive skill 経由の正式 deploy

本セッションでは workflow template を手動 placeholder 置換して配置しましたが、SHA pin や issue-pickup.yml の追加配置は `crosscut-autonomous-drive` skill 経由の正式 deploy が望ましい。後続セッションで実行推奨。

---

## L1 への引き継ぎ

### vertical slice 実装順序（SPEC §9 推奨）

1. **DDL 適用** — `supabase/migrations/0001_init_miniapps_tools.sql` を Supabase に apply、View まで動作確認
2. **マスタ最小投入** — items 数件 + individual_units を投入し、`v_unit_current_status` の戻り値を目視確認
3. **ユーザー識別 (F1)** — Supabase Auth + 社員選択 UI、`currentUserId` を抽象 ID で保持
4. **一覧 (F3, F7)** — `v_currently_out` 読み出し・自分軸フィルタを実装。読みから作る
5. **クイック返却 (F4)** — `movement_type='return'` の INSERT、一覧から消える挙動の確認
6. **CaaF 入力 (F2, F5)** — LLM ルーター + 信号色 UI + checkout INSERT。XState で CaaFCardMachine を駆動

### L1 着手前のチェックリスト

- [ ] `pnpm install` が exit 0
- [ ] `pnpm run typecheck` が exit 0
- [ ] `pnpm run build` が exit 0
- [ ] `pnpm run test` が exit 0（テスト 0 件で OK）
- [ ] GitHub Secrets 2 件設定済
- [ ] GitHub Labels 3 件作成済
- [ ] Supabase プロジェクト作成済 + `.env.local` に URL / anon key 設定済

これらがクリアできなければ L0 へ差し戻し（spec-architect 再起動）。

### L1 自己検証の必須項目

- `sensors/computational.md` の grep 規約全 7 項目
- `sensors/inferential.md` の SPEC 合致 / 動く / 使える の各観点
- `spec/invariants.feature` の Happy/Sad/Evil シナリオが test:invariants で期待通り PASS / FAIL
- `delivery/screenshots/` への Playwright 主要 4 画面のスクショ保存（第 2 層）

### layer1-independent-reviewer の必須参照

`sensors/review-checklist.md` の 16 項目。罠A群 1〜5 のいずれかで違反検出時は即 reject。

---

## クレジット更新ログ

- 2026-05-22: 新規 README.md を生成し、credit-template.md 準拠のクレジットブロック（`<!-- harness-credit -->`）を末尾に挿入。テキスト: `Built with dialog-harness/layer's v5.17.0 · Claude Opus 4.7 · 2026-05-22`

---

## 配置規則違反修復ログ

なし（新規プロジェクトのため）。
