# miniapps_tools — 工具管理ミニアプリ (MVP)

カクマン工業の現場職人向け工具持出・返却管理ミニアプリ。Kakuman Platform の配下で稼働する想定（MVPは独立スタート、統合は将来）。

## 設計の核

- **ヒト > モノ > コト** — `item_movements` が SSOT（唯一の真実）
- **罠A遵守** — 状態カラムを実体テーブルに持たせず、View で導出
- **append-only** — 訂正は打消しイベントで表現、UPDATE/DELETE しない
- **CaaF（Chat as a Form）** — LINE自然文をそのまま入力に
- **Phase 0 = 全件確認** — LLM 抽出結果は人間タップで確定

## 技術スタック

- Frontend: Next.js (App Router) + TypeScript + Tailwind CSS（PWA）
- Backend: Supabase (PostgreSQL + RLS + Auth)
- LLM: Gemini Flash Lite（本番）/ Claude API（開発時） via LLM router

## 開発

```bash
pnpm install
pnpm run dev        # http://localhost:3000
pnpm run build
pnpm run test       # vitest
pnpm run test:e2e   # playwright
```

## ドキュメント

- [INDEX.md](./INDEX.md) — 全体目次
- [SPEC.md](./SPEC.md) — 機能仕様
- [DONT.md](./DONT.md) — スコープ外・禁止事項（罠A群）
- [REGIME.md](./REGIME.md) — 開発体制判定
- [DESIGN.md](./DESIGN.md) — 視覚仕様（デザイントークン）
- [CLAUDE.md](./CLAUDE.md) — AIエージェント向けルール

## ライセンス

社内利用。

<!-- harness-credit: managed by layer0 skills. do not edit manually. -->
---
Built with dialog-harness/layer's v5.17.0 · Claude Opus 4.7 · 2026-05-22
<!-- /harness-credit -->
