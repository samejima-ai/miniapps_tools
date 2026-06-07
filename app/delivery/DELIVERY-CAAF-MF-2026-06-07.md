# DELIVERY.md — CaaF gen-2 M-F（gen-1 撤去 + gen-2 を既定入力に）

## 体制情報
- Mode: M2 / LC=1 / dev_mode: autonomous / scope: full
- ロードマップ: `spec/caaf-migration.md` §6/§8 **最終段 M-F**
- ブランチ: `claude/dazzling-gauss-Lc0kI`（M-E.3 の PR #23 merge 後、master 起点）
- **人間 sign-off**: 利用者の明示指示「M-F実行」を受領（§8 の撤去前提条件を充足）
- 自律修正回数: 1 / 上限 3（git mv の親ディレクトリ再作成）

## ゴール
gen-2（`/input2`）が実運用検証を経て承認されたため、gen-1（stroke 対話モデル）を撤去し、
**gen-2 を唯一の入力経路（`/input`）に昇格**する。URL・タブ・既存リンクは不変（`/input` のまま中身を gen-2 に置換）。

## 変更

### 昇格（gen-2 → 既定ルート）
- `app/(main)/input2/page.tsx` → **`app/(main)/input/page.tsx`**（gen-1 を置換）。コンポーネント名 `Input2Page`→`InputPage`、doc/空状態の「gen-2」表記を除去。
- `app/(main)/input2/actions.ts` → **`app/(main)/input/actions.ts`**。`input2/` ディレクトリ削除。

### 撤去（gen-1）
| 削除 | 内容 |
|---|---|
| `src/lib/caaf/use-caaf.ts` | stroke 状態機械（useCaaF フック） |
| `src/lib/caaf/types.ts` | StrokeItem / CaafConfig |
| `src/lib/caaf/index.ts` | gen-1 バレル |
| `src/lib/caaf/signal.ts` | gen-1 determineSignal（gen-2 は Core signal） |
| `src/lib/caaf/alias.ts` | learnAlias（未移植。M-E.4 候補として git 履歴に残置） |
| `src/lib/llm/router.ts` | デモ stub（dead code: import 元ゼロ） |
| `src/components/stroke-item-card.tsx` | gen-1 専用カード |
| `src/components/signal-card.tsx` | gen-1 専用（未使用） |
| 旧 `input/{page,actions}.ts` | gen-1 stroke 入力 + 1129 行 actions |

### 保全（gen-1 ディレクトリ外へ退避）
- `src/lib/caaf/llm.ts` → **`src/lib/llm/gemini.ts`**（共有 Gemini クライアント。`/master` の notes 生成が使用）。
  importer 2 件を更新: `lib/llm/notes-generator.ts` / `master/notes-actions.ts`。
- `src/lib/caaf/` ディレクトリは消滅。

### 追従更新
- `tests/e2e/E2E-010-input-empty-state.spec.ts`: 空状態文言を gen-2（「工具名・番号・現場を入力してください」）に。
- `spec/api-signatures.ts` / `caaf-config/llm.ts`: 撤去済みパスへの stale コメントを是正。

## gen-1 参照ゼロ（§6 完了条件）
- 機械 sweep（`useCaaF|CaafConfig|StrokeItem|stroke-item-card|signal-card|/input2|lib/llm/router|lib/caaf/{llm,signal,alias,types,use-caaf,index}`）で **コード参照ゼロ**を確認。
  残るのは設計由来コメント（host-turn の「gen-1 useCaaF に相当」等、歴史的記述）のみ。
- `src/lib/caaf/` ・ `app/(main)/input2/` ともに消滅。

## 検証

| 層 | 対象 | 結果 |
|---|---|---|
| 第1層 | `tsc --noEmit`（撤去後も全 import 解決） | PASS |
| 第1層 | vitest **79 件**（caaf-config、unit 不変） | PASS |
| 第1層 | biome | PASS |
| 第2層 | `next build` → **`/input`=gen-2(6.15kB)**、`/input2` 消滅、他ルート（/list /master /lost /）健在 | PASS |
| Core純度 | `pnpm purity:core` | PASS（無変更） |
| E2E | Playwright（本環境で未実行） | 申し送り（preview で要実行） |
| 第5層 | independent-reviewer | PASS（`VERIFICATION-CAAF-MF-2026-06-07.md`） |

## 可逆性 / 安全
- 撤go は **git 履歴に全保全**（§8）。問題時は revert で gen-1 復帰可能。
- 台帳・migration・View・RLS・`item_movements` 書き込み規約（罠A/D-1/D-7/D-11/D-3）は**全段で無変更**。
- bottom-tabs は `/input` を指したまま（変更不要）＝ナビ不変。

## 申し送り
1. **E2E 実機実行**（本環境はブラウザ/サーバ無し）→ preview で E2E スイート（特に E2E-010）を実行推奨。
2. **CLAUDE.md** に「LLM は src/lib/llm/router 経由」の旧記述が残る（軽微）。次回 governance 更新時に gen-2（caaf-config）へ是正推奨。
3. **M-E.4（任意）**: holder 解決 + alias 学習（learnAlias は git 履歴に保全済み）。
4. これで CaaF v1.0.0 移行ロードマップ（M-A〜M-F）完了。
