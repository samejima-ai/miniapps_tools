# 開発体制判定

## 判定時のAI能力バージョン
- モデル: Claude Opus 4.7（claude-opus-4-7[1m]）
- 判定日: 2026-05-22

## スコア

- 規模スコア（S）: 4点
- 不確実性スコア（U）: 1点
- リスクスコア（R）: 2点
- NFRスコア（N）: 3点（内訳は下記）
- 合計: 7点（S+U+R、Nは独立軸）

## 判定結果
モード: **M2 標準モード**

L1（autonomous-dev）＋ layer1-independent-reviewer の構成で運用。検証agent本体はLevel A側で持つ。プロジェクト固有の検証観点は `sensors/review-checklist.md` に閉じる。

## dev_mode
- mode: autonomous
- ctl: 0（新規プロジェクト、`~/.claude/council-data/` 未初期化想定。L0 起動時にコールドスタート）
- 判定根拠: GitHub 利用あり、規模 M2、LC=0、ユーザー指示「AI主導でガンガン進める」

## autonomous_scope
- scope: full
- 判定根拠: ユーザー明示選択（「フルオート」相当、Person 責務 P1〜P4 に集約）
- deployment: `crosscut-autonomous-drive` skill による template 適用予定（本 L0 セッション中に `.github/workflows/auto-merge.yml` および `gemini-review.yml` 配置 + label セット作成。詳細は DELIVERY.md を参照）

## persona
- active: sheep-navigator
- override_state: null

（人間発話「羊ペルソナ設定」によりロード。default_state=Normal、State Machine 自動遷移）

## current_focus
- type: architecture（CaaF gen-2 化 / 汎用FW v1.0.0）
- target: CaaF Core 抽出（`packages/caaf-core`）+ 工具 binding 移行
- since: 2026-06-07（旧 focus: 工具管理ミニアプリ機能開発 / 2026-05-22〜、M0 仮運用で一区切り）
- priority: critical

## 判定根拠

### 規模スコアの内訳
- 機能数: 7（F1〜F7）→ 2点
- 画面数: 4（Gate / 入力タブ / 一覧タブ / 一覧返却モード）→ 1点
- 登場人物: 1種（社員=現場職人、認証一律のMVP）→ 0点
- 外部連携: 2（Supabase Auth/DB、LLM router 経由の Gemini Flash Lite / Claude API）→ 1点
- 合計 S = 4点

### 不確実性スコアの内訳
- イメージの明確さ: 細部まで鮮明（DDL構文検証済、UIモック存在、L0_REQ draft 完備） → 0点
- 既知度: kakuman-fleet-v2 という類似ミニアプリの実装方式を継承予定（経験あり） → 0点
- 変更予測: Phase 0 → Phase 1（自動登録）→ Phase 2（資材統合）の継続更新前提 → 1点
- 合計 U = 1点

### リスクスコアの内訳
- 失敗時の影響: 社内本番運用、工具紛失検知の業務リスクあり（金銭規制業界ではない）→ 2点
- 合計 R = 2点

### NFRスコアの内訳
- 性能（P）: CaaF応答 p95 5秒以内、一覧 p95 2秒以内、フィルタ 300ms 以内 → 1点
- 可用性（A）: 業務時間中に必要、停止すると現場入力が止まるが代替手段（LINE）あり → 1点
- セキュリティ（S）: 社内データのみ、PIIなし、決済なし、認証ユーザー一律RLS → 1点
- コンプライアンス（C）: 規制業界外 → 0点
- スケーラビリティ（L）: 10〜30人想定、水平スケール不要 → 0点
- N 合計: 3点

## L2発動閾値チェック
- SPEC.md トークン数: 概算 4k / 15k
- 想定ファイル数: 40〜60 / 80
- 想定総行数: 6〜8k / 10k
- 独立ドメイン数: 1 / 5
- 並行可能サブゴール数: 2〜3 / 3
- L1 1サイクル想定時間: 30分〜1.5h / 2h
- → 超過項目: なし
- → **L2 発動なし**

## オーバーライド適用
- L2発動閾値: 非適用
- U >= 3（L0対話延長）: 非適用
- R >= 2（M2以上強制）: **適用**（M2に収束、結果変わらず）
- N >= 9（モノリス解除強制）: 非適用
- N >= 5（ARC切替推奨）: 非適用
- セキュリティ >= 2（M2強制）: 非適用
- 可用性 = 3（権限レベル記録必須）: 非適用

## ARC
- 選択: **monolith**
- 判断経緯: AI推奨 → 人間確定（NFR が低めで、append-onlyテーブル運用は event-sourcing 親和だが SPEC レベルは monolith で十分。将来 Platform 統合でフェイルオーバー要件が増えれば再評価）
- 根拠: 単一デプロイ単位（Supabase + Next.js App Router + LLM router の単一サービス構成）、NFR L=0（水平スケール不要）、A=1（停止許容性あり）

## 権限レベル
- 権限レベル: L0-2（デフォルト）
- 可用性 A=1 のため明示記録は任意（必須化条件未発火）
- 外部 API 課金上限: Gemini Flash Lite および Claude API は月次予算上限を `.env` で管理（具体額は ADR-002 で確定予定）
- 介入チャネル: C1 / C2 / C3（autonomous_scope: full のため P4 緊急介入は GitHub Issue / PR コメント経由）

## 体制構成
- Layer 0: spec-architect（本セッション）+ persona: sheep-navigator
- Layer 1: 単体（domain= 工具管理ミニアプリ）。layer1-independent-reviewer 常時起動（M2 強制）
- Layer 2: 未発動
- 検証: layer1-independent-reviewer による独立検証 + sensors/review-checklist.md のプロジェクト固有観点

## LC
- LC: LC=1（M0 仮運用で 1 ループ完了。`app/history/ARCH-DECISIONS.md` ほか過去文脈あり）
- 判定根拠: 初期判定 2026-05-22 は LC=0（history 空）。M0 仮運用（DELIVERY / ADR-004〜006）を経て継続開発に入ったため LC=1 へ更新
- 振り返り儀式レベル: 2（30日内・アーキ変更を伴う対話。2026-06-07 の CaaF gen-2 対話で実施。過去 INTENT との矛盾なし＝gen-1 の「ドメイン非依存化」意図の深化と確認）

## 履歴層設定（LC=0 のためデフォルト適用）
- archive 移動年数: 2 年
- 儀式拒否連続警告閾値: 5 回
- 儀式スキップ連続警告閾値: 5 回

## 判定ログ

対話 3 ターンで以下を確定:
1. **配置**: サブディレクトリ `/home/user/miniapps_tools/app/` で開発（DH 本体と物理同居・仕様分離）
2. **規模**: 社内10〜30人想定、単一デプロイ → M2 相当
3. **dev_mode**: autonomous + autonomous_scope: full（「AI主導でガンガン進める」）
4. **技術スタック**（仮確定、ADR-001 で記録）:
   - Frontend: Next.js (App Router) + TypeScript + Tailwind CSS（PWA化）
   - Backend: Supabase (PostgreSQL + RLS + Auth)
   - LLM: Gemini Flash Lite（本番）/ Claude API（開発時）via LLM router
   - Platform 側スタック確定時に再評価
5. **persona**: sheep-navigator（羊ペルソナ設定指示）

## CaaF gen-2 化 再判定（2026-06-07）

判定時 AI 能力バージョン: Claude（claude-opus-4-8）。詳細決定は ADR-007 / `spec/caaf-migration.md`。

### モード再判定
- **M2 維持**。汎用FW化で U（不確実性）は上がるが、v1.0.0 が精密に定義済（U=2 相当）で L0 対話延長（U≥3）には届かない。R=2 維持で M2 強制も従前どおり
- **L2 発動なし**: 独立ドメイン数 = Core（汎用） + 工具 binding ≈ 2（閾値 5 未満）。想定ファイル数も 80 未満。並行可能サブゴール（M-B ‖ M-C）= 2（閾値 3 未満）。Opus 4.8 で M2 + independent-reviewer に吸収可能
- 体制: L1（autonomous-dev）+ layer1-independent-reviewer 継続。Core純度は `pnpm purity`（grep）を計算的センサーに追加

### dev_mode / scope
- 変更なし（autonomous / scope: full）。M-A〜M-F の各マイルストンを PR 単位で land

### スコープ内訳の変化
- 規模 S: Core パッケージ新設で +1 相当（外部連携は不変）。S+U+R ≈ 7→8、M2 域内
- 「入力レイヤーのみの書き換え（台帳・migration・RLS 不変）」によりリスク増分は限定的

### L0 着手成果物（本セッション）
- `packages/caaf-core/` 純ロジック層を実装・型検査・unit test・runtime smoke 済（§14 ステータス参照）
- 残りは L1: ワークスペース化（M-A）/ LLM 注入実装（M-B）/ db Adapter（M-C）/ App 定義（M-D）/ host UI（M-E）/ gen-1 撤去（M-F）
