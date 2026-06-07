# VERIFICATION.md — CaaF gen-2 M-A（ワークスペース化 + @caaf/core 結線）

## 判定: PASS（pre-merge 条件 1 件あり）

独立検証（実装コンテキスト隔離）。成果物を再読込し、計算的センサーを独立に再実行した。
対象仕様: `spec/caaf-migration.md` §5（ワークスペース化手順）/ §6 M-A 完了条件。
体制: M2 / autonomous / LC=1。

---

## 仕様合致（§6 M-A 完了条件）

| 受け入れ基準 | 結果 | 独立検証 |
|---|---|---|
| ワークスペース化（root pnpm-workspace.yaml + package.json） | PASS | ファイル実在・`pnpm install` が 3 workspace projects を認識 |
| @caaf/core 結線（workspace:* 依存） | PASS | `app/node_modules/@caaf/core` → `packages/caaf-core` symlink 確認 |
| transpilePackages 設定 | PASS | next.config.ts diff 確認、`next build` 通過 |
| app/pnpm-lock.yaml を root lock へ統合 | PASS | app lock 削除・root `pnpm-lock.yaml`(112KB) 生成 |
| **app ビルド緑** | PASS | `pnpm build`（next build）独立再実行 = Compiled successfully + 8/8 pages |
| **app テスト緑** | PASS | app typecheck PASS。app vitest=テストなし（e2e/perf のみ、想定どおり） |

## 動作・整合確認

| 観点 | 結果 |
|---|---|
| Core typecheck / purity / vitest（40 件） | PASS（独立再実行で 40/40） |
| app typecheck（@caaf/core 型解決） | PASS（`_wiring-check.ts` 経由で型・値 import 解決） |
| app next build（型チェック含む production build） | PASS（再現性確認: 2 回とも緑） |

## DONT / Core純度

| 検査 | 結果 | 根拠 |
|---|---|---|
| 罠A / append-only / D-1〜D-12 | 非抵触 | `git diff app/src` = 新規 `caaf-config/` のみ。`supabase/` `input/actions` 等の業務ロジック・台帳・View・migration・RLS は無変更 |
| Core純度（固有名詞・外部依存ゼロ） | 維持 | `packages/caaf-core/src` は本 M-A で無変更。`pnpm purity` PASS |
| `_wiring-check.ts` の配置 | 妥当 | Config 側（`app/src/lib/caaf-config/`）= 固有名詞 OK。Core を汚さない |

## スコープ妥当性

M-A = 結線のみ。feature ロジック（tools CaaFApp 定義 / db Adapter / IntentClassifier / Extractor / host UI）は M-B 以降に正しく分離。`_wiring-check.ts` は型+値 import の最小プレースホルダで、業務ロジックを含まない。**スコープ過大なし**。

## 配置規則 / 提起

- root `package.json` / `pnpm-workspace.yaml` / `pnpm-lock.yaml` は workspace インフラであり、作業メモ（PLAN.md/TODO.md 等）の混入ではない → 違反なし。
- `.gitignore` に `node_modules/` 追加は妥当（root workspace 化に伴う必須対応）。

### 提起 1（pre-merge 条件・非 FAIL）

**Vercel preview の Ready 確認を merge ゲートとする。** pnpm 9→10 昇格 + lockfile 統合 + workspace 化が Vercel（Root Directory=app）ビルドに与える影響は、本環境では `next build` ローカル緑までしか検証できない（Vercel ランタイムは push 後の preview でのみ確認可能）。production は merge でのみ更新されるため、preview が Ready になるまで merge しないこと。→ PR に `human-review-needed` 付与を推奨。

### 提起 2（pre-existing・非 FAIL / Type C 候補）

`pnpm lint`(biome) が 23 errors を報告。**全て既存ファイル**（`input/page.tsx` / `list/page.tsx` / `lost/page.tsx` / `supabase/*` / e2e specs 等）で、M-A 新規ファイル（`_wiring-check.ts`）は clean。M-A 起因の新規 lint error はゼロ＝**回帰なし**。biome バイナリが本 PR で初めてビルド許可された（pnpm 10 の onlyBuiltDependencies）ことで顕在化したのみ。既存 lint 債務の解消は別 PR（Type C）として L0/L1 に委ねる。

## 履歴整合性（LC=1）

過去 INTENT との矛盾・廃止機能回帰・却下案再実装：**なし**。M-A は ADR-007 で確定した gen-2 移行 §6 ロードマップの第 1 段で、過去方針の深化に一致。

## 最終判定

**PASS** — 全 M-A 完了条件を独立検証で確認。merge 前に Vercel preview の Ready を確認すること（提起 1）。lint 債務（提起 2）は pre-existing で M-A 回帰ではない。
