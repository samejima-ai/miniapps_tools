# DELIVERY.md — CaaF gen-2 M-D（工具 CaaFApp 定義 + tracking_type 条件付き必須 overlay）

## 体制情報
- Mode: M2 / LC=1 / dev_mode: autonomous / scope: full
- ロードマップ: `spec/caaf-migration.md` §6 の **第 4 段 M-D**（M-C 依存）
- ブランチ: `claude/dazzling-gauss-Lc0kI`（M-C の PR #18 を master へ merge 後、master 起点で継続）
- 自律修正回数: 1 / 上限 3（routing テストの過大主張を是正。下記「自己修正」）

## 背景 / ゴール
M-C で tools db Adapter（getSchema/read/write）と FW Don't 担保（罠A/D-1/D-7/D-11/D-3）を land 済み。
M-D は **Core に注入する「工具入力」CaaFApp 定義**（migration §3）と、Core の単純 `required: boolean` では
表せない **tracking_type 条件付き必須**（個体管理=units 必須 / 数量管理=quantity 必須）を Config 側 overlay で実装する。
完了条件: **schema 駆動で Resolver ラリーが回る**こと。

## 変更（`app/src/lib/caaf-config/`）

| ファイル | 役割 |
|---|---|
| `tools-app.ts`（新規・純データ+純関数） | `toolsApp: CaaFApp`（schema=M-C の `TOOLS_FIELDS` を再利用）+ `toolsAppForTracking(tracking)` overlay |
| `tools-app.test.ts`（新規） | **14 件**。App 形 / overlay（individual・quantity）/ Resolver ラリー / Router 連携を固定 |
| `tools-adapter.ts`（M-C を最小拡張） | `getSchema(target)` が `"individual"`/`"quantity"` 指定時に overlay schema を返すよう委譲 |
| `index.ts`（純関数エントリ） | `toolsApp` / `toolsAppForTracking` / `ToolsTracking` を再エクスポート |

## 設計のキモ — tracking_type 条件付き必須

```
toolsApp.schema           = TOOLS_FIELDS（units / quantity は両方 optional）… item 未解決時
toolsAppForTracking("individual") → units を required 化、quantity を schema から除外
toolsAppForTracking("quantity")   → quantity を required 化、units を schema から除外
```

- **なぜ overlay か**: Core は `required: boolean`（静的）のみ。「item 解決後に tracking を見て一方を必須化」は
  Config 側の責務（migration §3 注記）。Core を汚さず（純度維持）、host が item 解決後に effective app へ切替える。
- **除外（filter）の意図**: 個体管理に数量／数量管理に番号が**混在**しないよう、無関係フィールドを schema から外す。
  Core の `sanitizeRecord`/`dropForeignFields` が record 側からも落とすため、混在 write を構造的に防ぐ。
- **他フィールド不変**: action（必須+default=checkout）/ item（必須 reference）/ site・holder（optional）は両 tracking で不変。
- **純関数**: `toolsAppForTracking` はベース `toolsApp` を変更せず新オブジェクトを返す（テストで固定）。

## Resolver ラリー（完了条件の実証）

Core の純関数（`applyDefaults`/`nextRequiredField`/`isComplete`/`applyAnswer`/`validateRecord`）に
effective app を渡すと、schema 駆動でラリーが回ることをテストで実証:
- item 未解決: action は default 充当 → 次の必須は **item**（units/quantity は未必須）。
- item 解決（individual）: 次の必須は **units** → 回答で `isComplete=true`。
- item 解決（quantity）: 次の必須は **quantity** → 回答で `isComplete=true`。
- units 空のまま確定不可（`missingRequired` に units）= **必須未充足では write しない（Don't #2）**を schema で担保。

## 検証

| 層 | 対象 | 結果 |
|---|---|---|
| 第1層 計算的 | `tsc --noEmit`（`toolsApp` が Core `CaaFApp` を満たす） | PASS |
| 第1層 計算的 | vitest caaf-config **48 件**（うち tools-app 14） | PASS |
| 第1層 計算的 | biome（変更 4 ファイル） | PASS（import 整序 1 自動修正） |
| 第2層 ビルド | `next build`（8 ページ） | PASS |
| Core純度 | `pnpm purity:core`（`packages/caaf-core` 無変更） | PASS |
| 第5層 独立検証 | layer1-independent-reviewer | PASS（`VERIFICATION-CAAF-MD-2026-06-07.md`） |

## Don't 非接触 / 維持
- M-D は **App 定義 + schema overlay のみ**。DB write・mapping（tools-mapping.ts）・台帳・migration・View・RLS 非接触。
- 罠A/D-1/D-7/D-11/D-3 は M-C（tools-mapping.ts）に保持され無変更。
- D-5（曖昧補完禁止）/ D-11 は `toolsApp.dont` に LLM 注入用ソフト制約として明文化。
- **Don't #2（必須未充足では write しない）** は overlay により units/quantity に対しても schema で表現可能になった（M-D の価値）。
- running app から未 import（UI 連結は M-E）= 実挙動への影響ゼロ。

## 自己修正（自律 1 回）
初版の Router テストが「工具語入力 → auto 確定」を主張したが、`keywordScores` は粗いベースライン
（hits/keywords）で当該入力は 0.5 < mid(0.6) ＝ fallback が正。単一 App 運用では実際には LLM スコアラを使う想定
（migration §1: Router 点灯は 2 App 目登場時）。テストを「keyword が語に反応し正スコア / 無関係語は 0」
「routeByScores は高スコアを auto・0 を fallback に決定論的に写像」へ是正（Core の挙動を正しく固定）。

## M-E への申し送り（非 FAIL）
1. **tracking 切替のトリガ**: host は item 解決（M-C `resolveItem` の `ItemCandidate.trackingType`）後に
   `toolsAppForTracking(trackingType)` へ effective app を切替え、以降のラリー/validate/execute をそれで回すこと。
2. **getSchema overlay の semantics**: Adapter.getSchema は `target` に tracking を受けて overlay を返すが、
   SSOT は純関数 `toolsAppForTracking`。host はどちらを使ってもよい（純関数の方が server-only 非依存で軽い）。
3. **enum インライン**: action は enum + default。Resolver ラリーは UI が options を読みインライン選択（FW spec §7.2）。

## 次
M-E（host Chat UI 置換）: M-B（Extractor/IntentClassifier）+ M-C（db Adapter）+ M-D（CaaFApp）を結線し、
gen-1 と機能パリティ（3 タップ以内・p95 5 秒・f2-chat-ui-v2 スクロール挙動）。
