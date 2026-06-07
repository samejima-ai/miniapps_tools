# DELIVERY.md — CaaF gen-2 M-E.1（host 会話エンジン backbone：純粋オーケストレーション + server 結線）

## 体制情報
- Mode: M2 / LC=1 / dev_mode: autonomous / scope: full
- ロードマップ: `spec/caaf-migration.md` §6 **M-E（host Chat UI 置換）の第 1 スライス（backbone）**
- ブランチ: `claude/dazzling-gauss-Lc0kI`（M-D の PR #20 を master へ merge 後、master 起点で継続）
- 自律修正回数: 2 / 上限 3（①空 units 配列の充足誤判定 ②biome noShadowRestrictedNames）

## なぜ backbone-first か（スライス判断）
M-E はロードマップ最大の段で LIVE UX 隣接の山場。本環境は DB/LLM キーが無く UI を runtime 検証できない。
そこで M-E を **backbone（会話の脳）→ UI（M-E.2）** に分割し、本 PR は **純粋に検証可能な判断ロジック**に集中する。
gen-1（`input/page.tsx` + `useCaaF` + `input/actions.ts`）は**一切触らず到達可能のまま**（§8）。新ルートも未追加＝**実挙動ゼロ影響**。

## 変更（`app/src/lib/caaf-config/`）

| ファイル | 役割 |
|---|---|
| `host-turn.ts`（新規・純関数） | gen-2 会話エンジン。Core 純関数の上に「抽出取込→item候補分岐→tracking切替→rally→ready→confirm」を実装 |
| `host-turn.test.ts`（新規） | **18 件**。capture 合成 / 候補分岐 / units 解決(missing/already_out) / rally / signal / summarize / intent |
| `host-server.ts`（新規・server-only） | 薄いオーケストレータ。`createToolsHost(ctx)` の `capture`（Intent→抽出→read）と `execute`（confirm→Core executeRecord→write） |
| `tools-mapping.ts`（拡張・純） | `ItemCandidate`（adapter から移設）+ `resolveRequestedUnits`（要求番号×マスタ突き合わせ）+ 直接 test 3 件 |
| `tools-adapter.ts` | `ItemCandidate` を tools-mapping から import + 後方互換 re-export |
| `index.ts` / `server.ts` | host-turn 純関数群 / `createToolsHost` を再エクスポート |

## アーキテクチャ — pure / server の分離（テスト容易性）
```
host-turn.ts   （純）  会話の全判断。client が rally answer/skip/choose を直接適用。jsdom で 18 テスト
host-server.ts （srv） 外界 I/O（LLM 2 種 + DB read/write）だけを担い、判断は host-turn に委譲
```
- **capture** = IntentClassifier 分類 →（add のみ）Extractor 抽出 → item を Adapter.read で解決 → `applyItemCandidates` 分岐。
  intent が add 以外は抽出を回さない（コスト分岐、FW §3/§6）。cancel→初期化 / out_of_scope→フェーズ遷移。
- **rally**（answer/skip/choose）= 純関数で client 側に閉じる（server 往復ゼロ＝速い）。
- **execute** = `confirmForExecute`（status=confirmed）→ Core `executeRecord`（Guards）→ Adapter.write（M-C）。

## 解決スコープ（M-E.1）と申し送り（M-E.2）
- 解決するのは **item（必須 reference）+ tracking_type + units/quantity** まで。
- **site / holder は name→id 解決が未実装（M-E.2）**。未解決名を id として executable record に混入させないため、
  抽出名は `pendingRefs`（表示専用）へ退避し record には入れない（write 安全性を構造的に担保）。
- 会話中の自由文修正（correct/remove を free text で）は M-E.2。本 backbone の rally は回答/ボタン操作前提。
- **UI ルート（`/input2` 等）は M-E.2**。本 PR は脳のみ（gen-1 と非干渉）。

## FW Don't（維持・担保）
| Don't | 担保 |
|---|---|
| #1 schema外排除 | `applyExtractedRecord` は WRITABLE_FIELDS のみ採用、`resolveToCandidate` は effective app で `sanitizeRecord` |
| #2 必須未充足 write 禁止 | ready は `isComplete` 必須。execute は Core `canExecute` を通過 |
| #3 ユーザー確認 | `confirmForExecute` が status=confirmed。未確認 record は `canExecute` で弾く |
| 罠A/D-1/D-7/D-11/D-3 | write は M-C の adapter/mapping に委譲（無変更）。host は D-11 リスクを issue 提示のみ（最終採否は buildMovementRows） |
| D-5 創作禁止 | not_found は言い直し誘導。host は値を作らない |

## 自己修正（自律 2 回）
1. **空 units 配列の充足誤判定**: Core `hasValue([])` は truthy ＝「充足」。個体管理で番号未指定時に units=[] を入れると ready に化ける。
   → 解決個体があるときだけ units を確定（空/全 missing 時は未設定）→ rally で番号を尋ねる。テストが検出・固定。
2. **biome noShadowRestrictedNames**: ヘルパ `valueOf` がグローバル `Object.prototype.valueOf` を shadow → `fieldVal` に改名。

## 検証

| 層 | 対象 | 結果 |
|---|---|---|
| 第1層 計算的 | `tsc --noEmit`（host が Core/Config 型に整合） | PASS |
| 第1層 計算的 | vitest caaf-config **69 件**（host-turn 18 + resolveRequestedUnits 3 + 既存） | PASS |
| 第1層 計算的 | biome（変更 7 ファイル） | PASS（format 自動整形 + shadow 改名後 clean） |
| 第2層 ビルド | `next build`（8 ページ） | PASS |
| Core純度 | `pnpm purity:core`（`packages/caaf-core` 無変更） | PASS |
| 第5層 独立検証 | layer1-independent-reviewer | PASS（`VERIFICATION-CAAF-ME1-2026-06-07.md`） |

## 安全性
- `server-only` は `host-server.ts`（+ 既存 llm.ts / tools-adapter.ts）のみ。host-turn は純関数（69 テストが jsdom で PASS = 実証）。
- running app 未 import（UI は M-E.2）= **実挙動ゼロ影響**。gen-1 経路・台帳・migration・View・RLS 非接触。
- HostState は serializable（plain data のみ）＝ Server Action 越しに client/server で受け渡し可能。

## 次
M-E.2（host Chat UI 実装）: 新ルート（gen-1 据え置き）に `createToolsHost` + host-turn を結線した Resolver ラリー UI
（enum インライン / 候補カード / サマリー / Intent 確認）。Vercel preview で代表入力を sanity check。
併せて site/holder の resolve（adapter.read 拡張）を実装。M-F で gen-1 撤去（パリティ後）。
