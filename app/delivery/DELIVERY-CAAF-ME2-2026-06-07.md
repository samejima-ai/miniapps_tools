# DELIVERY.md — CaaF gen-2 M-E.2（host Chat UI 実装：`/input2` gen-2 入力画面）

## 体制情報
- Mode: M2 / LC=1 / dev_mode: autonomous / scope: full
- ロードマップ: `spec/caaf-migration.md` §6 **M-E の第 2 スライス（UI）**。M-E.1（backbone）に結線。
- ブランチ: `claude/dazzling-gauss-Lc0kI`（M-E.1 の PR #21 merge 後、master 起点で継続）
- 自律修正回数: 0 / 上限 3（biome 整形は自動）

## ゴール
M-E.1 の会話エンジン（host-turn / host-server）に **実 UI を結線**し、gen-2 の Resolver ラリーを動かす。
**gen-1（`/input`）は据え置き＝新ルート `/input2` で並行稼働**（migration §8、パリティ後 M-F で gen-1 撤去）。
Vercel preview で**実機確認可能**にするのが本スライスの主眼。

## 変更

| ファイル | 役割 |
|---|---|
| `app/src/app/(main)/input2/actions.ts`（新規・"use server"） | `captureAction`（Intent→抽出→read）/ `executeAction`（confirm→write）の薄ラッパ。`createToolsHost` 経由 |
| `app/src/app/(main)/input2/page.tsx`（新規・"use client"） | gen-2 チャット UI。capture/execute は Server Action、rally の選択/回答は純関数 client 側 |
| `app/src/lib/caaf-config/host-turn.ts`（拡張） | `HostState.availableUnits` 追加 + `applyUnitNumbers`（rally の番号回答を client 側で解決） |
| `app/src/lib/caaf-config/host-turn.test.ts` | applyUnitNumbers の +2 件（計 74） |
| `app/src/lib/caaf-config/index.ts` | `applyUnitNumbers` を再エクスポート |

## UI 設計（DESIGN.md トークン、gen-1 と同じチャットシェル）
- **入力バー**: 「新規発話待ち」（active=null / not_found）でのみ有効。rally/候補/ready 中は inline 操作（誤再 capture 防止）。
- **phase 別レンダリング**:
  - `not_found` → エラー文 + 言い直し誘導（入力バー再有効）。
  - `candidates` → 候補ボタン（個体/数量の別を併記）→ `chooseCandidate`（純・client）。
  - `rally` → 不足必須を 1 つ提示（FW §7.2）。enum はインラインボタン、units/quantity は数値入力（`applyUnitNumbers`/`answerField`）。
  - `ready` → サマリーカード（`summarize` + signal 色）+「登録する」→ `executeAction`。
  - **やり直す**ボタンで会話リセット（行き詰まり回避）。
- **速度**: capture/execute だけ server 往復。候補選択・番号/数量回答は **client 純関数＝即時**（利用者の「速さ最重要」に直結）。

## client 側 rally 解決（applyUnitNumbers）
番号未指定の個体工具で rally が番号を尋ねる際、解決済み item の在庫個体を `HostState.availableUnits` に保持しておき、
ユーザーが入力した番号を **client 側で** `resolveRequestedUnits` 突き合わせ → units 確定（missing/already_out を issue 化）。
server 往復なしでラリーが進む。tests 2 件で固定。

## FW Don't（維持）
- **D-3 確認はユーザー**: 「登録する」明示押下でのみ `executeAction`。自動 INSERT なし（D-4）。
- **#1/#2/#3**: backbone（M-E.1）+ Core guards が担保。UI は ready（isComplete）でのみ実行ボタンを出す。
- **罠A/D-1/D-7/D-11**: write は M-C adapter/mapping（無変更）。UI は alreadyOut/missing を**提示のみ**。
- **gen-1 非干渉**: `/input`・`useCaaF`・`input/actions.ts`・bottom-tabs 無変更。`/input2` は独立ルート。

## 検証

| 層 | 対象 | 結果 |
|---|---|---|
| 第1層 計算的 | `tsc --noEmit`（UI が host/Core 型に整合） | PASS |
| 第1層 計算的 | vitest caaf-config **74 件**（host-turn 23 + applyUnitNumbers 2 含む） | PASS |
| 第1層 計算的 | biome（新規/変更ファイル） | PASS |
| 第2層 ビルド | `next build` → **`/input2` 5.77 kB** 出力（9 ルート） | PASS |
| Core純度 | `pnpm purity:core`（`packages/caaf-core` 無変更） | PASS（M-E.1 と同様、本 PR で Core 無変更） |
| 第4層 推論的 | 「動く・使える」= UI ロジックは host-turn テストで担保。**実機は preview で要確認** | 申し送り |
| 第5層 独立検証 | layer1-independent-reviewer | PASS（`VERIFICATION-CAAF-ME2-2026-06-07.md`） |

## 提起 / 申し送り（human-review-needed）
1. **runtime 未実測**（DB/LLM キー無し）。**Vercel preview の `/input2` で代表入力を sanity check 推奨**:
   「バッテリー 2,3番 池下現場」（個体・番号あり）/「軍手」（数量・rally）/「ろうそく」（not_found）/ あいまい名（候補）。
2. **site / holder の name→id 解決は未実装**（ready の現場は「未照合」表示）。次段で adapter.read 拡張（resolve-site/holder）。
3. **会話中の自由文修正**（correct/remove）は未対応。rally は回答/ボタン前提。
4. **`/input2` は直リンク/preview 到達**（bottom-tabs は gen-1 のまま）。パリティ確認後の既定ルート切替・撤去は M-F。

## 次
M-E.3（任意）: site/holder 解決 + 会話修正の拡充 → M-F（パリティ検証 → gen-1 撤去 + 既定ルート切替）。
