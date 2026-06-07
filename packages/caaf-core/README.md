# @caaf/core

**CaaF (Chat as a Form)** — 自然言語入力を任意の構造化データストアへの書き込みに変換する汎用入力レイヤーの **Core**。

ドメイン非依存・固有名詞ゼロ・外部依存ゼロ。具体ドメインは利用者が `CaaFApp` として外部注入する。

- 完全な仕様は [`SPEC.md`](./SPEC.md)（FW v1.0.0、自己完結ドキュメント）。
- gen-1（工具管理アプリのストローク対話モデル）からの移行は [`../../spec/caaf-migration.md`](../../spec/caaf-migration.md)。

## 設計原則（不変）

1. **Core純度** — Core に固有名詞/分岐を書かない（`scripts/purity-check.mjs` で grep 検証）
2. **抽出のみ・生成禁止** — 不明は `null`
3. **確定はユーザー** — 書き込みは明示操作のみ
4. **サーバーサイド LLM** — Core は LLM SDK 非依存。分類器/抽出器はインターフェース注入
5. **不可逆操作の保護** — Guards が必須未充足/未確認の write を阻む
6. **文脈完全リセット** — App 切替で record 破棄
7. **Adapter 抽象** — 書き込み先は `CaaFAdapter` で抽象化

## 構成

```
src/
├── index.ts      # Public API
├── types.ts      # §4 データモデル（CaaFApp / CaaFField / CaaFRecord …）
├── adapter.ts    # §8 Adapter interface（getSchema / write / read）
├── intent.ts     # §6 Intent（L0.3）— normalizeIntent / IntentClassifier(inject)
├── router.ts     # §5 Router（L0.5）— routeByScores / keywordScores / RouterScorer(inject)
├── mapper.ts     # §7.1 Mapper（L1）— buildRecord / Extractor(inject)
├── validate.ts   # §7 Validate（L2）— validateRecord
├── resolver.ts   # §7.2 Resolver（L2 ラリー）— nextRequiredField / applyAnswer …
├── signal.ts     # §7.3 Signal — confidenceSignal / recordSignal
├── guards.ts     # §10.1 FW-level ハード制約（コード強制）
└── execute.ts    # §3 L3 — executeRecord（guards 連動 write）
```

Core が依存しない（= 利用者が注入する）4 点: `CaaFAdapter` / `IntentClassifier` / `Extractor` / `RouterScorer`。

## 開発

```bash
pnpm typecheck   # tsc --noEmit（pnpm 版は devDeps の tsc を使うため要 install）
pnpm test        # vitest（純ロジックの unit test。要 install）
pnpm purity      # Core純度 grep 検証（Node 標準のみ・install 不要）
```

> Core は**外部 runtime 依存ゼロ**なので、`pnpm` を介さずグローバル `tsc --noEmit` でも型検査が通る
> （`pnpm typecheck`/`pnpm test` は devDeps の typescript/vitest を使うため通常は `pnpm install` が必要）。
> `pnpm purity` は Node 標準モジュールのみで動くため install 不要。

## ステータス

v0.1.0（L0 着手）— 純ロジック層（types / validate / resolver / signal / guards / router 決定 / intent 正規化 / execute）は実装・test・runtime smoke 済。
LLM/DB を伴う注入実装（Adapter / Classifier / Extractor / Scorer）と host UI は L1 が `SPEC.md` §14 に従って実装する。
