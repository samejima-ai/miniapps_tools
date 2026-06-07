# DELIVERY.md — CaaF gen-2 M-A（ワークスペース化 + @caaf/core 結線）

## 体制情報
- Mode: M2 / LC=1 / dev_mode: autonomous / scope: full
- マイルストン: M-A（`spec/caaf-migration.md` §6 ロードマップ第 1 段）
- 自律修正回数: 1 / 上限 3（pnpm 10 の build-script ブロックを onlyBuiltDependencies で解消）

## 実装済み（M-A スコープ = 結線のみ）
- root `pnpm-workspace.yaml`（`app` + `packages/*`）
- root `package.json`（private / packageManager pnpm@10.33.0 / onlyBuiltDependencies / filter scripts）
- root `pnpm-lock.yaml`（workspace 統合 lock。`app/pnpm-lock.yaml` は削除）
- `app/package.json`: `"@caaf/core": "workspace:*"` 追加、packageManager 9.12.0→10.33.0
- `app/next.config.ts`: `transpilePackages: ["@caaf/core"]` + webpack `extensionAlias`(.js→.ts/.tsx)
- `app/src/lib/caaf-config/_wiring-check.ts`: @caaf/core 解決確認プレースホルダ（Config 側）
- `.gitignore`: `node_modules/` 等を追加

## 自己検証（5層検出スタック）
| 層 | 対象 | 結果 |
|---|---|---|
| Shift Left 基盤 | spec/caaf-migration.md §5 手順との照合 | PASS |
| 第1層 計算的センサー | Core typecheck/purity/vitest(40) + app typecheck | PASS |
| 第2層 ビルド機械検証 | `next build`（production, 8 ページ生成） | PASS（2 回再現） |
| 第3層 Interaction Cost | M-A は UI 変更なし（測定対象外） | N/A |
| 第4層 推論的センサー | 「仕様に合う・動く」= @caaf/core が app から解決・ビルド成立 | PASS |
| 第5層 独立検証 | layer1-independent-reviewer | PASS（`VERIFICATION-CAAF-MA-2026-06-07.md`） |

## pre-existing 事項（M-A 回帰ではない）
- `pnpm lint`(biome) 23 errors は全て既存ファイル。新規 `_wiring-check.ts` は clean。M-A 起因の新規エラーゼロ。既存 lint 債務の解消は別 PR（Type C）。

## 仕様改訂提案（Type C）
- 既存 biome lint 債務（23 件）の解消を将来 PR で。M-A スコープ外。

## 異常献上（Type D）
なし。

## pre-merge 条件（独立検証 提起 1）
- **Vercel preview が Ready になることを merge ゲートとする**。pnpm 9→10 + lockfile 統合 + workspace 化の Vercel(root=app) 影響は本環境では `next build` ローカル緑までしか検証できない。production は merge でのみ更新されるため、preview Ready 確認まで merge しない。→ PR に `human-review-needed` 付与。

## 体制事後評価
- M2 は妥当。M-A は infra/結線のみで小粒だが、稼働中 M0 アプリの deploy 経路に触れるため独立検証 + Vercel preview ゲートは過剰でない。
- L2 発動閾値には未接近（単一ドメイン・並行サブゴール 0）。次 M-B / M-C は並行可能だが M2 で吸収可能。
- 次マイルストン: M-B（IntentClassifier / Extractor を既存 LLM router 上に実装）。M-C（db Adapter）と並行着手可。
