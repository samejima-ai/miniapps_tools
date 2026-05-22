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

- Platform 統合時に他ミニアプリと **共通テーブル**（employees / projects 等）を扱う場合、`platform` スキーマを追加し外部キー参照
