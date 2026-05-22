# miniapps_tools — 工具管理ミニアプリ MVP

> Kakuman Platform 配下のミニアプリ。現場職人が工具を **簡単・早く・正確に** 入出力できることを目的とする。
> 統合先 Platform への接続は将来。本MVPは独立稼働（kakuman-fleet-v2方式）でスタートする。

## 目的
LINEグループでの自然文運用を殺さず、裏で構造化して**実態の所在・状態を正確に把握**できる現場入力アプリを提供する。入力速度と精度が最重要。

## 機能一覧
- F1 ユーザー識別（社員選択） → 詳細: SPEC.md#F1
- F2 CaaF入力（自然文→構造化→確定登録） → 詳細: SPEC.md#F2
- F3 一覧表示（自分軸デフォルト・フィルタ／検索） → 詳細: SPEC.md#F3
- F4 クイック返却（モード切替・複数選択一括返却） → 詳細: SPEC.md#F4
- F5 信号色UI（確信度×参照一致での確認カード） → 詳細: SPEC.md#F5
- F6 マスタ管理（items / individual_units / locations 最小） → 詳細: SPEC.md#F6
- F7 経過日数の可視化（返却漏れ検知の補助） → 詳細: SPEC.md#F7

## スコープ外
→ DONT.md

## 開発体制
→ REGIME.md

## 開発環境
→ CLAUDE.md, .claude/skills/, sensors/

## 視覚仕様（UIプロジェクトのため必須）
→ DESIGN.md

## 構造化サブフェーズ成果物
→ spec/subphase-manifest.md（domain.ts / api-signatures.ts / state-machine.ts + state-diagrams.md / authz-matrix.md / invariants.feature）

## データモデルSSOT
- DDL: supabase/migrations/0001_init_miniapps_tools.sql（PostgreSQL構文検証済み・SSOT優先順位 `.ts > .sql > .md`）
- 状態は実体テーブルに持たず、**View（v_unit_current_status / v_currently_out / v_item_quantity_status）から導出**する（罠A遵守）

## ARC
monolith（単一デプロイ単位、Supabase + Next.js App Router）
