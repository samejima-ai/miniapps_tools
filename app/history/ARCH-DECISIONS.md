# 工具管理ミニアプリ — Architecture Decision Records

軽量 ADR。意思決定の根拠と将来の見直し条件を時系列で記録する。

---

## ADR-001: フロントエンドスタックの仮確定（Next.js App Router）

- **日付**: 2026-05-22
- **状態**: Provisional（仮確定、Platform 側スタック確定時に再評価）
- **決定者**: 人間（L0 対話で「カクマンプラットフォームに合わせた方が良いかな？」と問い返し）+ AI 推定

### 背景

Kakuman Platform の標準フロントエンドスタックが本MVP着手時点で明示されていない。L0_REQUIREMENTS_miniapps_tools.md §6 で「kakuman-fleet-v2方式の独立スタート」と参照されるのみで、技術選定の具体は別途確定する必要がある。

### 決定

**Next.js (App Router) + TypeScript + Tailwind CSS** で仮確定。PWA 化（manifest.webmanifest + service worker は L1 時に判断）。

### 根拠

1. **React 資産の継承**: 提供された UI モック（`caaftoolmockv3.jsx`）が React で書かれており、コンポーネント設計をそのまま流用可能
2. **Supabase との相性**: `@supabase/ssr` パッケージで App Router の Server Components + RLS が綺麗に統合される
3. **PWA 化容易性**: 現場スマホでのインストール運用（オフライン耐性は MVP 範囲外だが将来候補）
4. **Vercel / Cloud Run 両対応**: デプロイ先の自由度を保つ（Platform 統合時にデプロイ先が決まっても傷が浅い）
5. **scaffold-checklist 標準（Vite + React + PWA）からの差分は最小**: Next.js 用に必須生成ファイルを差し替えるのみで smoke test 経路は維持

### 代替案と却下理由

- **Vite + React + PWA**（scaffold-checklist 標準）: scaffold は楽だが、SSR が必要になった時の移行コストが大きい
- **Expo (React Native)**: モバイルネイティブ化の選択肢だが、MVP で必要な PWA だけで現場運用は回せる。ストア配信の運用負荷を MVP に持ち込まない
- **kakuman-fleet-v2 と同じスタック**: スタック詳細が確認できなかったため、後から差替えの傷が浅い選択を優先

### 再評価条件

- Platform 側スタックが確定し、Next.js と異なる場合 → ADR-001-v2 で切り替え判断
- L1 着手後にデプロイ先の制約（Vercel不可など）が判明 → ADR-001-v2
- 6ヶ月運用後の振り返りで SSR 不要が確認された場合 → Vite + React への簡略化を検討

### 影響

- `scaffold/`: Next.js 用に package.json / next.config.ts / src/app/ 構成
- `sensors/computational.md`: ビルドコマンドを `pnpm run build`（Next.js）に統一
- `sensors/e2e/scenarios.md`: baseURL を `http://localhost:3000` に固定（Vite は 5173）

---

## ADR-002: LLM ルーター経由での Gemini Flash Lite / Claude API 切替

- **日付**: 2026-05-22
- **状態**: Accepted
- **決定者**: 人間（L0 対話「Supabase + Gemini Flash Lite (推奨)」選択）+ AI 推定で開発時 Claude API を併設

### 背景

CaaF 入力は LLM 抽出器に依存する。本番運用での Gemini Flash Lite はコスト最適だが、開発時に毎回 Gemini API キーを使う／本番影響を受けるのは避けたい。一方で「LLM router 経由」とすることで、provider 切替時の `src/app/` 配下への影響を局所化したい。

### 決定

`src/lib/llm/router.ts` を抽象層として、`gemini-flash-lite`（本番）と `claude-api`（開発時）を env var `LLM_PROVIDER` で切替可能にする。

### 抽象 API

```typescript
export type LlmProvider = "gemini-flash-lite" | "claude-api";
export type ExtractFromNaturalText = (
  text: string,
  opts?: { provider?: LlmProvider; timeoutMs?: number },
) => Promise<CaaFExtractionResult>;
```

実装は provider ごとに `src/lib/llm/providers/{gemini,claude}.ts` に分離。共通プロンプト（`SYSTEM_PROMPT`）は `src/lib/llm/prompt.ts` で SSOT 管理。

### 根拠

1. **コスト分離**: 開発時の API 料金を Anthropic 月次予算で扱える（Gemini を毎回叩かない）
2. **抽出精度の比較**: 同一プロンプトで両 provider の抽出精度を運用ログで比較可能（D-3 confidence ログ活用）
3. **障害時の冗長性**: 本番で Gemini 障害時に Claude へフォールバックする運用が可能（将来）
4. **Phase 1 自動化判断材料**: 「どの provider なら confidence 分布が安定するか」を実データで判定可能

### 代替案と却下理由

- **Claude API のみ**: 本番運用コスト最適化を優先するため Gemini Flash Lite を本番採用
- **Gemini のみ**: 開発時の毎回 API キー管理／本番影響リスク
- **OpenAI ChatGPT**: 既存社内 LLM router が Gemini / Claude 中心とのこと（L0_REQ §10）。整合性のため候補から外す

### 再評価条件

- 抽出精度の比較で一方が著しく劣る → 単一 provider 化
- Platform 側で別 LLM router が標準採用された → 統合経路に乗り換え
- Phase 1 で自動 INSERT を導入する際の安全性閾値が片方で先に達成された → Phase 1 用 provider を固定

### 影響

- `src/lib/llm/`: router + providers の階層構成
- `.env.example`: `LLM_PROVIDER`, `GEMINI_API_KEY`, `ANTHROPIC_API_KEY` のキーを列挙
- `sensors/inferential.md`: 「LLM router の切替性」を必須チェック項目に追加

---

## ADR-003: スキーマ配置（miniapps_tools 単一スキーマ）

- **日付**: 2026-05-22
- **状態**: Accepted（DDL に依拠した確定）
- **決定者**: 提供 DDL からの追認

### 背景

L0_REQ §6 で「PostgreSQL はドット階層スキーマ不可のため単一スキーマ」と明記。スキーマ名を `miniapps_tools` として確定。

### 決定

- Supabase 上のスキーマ名: `miniapps_tools`
- Supabase の **Exposed schemas** 設定に `miniapps_tools` を追加（デフォルトは `public` のみ）
- 全テーブル・View・関数を `miniapps_tools.*` 配下に配置

### 影響

- `supabase/config.toml`（Supabase CLI 利用時）に `api.schemas = ["public", "miniapps_tools"]` を設定
- `src/lib/supabase/client.ts` で `db: { schema: "miniapps_tools" }` を指定

### 再評価条件

- Platform 統合時に他ミニアプリと **共通テーブル**（employees / projects 等)を扱う場合、`platform` スキーマを追加し外部キー参照

---

## ADR-004: 個体状態に「紛失（lost）」を導入

- **日付**: 2026-05-24
- **状態**: Accepted（M0 仮運用開始時に追加）
- **決定者**: 人間（「紛失することもあるのでその状態を用意する」）+ AI 実装

### 背景

MVP 時点では個体の状態は `in`（倉庫在庫）/ `out`（持出中）の 2 軸だった（罠A 維持で View 導出）。仮運用開始にあたり、現場での実情として「持ち帰り後どこかで紛失」が頻発するため、状態モデルに `lost` を追加する必要が生じた。

### 決定

- `miniapps_tools.movement_type` enum に `lost` と `found` を追加
- View `v_unit_current_status` の case 文を拡張: 最新 movement が `lost` なら `current_status = 'lost'`、`found` なら `'in'` 復帰
- 新ビュー `v_lost_units`（紛失中個体一覧、`days_lost` 付き）
- 罠A 維持: 状態カラムは持たない。すべて movement 履歴から導出
- `is_active=false`（マスタ廃棄）と `lost`（所在不明だがマスタに残る）は別概念

### イベント定義

| movement_type | 意味 | from/to_location | holder_id |
|---|---|---|---|
| `lost` | 紛失報告 | to_location_id = 最後にあった場所（任意） | null |
| `found` | 発見復帰 | to_location_id = 戻し先倉庫（任意、デフォルト事務所・倉庫） | null |

### 根拠

1. **append-only 維持**: 紛失も発見も新規 INSERT。打消しイベントモデル（D-1）と整合
2. **罠A 維持**: 状態カラム追加なし。View 導出で完結
3. **可逆性**: 紛失後に発見した場合 `found` イベントで復帰可能。物理タグが残る運用と整合
4. **廃棄との分離**: マスタの `is_active=false` は管理者判断による撤去。`lost` は現場報告の所在不明。両者をそれぞれの語彙で扱える

### UI 影響

- マスタ → 個体タブ: バッジに状態色（在庫:青 / 持出:黄 / 紛失:赤）+ 経過日数
- 紛失報告: タップで開くポップから場所選択 + 状況メモ
- 新ページ `/lost`: 紛失中一覧 + 発見ボタン（戻し先倉庫選択可）
- 下タブに「🚨 紛失」追加

### 再評価条件

- Phase 2 資材統合時、数量モノにも `lost` を適用する場合（quantity 系の loss / consume 区別）
- 紛失頻度の運用ログから、自動アラート（N日経過で通知）を Phase 1 で実装する場合
- Platform 統合時、`v_lost_units` を Activity Feed に流すかの判断

### 影響ファイル

- `supabase/migrations/0005_lost_found_movements.sql`（enum 拡張）
- `supabase/migrations/0006_lost_found_views.sql`（view 更新 + v_lost_units 新設）
- `src/lib/supabase/lost.ts`（reportLost / reportFound / listLostUnits）
- `src/app/(main)/lost/page.tsx`（紛失専用ページ）
- `src/app/(main)/master/page.tsx`（個体タブの状態色 + ポップ）
- `src/components/bottom-tabs.tsx`（紛失タブ追加）

---

## ADR-005: M0 仮運用での anon ロール書込権限付与

- **日付**: 2026-05-24
- **状態**: Provisional（M3 Platform 統合で撤回予定）
- **決定者**: 人間（明示承認）+ AI 提案

### 背景

仮運用フェーズの認証モデルは Gate 画面で名前タップする方式で、Supabase Auth セッションを持たない。すべての DB 操作は `anon` ロールで実行される。

初期 DDL では `anon` には SELECT のみ付与され、`authenticated` のみ INSERT/UPDATE 可能な設計だった。実際には認証セッションがないため、マスタ追加・notes 生成・CaaF 確定・エイリアス学習・紛失報告などのすべての書込が `permission denied` で失敗していた。

### 決定

migration `0004_grant_anon_master_write.sql` で以下を anon に付与:

| テーブル | 付与 |
|---|---|
| `items` | INSERT, UPDATE |
| `individual_units` | INSERT, UPDATE |
| `locations` | INSERT, UPDATE |
| `item_movements` | INSERT のみ（D-1 append-only 維持） |
| `item_name_aliases` | INSERT, UPDATE |
| `project_name_aliases` | INSERT, UPDATE |

### 根拠

1. **仮運用モデルとの整合**: URL を知る人が使える「身内レベルの模擬認証」と一致
2. **規模リスクの低さ**: 社内 10〜30 人、PII / 決済データなし、現場業務データのみ
3. **append-only 担保は維持**: `item_movements` の UPDATE/DELETE は付与しない（D-1）
4. **M3 で撤回前提**: Platform 統合で `auth.users` セッション経由に切替時、本 GRANT は revoke

### 代替案と却下理由

- **service_role でスクリプト/Server Action を実行**: クライアント側 UI ボタンが解決しない
- **Supabase Magic Link 認証導入**: 仮運用フェーズの「リンクだけで使える」ポリシーに反する
- **Edge Function で全書込を権限昇格**: 過剰設計。M3 で破棄するため投資回収できない

### 再評価条件

- M3 Platform 統合直前: 必ず本 GRANT を撤回する migration を発行
- 仮運用中に anon 書込起因の事故が発生した場合: 即時 revoke + 認証経路復活

### 影響ファイル

- `supabase/migrations/0004_grant_anon_master_write.sql`

---

## ADR-006: 所在のデフォルト = 事務所・倉庫（将来拡張）

- **日付**: 2026-05-24
- **状態**: Recorded（M2 で本格実装予定）
- **決定者**: 人間（「在庫管理の動線として返却したもの... 事務所・倉庫にあるのがデフォルト」「モノは事務所・倉庫から現場や他社への譲渡、裏倉庫への移動などの可能性がある」）

### 背景

現状 `item_movements.to_location_id` / `from_location_id` は null になっているケースが多い。返却物・初期在庫の所在が暗黙的になっており、所在トラッキングを明確化する将来拡張が必要。

### 決定（M2 で本実装）

- **デフォルト所在 = 事務所・倉庫**: 返却物・初期在庫はここに置かれる前提
- **moves の経路を明示**:
  - 事務所・倉庫 → 現場（持出 checkout）
  - 事務所・倉庫 → 他社（譲渡、新 movement_type 検討）
  - 事務所・倉庫 → 裏倉庫（社内移動 transfer）
  - 裏倉庫 → 事務所・倉庫（戻し）
  - 現場 → 事務所・倉庫（返却 return）
  - 現場 → 現場（直接移送 transfer）
- 初回登録時に inbound イベントで「事務所・倉庫に置く」を明示

### 根拠

- 罠A 維持: 状態は movement 履歴から導出
- 現場の運用実態（メイン倉庫 + 裏倉庫の 2 拠点）を素直に反映
- 他社譲渡は将来要件として movement_type の拡張で対応可能

### M0 時点での暫定

- locations に「事務所・倉庫」「裏倉庫」を投入済
- movement の to/from location は明示的に渡される CaaF / 返却で埋まる
- 暗黙の初期在庫位置は表示上のみ「事務所・倉庫」と扱う（DB には記録しない）

### 再評価条件

- 資材（quantity 系）統合時: 場所ごとの在庫数集計が必要になる → View 拡張
- 他社譲渡が頻発: `movement_type` に `external_transfer` 追加
- 紛失頻度が場所別に偏る運用知見: location 別の紛失統計

### 影響ファイル（M2 で対応）

- `supabase/migrations/00xx_default_location.sql`（予定）
- `src/lib/supabase/movements.ts`（to_location_id デフォルト埋め）
- 一覧 UI（現在地表示の拡張）

---

## ADR-007: CaaF gen-2 化（汎用FW v1.0.0 / `@caaf/core` 別パッケージ抽出）

- **日付**: 2026-06-07
- **状態**: Accepted（L0 spec-architect 着手、人間が 4 論点を明示選択）
- **決定者**: 人間（AskUserQuestion 4 問に回答）+ AI 設計

### 背景

第一世代 CaaF（`src/lib/caaf/` の「ストローク対話モデル」）は単一ドメイン・Router/Intent 層なし・Supabase 直結で、工具管理アプリに特化していた。利用者が汎用FW定義 **CaaF v1.0.0**（7層パイプライン / 複数App / Adapter 抽象 / Core純度）を提示し、本格的な汎用化に着手することになった。

### 決定（L0 対話で確定した 4 論点）

| 論点 | 決定 |
|---|---|
| 移行戦略 | 全面書き換え（gen-1 を gen-2 に置換。パリティ到達まで gen-1 を残す） |
| 初回スコープ | フル v1.0.0（Intent + Router + Adapter + multi-App + Resolver ラリー） |
| Core 配置 | 別ワークスペース `packages/caaf-core`（`@caaf/core`、pnpm workspace 化） |
| 2つ目の App | 当面は工具のみ（Router/multi-App は構造として用意、点灯は資材統合 Phase 2 等） |

### 根拠

1. **Core純度の物理強制**: 別パッケージ + grep 検証（`scripts/purity-check.mjs`）で固有名詞/外部依存ゼロを担保。「利用者非依存FW」の identity を構造で確定
2. **入力レイヤーのみの書き換え**: `item_movements` 台帳・migrations・View・RLS は不変。罠A/D-1〜D-12 は db Adapter 内で維持。書き換えは可逆（gen-1 は git 履歴 + M-F まで到達可能）
3. **段階 land**: 「全面書き換え」を M-A〜M-F のレビュー可能マイルストンで届ける（M2 + independent-reviewer 整合）
4. **将来の多ドメイン口**: 同一 Core が複数ドメイン（資材/日報/在庫…）の統一入力口になる構造を先に用意

### L0 で意図的に保留した事項

- root `pnpm-workspace.yaml` は **L0 で作成しない**。理由: `cd app && pnpm install`（Vercel 本番経路）が workspace ルートを検出し稼働中 M0 アプリの install/lockfile 挙動を変えうるが、L0 環境では Vercel ビルドを検証できない。適用と検証を L1 マイルストン M-A に倒す（`spec/caaf-migration.md` §5）。現時点で `app/` は無変更 = 本番無影響

### 影響ファイル

- `packages/caaf-core/`（新設・自己完結。types/adapter/intent/router/mapper/validate/resolver/signal/guards/execute + test + purity-check + SPEC/README）
- `spec/caaf-migration.md`（新設・移行計画 + 工具 binding + ワークスペース化手順 + M-A〜M-F ロードマップ）
- `spec/caaf-component.md`（gen-1 superseded マーク + ポインタ）
- `app/REGIME.md`（current_focus を CaaF gen-2 化へ更新、LC 記録）

### 再評価条件

- 2 App 目（資材統合等）が具体化 → Router/multi-App を本格点灯。binding を追加
- Platform 統合時 → tools db Adapter を platform スキーマ参照へ拡張（Core 不変）
- M-F パリティ検証で gen-1 撤去できない不足が判明 → 当該機能を L0 に差し戻し

