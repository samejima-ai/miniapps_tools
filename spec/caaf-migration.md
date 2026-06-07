# CaaF gen-1 → gen-2 移行仕様（工具ドメイン binding）

| | |
|---|---|
| 種別 | 移行計画 + ドメイン binding（Config 側） |
| 対象 | `@caaf/core` v0.1.0 ← 工具管理ミニアプリ（`app/`） |
| 起票 | 2026-06-07（L0 spec-architect 着手） |
| 上位仕様 | `packages/caaf-core/SPEC.md`（FW v1.0.0、利用者非依存） |

> Core（`@caaf/core`）は利用者非依存。本書は **工具管理ミニアプリを最初の CaaFApp として Core に結線する Config 側の仕様**と、現行 gen-1（ストローク対話モデル）からの移行手順を定める。

---

## 1. L0 確定事項（2026-06-07 対話）

| 論点 | 確定 |
|---|---|
| 移行戦略 | **全面書き換え**（stroke モデルを gen-2 に置換。ただし下記 §6 のマイルストンで段階的に land し、パリティ到達まで gen-1 を到達可能に保つ） |
| 初回スコープ | **フル v1.0.0**（Intent + Router + Adapter + multi-App + Resolver ラリー） |
| Core 配置 | **別ワークスペースに抽出**（`packages/caaf-core`、pnpm workspace 化） |
| 2つ目の App | **当面は工具のみ**（Router/multi-App は構造として用意するが、点灯は資材統合 Phase 2 等の 2 App 目登場時） |

**重要な安全境界**: 本書き換えは *入力レイヤー* のみを対象とする。`item_movements` 台帳・migrations・View・RLS は**一切変更しない**。罠A / D-1〜D-12 はすべて維持され、db Adapter の内部で守られる。

---

## 2. gen-1 → gen-2 対応表

現行 `app/src/lib/caaf/`（ストローク）と `app/src/app/(main)/input/actions.ts` の構造は gen-2 の層に素直に射影できる。

| gen-1（現行） | gen-2（Core 層） | 移行方針 |
|---|---|---|
| `useCaaF`（stroke 状態機械） | host UI + Resolver ラリー（§7.2） | 置換。stroke の `input→extract→review→confirm→done` を `Capture→Intent→(Route)→Extract→Validate→Execute` に再構成 |
| `extractAction`（抽出 + マスタ照合） | L1 `Extractor`(inject) + Adapter.read | 抽出と参照照合を分離。抽出 = Extractor、マスタ照合 = db Adapter の read/reference |
| `clarifyAction`（自由文 re-extract） | L0.3 `IntentClassifier` + correct/remove/add | clarify を意図分類に置換。「3番→1番」=correct、「やめる」=cancel、「スキップ」=remove |
| `confirmCheckoutAction`（INSERT） | L3 `executeRecord` → Adapter.write | guards 通過後に Adapter.write。append-only / 二重持出拒否は Adapter 内で維持 |
| `resolveAgainstMaster`（ILIKE/alias/Layer C） | db Adapter.read + reference 解決 | Adapter の read 系へ。候補提示（candidates_proposed）は reference field の解決として表現 |
| `determineSignalWithResolution` | `recordSignal`(Core) + domain overlay | Core の 3 色 + 工具固有の overlay（return→red / unit_already_out→red 等）は Config 側 |
| `learnAlias`（確定後 alias UPSERT） | Adapter.write 後フック | Adapter.write 成功後に Config 側で実行（Core は関知しない） |
| `CaaFExtractionResult`（Zod） | `CaaFRecord` + tools schema | tools の schema（§3）を介して Record に射影。Zod は Adapter 境界で維持 |

---

## 3. 工具 CaaFApp 定義（Config 側、L1 が実装）

`app/spec/domain.ts` の Zod 定義を SSOT として、tools の `CaaFApp` を導出する。概形:

```typescript
// app/src/lib/caaf-config/tools-app.ts （L1 で新設、固有名詞 OK = Config 側）
import type { CaaFApp } from "@caaf/core";

export const toolsApp: CaaFApp = {
  id: "tools",
  name: "工具入力",
  context: {
    role: "工具持出・返却アシスタント",
    description: "現場職人の自然文から工具の持出/返却を1件ずつ構造化する場。",
    examples: ["バッテリー 2,3番 ブロワ 1番 池下現場"],
  },
  schema: [
    { name: "action",   type: "enum",      required: true,  label: "操作", options: ["checkout", "return"], default: "checkout" },
    { name: "item",     type: "reference", required: true,  label: "工具", referenceAdapter: "tools-master" },
    { name: "units",    type: "array",     required: false, label: "番号" },   // individual 時
    { name: "quantity", type: "number",    required: false, label: "数量" },   // quantity 時
    { name: "site",     type: "reference", required: false, label: "現場", referenceAdapter: "projects-master" },
    { name: "holder",   type: "reference", required: false, label: "保持者", referenceAdapter: "employees-master" },
  ],
  dont: [
    "曖昧な全返却（電動工具全返却など）は展開しない。返却モードへ誘導する",  // D-5
    "持出中の番号への二重持出は確定不可とする",                              // D-11
    "工具と無関係な話題は入力に戻す",
  ],
  adapter: { type: "db", config: { schema: "miniapps_tools" } },
  routing: { keywords: ["持ち出し", "持出", "返却", "工具", "現場", "番"], description: "工具の持出・返却", priority: 1 },
};
```

> `units`/`quantity` の required は tracking_type に依存する条件付き必須。これは Core の単純 required では表せないため、tools db Adapter の `getSchema`/Validate overlay で「item 解決後に tracking_type を見て units か quantity を required 化する」。詳細は L1 の binding 実装で確定する（§6 M-D の決定事項）。

---

## 4. tools db Adapter（Config 側、L1 が実装）

`CaaFAdapter` の 3 メソッドに既存 Supabase ロジックを充てる。

| メソッド | 既存ロジックの再利用 |
|---|---|
| `getSchema("checkout")` | `app/spec/domain.ts` の Zod から CaaFField[] を導出（静的）。reference 系は master から動的補完 |
| `read(app, query)` | `resolveAgainstMaster` 相当（alias → ILIKE → Layer C）。`v_currently_out` 照合で二重持出/持出状態も返す |
| `write(app, record)` | `confirmCheckoutAction` 相当。`item_movements` へ append-only INSERT。holder_id≠moved_by 維持（D-7）。二重持出拒否（D-11）。confidence はログのみ（D-3） |

**purity 境界**: この Adapter は `app/`（Config）側に置く。`@caaf/core` には Supabase/Gemini を一切持ち込まない（`pnpm purity` で CI 検証）。

---

## 5. ワークスペース化手順（L1 マイルストン M-A で適用・検証）

> **L0 では root `pnpm-workspace.yaml` を作成していない。** 理由: root に置くと `cd app && pnpm install`（Vercel 本番ビルド経路）が pnpm に workspace ルートとして検出され、稼働中 M0 アプリの install/lockfile 挙動が変わりうる。L0 環境では Vercel ビルドを検証できないため、稼働中アプリを壊さないよう **適用と検証を L1 の最初のマイルストンに倒す**。`packages/caaf-core` は自己完結（外部依存ゼロ・`tsc --noEmit` 単体通過）なので、現時点で `app/` は一切変更されておらず本番ビルドは無影響。

L1 が M-A で実施する（ローカルで `pnpm install` と app ビルドを検証できる前提）:

1. リポジトリ root に `pnpm-workspace.yaml` を作成:
   ```yaml
   packages:
     - app
     - packages/*
   ```
2. root `package.json`（private・packageManager 固定）を作成し、`app/pnpm-lock.yaml` を root lockfile へ統合（`pnpm install` を root で実行 → lockfile 再生成を確認）。
3. `app/package.json` に `"@caaf/core": "workspace:*"` を追加。
4. `app/next.config.ts` に `transpilePackages: ["@caaf/core"]` を追加（Next が TS ソースを直接トランスパイル）。
5. **検証**: `cd app && pnpm install && pnpm build && pnpm typecheck && pnpm test` が緑。Vercel の Root Directory 設定（app/）とビルドコマンドが workspace 化後も通ることを確認。通らなければ M-A を land せず L0 に差し戻す。

---

## 6. L1 マイルストン（M2 + independent-reviewer、各々レビュー可能単位）

| M | 内容 | 完了条件 |
|---|---|---|
| **M-A** | ワークスペース化 + `@caaf/core` 結線（§5） | app ビルド/テスト緑、Vercel 経路無影響を確認 |
| **M-B** | LLM 注入実装: `IntentClassifier`（L0.3）/ `Extractor`（L1）を既存 `src/lib/llm/router` 上に実装 | Intent 7 種を分類、add 時のみ抽出（コスト分岐）。unit test |
| **M-C** | tools db Adapter（§4）— getSchema/read/write を既存 Supabase ロジックから移植 | 罠A/D-1/D-7/D-11/D-3 維持を test で固定。`pnpm purity` 緑 |
| **M-D** | 工具 CaaFApp 定義（§3）+ tracking_type 条件付き必須の Adapter overlay | schema 駆動で Resolver ラリーが回る |
| **M-E** | host Chat UI 置換 — Resolver ラリー / enum インライン / サマリー / Intent確認 / Router候補カード | gen-1 と機能パリティ（3タップ以内・p95 5秒・スクロール挙動 f2-chat-ui-v2 準拠） |
| **M-F** | パリティ検証 → gen-1 撤去（`src/lib/caaf` stroke + 旧 input path 削除） | E2E 緑、gen-1 参照ゼロ。撤去 PR を独立 land |

並列可能性: M-B / M-C は独立（並行可）。M-D は M-C 依存。M-E は M-B/M-D 依存。M-F は全依存。

---

## 7. 維持される不変条件（書き換えでも不変）

- **罠A**: 状態カラムを持たない。状態は `item_movements` 最新行から View 導出（db Adapter 内）
- **D-1**: `item_movements` は append-only。訂正は打消しイベント INSERT
- **D-3**: confidence は信号色/ログのみ。状態判定に使わない
- **D-4**: Phase 0 全件確認。`executeRecord` は status="confirmed"（ユーザー明示）必須
- **D-5**: LLM は抽出/分類のみ。曖昧は埋めない（Core 設計原則 2 と一致）
- **D-7**: holder_id ≠ moved_by
- **D-11**: 持出中 unit への二重持出拒否（Adapter.read で検出 → 確定不可）
- **f2-chat-ui-v2**: 並行ストローク禁止・スクロール挙動（host UI が踏襲）

---

## 8. gen-1 の扱い

- M-A〜M-E の間、gen-1（`src/lib/caaf` + `input/actions.ts` + `input/page.tsx`）は**到達可能なまま残す**（仮運用を止めない）。
- M-F のパリティ検証通過後にのみ撤去 PR を出す。撤去前に DELIVERY で gen-1/gen-2 の機能対応を逐項確認する。
- gen-1 は git 履歴に残るため、撤去は可逆（ロールバック可能）。
