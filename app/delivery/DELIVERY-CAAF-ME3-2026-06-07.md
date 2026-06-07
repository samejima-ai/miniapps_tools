# DELIVERY.md — CaaF gen-2 M-E.3（現場 name→id 解決：gen-1 案件照合のパリティ）

## 体制情報
- Mode: M2 / LC=1 / dev_mode: autonomous / scope: full
- ロードマップ: `spec/caaf-migration.md` §6 **M-E の第 3 スライス**（M-E.2 に結線）
- ブランチ: `claude/dazzling-gauss-Lc0kI`（M-E.2 の PR #22 merge 後、master 起点で継続）
- 自律修正回数: 0 / 上限 3（biome 整形は自動）

## ゴール
M-E.2 では現場が「未照合」表示で **item_movements に書かれなかった**。本スライスで gen-1 の
`resolveProjectFromSite` と同型の **現場 name→project_id 解決**を gen-2 に実装し、現場が記録されるようにする
（パリティ前進）。**gen-1（`/input`）は据え置き**。

## 変更（`app/src/lib/caaf-config/` + `/input2`）

| ファイル | 役割 |
|---|---|
| `tools-adapter.ts`（server-only） | `read("resolve-site")` 追加。`project_name_aliases` 完全一致 → `public.projects` ILIKE（gen-1 同型・best-effort） |
| `tools-mapping.ts`（純） | `SiteCandidate` 型（projectId/name）追加 |
| `host-turn.ts`（純） | `HostState.siteCandidates` + `applySiteResolution`（0/1/N 分岐）+ `chooseSite`。site は任意なので充足に非影響 |
| `host-server.ts`（server-only） | capture で item 解決後に `resolveSiteRef`（pendingRefs.site を read 解決 → record.site 昇格） |
| `host-turn.test.ts` | site 解決の +4 件（計 **79**） |
| `index.ts` | `applySiteResolution` / `chooseSite` / `SiteCandidate` を再エクスポート |
| `/input2/page.tsx` | ready カードに現場の解決状態表示（✓確定 / 候補ピッカー / 未照合）を追加 |

## 解決ロジック（gen-1 パリティ・write 安全）
- **alias 完全一致**（`project_name_aliases`、tools スキーマ）→ 即 1 件確定。
- **`public.projects` ILIKE**（`deleted_at is null`、最大 10 件）。
- host 側 `applySiteResolution`:
  - **1 件 → `record.site` に `project_id` 昇格**（記録される）。`pendingRefs.site` を確定名に更新。
  - **複数 → `siteCandidates` 保持・未昇格**（UI でピッカー選択）。誤った案件を書かない（write 安全）。
  - **0 件 → 未昇格**（「未照合・記録には残しません」表示）。
- 現場は**任意フィールド**のため、未確定でも rally/ready の必須充足には影響しない（checkout は現場無しでも成立）。

## UI（`/input2` ready カード）
- 確定（1 件）: 「✓ 現場: 池下現場」
- 複数候補: 「現場の候補を選択（任意）」ボタン群 → `chooseSite`
- 未照合（0 件）: 「現場: 〇〇（未照合・記録には残しません）」

## FW Don't / 安全
- write 経路は M-C（`recordToMovementInput` が site→project_id を読む）に委譲・**無変更**。罠A/D-1/D-7/D-11/D-3 維持。
- 未解決名を project_id として書かない（複数/0 件は record.site 未設定）＝**write 安全性を構造的に担保**。
- `public.projects` クライアント未設定でも best-effort（失敗時は空＝未照合、抽出全体は落ちない）。gen-1 と同じ防御。
- **gen-1 非干渉**: `/input`・`resolveProjectFromSite`・台帳・migration・View・RLS 無変更。

## 検証

| 層 | 対象 | 結果 |
|---|---|---|
| 第1層 計算的 | `tsc --noEmit` | PASS |
| 第1層 計算的 | vitest caaf-config **79 件**（site 解決 +4） | PASS |
| 第1層 計算的 | biome（変更ファイル） | PASS |
| 第2層 ビルド | `next build`（`/input2` 6.15 kB） | PASS |
| Core純度 | `pnpm purity:core`（`packages/caaf-core` 無変更） | PASS |
| 第5層 独立検証 | layer1-independent-reviewer | PASS（`VERIFICATION-CAAF-ME3-2026-06-07.md`） |

## 申し送り（次段）
1. **runtime 未実測**（DB/LLM キー無し）→ preview `/input2` で「…現場名」を含む入力の現場照合（✓/候補/未照合）を確認推奨。
2. **holder（保持者）の name→id 解決は未実装**（gen-1 にも無し。holder 既定は入力者＝D-7）。必要なら M-E.4 で employees 照合。
3. **alias 学習（learnAlias 相当）** は未移植。確定後の project/item alias UPSERT は M-E.4 候補。
4. **M-F**: パリティ検証 → gen-1 撤去 + 既定ルート切替（**人間のパリティ sign-off 必須**）。
