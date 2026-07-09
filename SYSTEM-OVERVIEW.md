# 工具管理システム — システム構成（作り直し用 1枚まとめ）

> **このファイルの目的**
> コンセプト／UI を 1 から作り直す前提で、**「絶対に壊してはいけない核」**と**「自由に作り替えてよい層」**を 1 ファイルに集約した引き継ぎ書。
> 新しい画面・入力方式を載せ替えても、**同じ正しい台帳に書ける**ようにするのが狙い。
>
> 一次情報の優先順位（既存ルール）: **`.ts > .sql > .md`（乖離時は DDL が正）**。本書は要約であり、最終的な正は `app/supabase/migrations/*.sql` と `app/spec/domain.ts`。

---

## 0. 作り直しの鉄則（最初に読む）

| 区分 | 対象 | 方針 |
|---|---|---|
| 🔒 **変えてはいけない核** | DB スキーマ（`miniapps_tools.*`）/ 台帳 `item_movements` の append-only / 状態を持たず View 導出（罠A）/ 禁則 D-1〜D-12 / ヒト>モノ>コト | **そのまま維持**。ここを崩すと「実態と台帳のズレ」が再発し、システムの存在意義が消える |
| 🆓 **自由に作り直してよい層** | UI・画面遷移・コンセプトの言い回し・入力方式（CaaF 自然文 / フォーム / 音声 / 画像 など）・状態管理ライブラリ・コンポーネント設計 | **白紙でよい**。台帳への「書き込み契約」（§6）さえ守れば中身は何でもよい |
| ♻️ **捨ててよい現行実装** | `packages/caaf-core` + `app/src/lib/caaf-config` + `/input` 画面（gen-2 CaaF 一式） | 残すも作り直すも自由。ただし「マスタ照合」「二重持出検出」「現場照合」のロジックは再利用価値が高い（§5.4） |

**一言でいうと**: データ層（Supabase）は完成度が高く正しいので**そのまま使い回し**、その上の体験（UI/コンセプト/入力）を新しく作る、という作り直し。

---

## 1. WHY（このシステムの存在理由）

カクマン工業の現場職人が、工具の**持出・返却を LINE と同じノリの自然文**で入力でき、裏では**機械可読な所在台帳**として正確に蓄積される。返却漏れ・紛失検知の穴を「実態と台帳のズレ」で作らない。

- 既存の LINE 運用（洗練済み）の入力習慣を殺さない。**フォームを作らない**。
- 自然文 →（構造化）→ 確認 → 確定 を**最小ステップで**。**入力速度の劣化は失敗**。
- 利用者の最重要要求: **「速さ」**。工具管理は“ササッと”終わらせたい。

> ※ ここは「コンセプト作り直し」の対象。ただし上の業務本質（速さ・台帳の正確さ・現場/グローブ前提）は要件として引き継ぐ価値が高い。

---

## 2. 🔒 不変の核 ① データモデル（ヒト > モノ > コト）

### 2.1 設計の背骨
- **ヒト**（employees）> **モノ**（items + individual_units）> **コト**（item_movements）。**コト＝`item_movements` が唯一の真実（SSOT）**。
- **罠A**: 実体テーブル（items / individual_units）に `status` / `current_holder` / `current_location` 等の**状態カラムを持たせない**。状態は `item_movements` の**最新行から View で導出**する。
- **append-only**: `item_movements` は **UPDATE / DELETE しない**。訂正は「打消しイベント」を新規 INSERT。
- **器は資材まで**: テーブル名は `tools` ではなく **`items`**。`tracking_type` で個体/数量を分岐。将来の資材統合を命名で成立させる。

### 2.2 スキーマ（`miniapps_tools` schema）

**テーブル**
| テーブル | 役割 | 主要カラム |
|---|---|---|
| `items` | モノのマスタ（種類） | `id, item_code?, name, category, tracking_type, is_active, notes` ／ **状態カラムなし** |
| `individual_units` | 個体（番号）。`individual` のみ | `id, item_id→items, unit_number, is_active, notes` ／ `unique(item_id, unit_number)` ／ **状態カラムなし** |
| `locations` | 保管場所（倉庫/現場） | `id, name, kind('warehouse'|'site'), project_id?(疎結合), is_active` |
| **`item_movements`** | **コト＝移動イベント（SSOT, append-only）** | 下記 2.3 |
| `item_name_aliases` | 工具名エイリアス学習 | `alias(lowercase, unique), item_id→items, canonical_name, use_count, last_used_at` |
| `project_name_aliases` | 案件名エイリアス学習 | `alias, project_id, canonical_name, use_count, last_used_at`（0003） |

**`item_movements`（中核）**
```
id, item_id→items,
unit_id?→individual_units,   -- individual 時のみ
quantity?,                    -- quantity 時のみ
  ↑ CHECK: (unit_id XOR quantity) 排他必須
movement_type,               -- enum（下記）
from_location_id?, to_location_id?, project_id?,  -- どこ（現場は疎結合）
holder_id?,                  -- 実際の保持者（D-7）
moved_by?,                   -- 入力者（D-7、holder と別カラム）
moved_at, source('caaf'…), confidence?(ログ専用/D-3), notes, created_at
```

**ENUM**
- `tracking_type` = `individual` | `quantity`
- `item_category` = `tool` | `material` | `consumable`（MVP 運用は tool のみ）
- `movement_type` = `checkout` | `return` | `transfer` | `inbound` | `outbound` | **`lost`** | **`found`**（lost/found は 0005 で追加）

### 2.3 View（罠A 回避の実体 = 状態はここでだけ計算する）
| View | 内容 |
|---|---|
| `v_unit_current_status` | 個体ごとの現在状態を movements 最新行（`distinct on (unit_id) order by moved_at desc, id desc`）から導出。`current_status ∈ {in, out, lost}`、`current_project_id, current_holder_id, days_out, days_lost` |
| `v_currently_out` | 「いま持出中」（status='out'）一覧。**一覧/返却 UI の主データ**。`holder_id` で自分軸フィルタ |
| `v_lost_units` | 紛失中（status='lost'）一覧。`/lost` ページの源。`days_lost` |
| `v_item_quantity_status` | 数量モノの現在在庫（将来の資材用。inbound/return − outbound/checkout の集計） |

### 2.4 RLS / GRANT（append-only をインフラ層で担保）
- `item_movements`: **SELECT / INSERT のみ**。**UPDATE / DELETE ポリシーを作らない＝物理的に append-only**。
- マスタ（items/units/locations/aliases）: SELECT + INSERT + UPDATE（**DELETE なし＝論理削除 `is_active=false` 運用**）。
- **M0 仮運用の例外（ADR-005）**: `anon` にもマスタ INSERT/UPDATE と `item_movements` INSERT を付与中（migration 0004）。**Platform 統合直前（M3）に必ず revoke** する想定。
- 認証は現状「Gate 画面で名前タップ」＝ Supabase Auth セッション無しの簡易モデル。

### 2.5 アイデンティティ / 疎結合の接続点
- `Employee = { id, name }`。`id` は現状 Supabase Auth uid 相当の抽象 ID。**将来 `platform.employees(id)` に差し替え**（参照 1 点の変更で済む構造）。
- 現場・社員は `public` スキーマ側（`projects(project_id, name, deleted_at)` / `employees(employee_id, family_name, given_name)`）を **疎結合参照**（FK は将来付与）。
- **将来の統合**: `holder_id`/`moved_by` → `platform.employees(id)`、`project_id` → `platform.projects(id)` に FK 付与で締める。**本スキーマは変更不要**。

---

## 3. 🔒 不変の核 ② ドメイン禁則（罠A / D-1〜D-12）

| # | 禁止 | 正しい実装 |
|---|---|---|
| **罠A** | 実体テーブルに状態カラム（status/current_holder/current_location）を持つ | View（`v_unit_current_status`）で導出 |
| **D-1** | `item_movements` を UPDATE/DELETE | 訂正は打消しイベントを INSERT（append-only） |
| **D-2** | 返却を「状態を in に書き換え」で実装 | 返却 = `movement_type='return'` 行を INSERT |
| **D-3** | LLM の `confidence` を状態判定に使う | confidence はログ/安全分析専用。所在は事実(movement)のみで決める |
| **D-4** | `confidence > 閾値` 単独で自動登録 | 確信度 × 参照一致の 2 軸。**MVP は Phase0=全件確認（自動 INSERT 無効）** |
| **D-5** | LLM に欠損を創作・補完させる | LLM は抽出器。曖昧は人間に確認（`ambiguities`） |
| **D-6** | テーブル名を `tools` にする | `items`（共通器）。資材統合を命名で成立 |
| **D-7** | `holder_id`（保持者）と `moved_by`（入力者）を統合 | 代理入力を区別して保存 |
| **D-8** | スワイプ/ロングプレス | 明示ボタン操作（**グローブ前提**） |
| **D-9** | Google Workspace を業務データの保存先に | Supabase が SSOT |
| **D-10** | ILIKE 複数ヒットで先頭採用 | 全候補を確度付きで提示（`candidates_proposed`） |
| **D-11** | 持出中 unit への二重持出を許可 | `v_currently_out` 照合で検出 → 確定不可 |
| **D-12** | 紛失と廃棄を 1 ボタンに統合 | 紛失=所在不明・復帰可 / 廃棄=`is_active=false`・復帰不可。語彙と UI を分ける |

その他: 抽出 JSON に実名を直接保存しない（社員 ID 経由）。`localStorage`/IndexedDB に業務データ長期保存しない（セッションキャッシュ可）。HEX 直書き禁止（DESIGN トークン経由）。

---

## 4. 機能セット（業務要件 — UI は作り直すが要件は参考になる）

| F | 機能 | 要点 / UX Must |
|---|---|---|
| **F1** | ユーザー識別 | 起動時に社員選択 → `currentUserId` 保持。表示名と分離。「切替」可（端末共有前提） |
| **F2** | 入力（自然文→構造化→確定） | 持出 checkout を INSERT。`holder_id=moved_by=currentUser`（代理時は別 holder）。**3タップ以内 / LLM p95 5秒 / 反映 1秒**。🟢でも**人がタップして確定**（D-4） |
| **F3** | 一覧 | `v_currently_out` を**自分軸デフォルト**。現場フィルタ/検索/経過日数。閲覧モードでカードタップ無効。**初期 p95 2秒** |
| **F4** | クイック返却 | 返却モード → 複数選択 → 一括 `return` INSERT。状態書き換えで実装しない（D-2）。戻し先デフォルト=事務所・倉庫 |
| **F5** | 信号色 UI | 確信度 × 参照一致 × 状態矛盾 → 🟢🟡🟠🔴。**色は表示のみ**（D-3/D-4） |
| **F6** | マスタ管理 | items CRUD（論理削除）/ units 追加・論理削除 / locations。**AI notes 自動生成**（Gemini, 捏造禁止プロンプト） |
| **F7** | 経過日数可視化 | `days_out≥3`→赤バッジ、`≥7`→強警告（閾値はアプリ側） |
| **F8** | 紛失/発見 | `lost`/`found` イベント。`/lost` ページ。**紛失≠廃棄**（D-12）。紛失 3タップ以内 |

マスタ照合の 3 層（F2 の肝・再利用価値大）: **Layer0 alias 完全一致 → Layer1 `items.name` ILIKE（複数は candidates 提示）→ Layer C LLM 意味マッチ**。

---

## 5. ♻️ 現行アーキテクチャ（= 作り直し対象。何が今あるか）

### 5.1 技術スタック
- **Next.js (App Router) + React 19** / TypeScript strict（`noUncheckedIndexedAccess`）
- **Supabase**（Postgres, schema `miniapps_tools` + `public`）。アクセスは Supabase クライアント経由のみ
- **LLM = Google Gemini 2.5 Flash Lite**（`@/lib/llm/gemini.ts`、server-only）
- **pnpm workspace**（`packages/caaf-core` + `app`）/ **biome**（lint・format）/ **vitest**（jsdom）/ **Playwright**（E2E）
- **PWA = serwist**（`app/src/app/sw.ts`、`skipWaiting/clientsClaim`、NetworkFirst）
- **Tailwind + DESIGN.md トークン**（後述）

### 5.2 画面（ルート）— `app/src/app/`
- `/`（gate）= F1 社員選択（`components/gate-screen.tsx`）
- `(main)/layout.tsx` = ヘッダ + 下タブ + 認証ゲート（未選択なら `/` へ）
- `(main)/input` = **F2 入力**（現状 = CaaF gen-2、§5.3）
- `(main)/list` = F3/F4/F7 一覧・返却
- `(main)/lost` = F8 紛失
- `(main)/master` = F6 マスタ
- 共有: `components/{header,bottom-tabs,gate-screen,unit-card}.tsx`、`lib/user-context.tsx`（sessionStorage `miniapps_tools_current_user`）

### 5.3 現行の入力実装 = CaaF v1.0.0（gen-2）
「Chat as a Form」= 自然言語入力を構造化データ書き込みへ変換する**汎用フレームワーク**を、工具を最初の利用者として実装したもの。
- **`packages/caaf-core`**（汎用 Core・**固有名詞ゼロ・外部依存ゼロ**・`pnpm purity` で純度 CI）: 7 層パイプライン
  `L0 Capture → L0.3 Intent → L0.5 Route → L1 Extract → L2 Validate → L3 Execute → L4 Feedback`
  （types/adapter/intent/router/mapper/validate/resolver/signal/guards/execute）
- **`app/src/lib/caaf-config`**（工具 binding。純関数と server-only を分離）
  - 純: `tools-fields`（入力スキーマ）/ `tools-mapping`（record→`item_movements` 行・FW Don't 担保）/ `tools-app`（CaaFApp 定義 + tracking 条件付き必須）/ `host-turn`（**会話の脳**＝候補分岐・rally・現場解決を純関数で。テスト多数）
  - server-only: `llm`（Gemini）/ `factories`（Extractor・IntentClassifier）/ `tools-adapter`（Supabase: マスタ照合/書込/現場照合）/ `host-server`（capture/execute オーケストレーション）
- **`/input` UI**: capture/execute のみ server 往復。候補選択・番号/数量回答は **client 純関数で即時**（速度のため）。番号チップ・信号色カードで作り込み済み。
- テスト: Core 40 + caaf-config 79 = **計 119**（gen-2 ロジックの大半は純関数テストで固定済み）。

> **作り直しでこの CaaF を捨ててもよい**。ただし「マスタ 3 層照合」「二重持出検出（D-11）」「現場 name→id 照合」「record→item_movements 行の純写像（Don't 担保）」は**正しく作るのが難しい部分**なので、`tools-adapter.ts` / `tools-mapping.ts` のロジックは流用推奨。

### 5.4 視覚トークン（DESIGN.md — 引き継ぐと統一感が出る）
- 色: primary `Kakuman Blue #0066b3` / success `#2e8b57` / warning `#d4892f` / error `#c0392b` / signal-{green,yellow,orange,red}
- タイポ: `font-mono`（JetBrains Mono = **番号 unit_number 表示**）/ headline-lg(18/900) など。**フォントウェイト 3 種混在禁止**
- 4px グリッド（xs4/sm8/md12/lg16/xl24）/ radius sm7・md10・lg13・xl16 / shadow card・card-strong・cta・primary-cta
- タップ域 44px+ / **グローブ前提**（スワイプ・ロングプレス禁止）

---

## 6. 🆓 作り直し時の「台帳への書き込み契約」（新 UI が守ればよい唯一の約束）

新しい UI / コンセプト / 入力方式が何であっても、**この契約さえ守れば台帳は正しく保たれる**:

1. **持出** = `item_movements` に `movement_type='checkout'` を INSERT。
   - individual: `unit_numbers[]` の**各番号で 1 行ずつ**（`unit_id` 必須・`quantity` null）。
   - quantity: **1 行**（`quantity` 必須・`unit_id` null）。
   - `holder_id = 実際の保持者`（既定は入力者）、`moved_by = 入力者`（**別物 / D-7**）、`project_id = 解決済み現場 id`（未解決なら入れない）。
2. **返却** = 各 unit に `movement_type='return'`（`holder_id=null`, `to_location_id=倉庫`）を INSERT。**状態書き換え禁止（D-2）**。
3. **紛失/発見** = `lost` / `found` を INSERT（廃棄＝`items/units.is_active=false` とは別物 / D-12）。
4. **訂正** = UPDATE/DELETE せず**打消しイベントを INSERT**（D-1）。
5. **状態は必ず View から読む**（`v_currently_out` / `v_unit_current_status` / `v_lost_units`）。実体テーブルに状態を書かない（罠A）。
6. **二重持出を作らない**（D-11）: checkout 前に `v_currently_out` で当該 unit が持出中でないか確認。持出中なら確定不可。
7. **LLM を使うなら抽出のみ**（D-5）: 欠損は創作させず人間確認。**確信度で自動登録しない**（D-4、Phase0=全件確認）。
8. **confidence は記録するが状態判定に使わない**（D-3）。

> この 8 項目は `app/src/lib/supabase/movements.ts`（`insertMovement` / `insertReturnBatch`）と `tools-mapping.ts` に実装済み。**新 UI はこれらを呼ぶだけ**で契約を満たせる。

---

## 7. 既知のハマりどころ / 申し送り

- **PWA キャッシュ**: serwist の Service Worker が旧シェルをキャッシュするため、デプロイ後も端末に旧 UI が残ることがある。「古い」と感じたらハードリロード/PWA 再インストール。新 UI でも更新導線（バージョン通知等）を検討。
- **`GH_REVIEW_PAT` 失効**: CI の `auto-merge`(=`evaluate` チェック)が赤いのはこのガバナンス workflow のトークン失効が原因（アプリの不具合ではない）。リポジトリ Secrets を更新すると緑に戻る。
- **本番デプロイ**: Vercel（production = master）。production root は `app/`。
- **`domain.ts` の MovementType は 5 値**だが DDL は lost/found 込みの 7 値（**DDL が正**）。作り直し時に Zod を 7 値へ同期推奨。
- **gen-2 未実装**: 保持者(holder) name→id 解決 / alias 学習（learnAlias 相当）/ 会話中の自由文修正。必要なら追加実装ポイント。
- **ローカル検証の制約**: この開発環境には DB/LLM キーが無いため、実 LLM/DB の動作は Vercel preview で確認する運用。

---

## 8. ファイルマップ（どこに何があるか）

```
app/
├── supabase/migrations/        # 🔒 データSSOT（0001 init / 0002,0003 alias / 0004 grant / 0005,0006 lost-found）
├── spec/
│   ├── domain.ts               # 🔒 Zod 型（DDL に従属）
│   ├── f2-chat-ui-v2.md         # 入力チャットUIの挙動仕様
│   ├── state-machine.ts / state-diagrams.md / invariants.feature
│   └── authz-matrix.md / subphase-manifest.md / api-signatures.ts
├── SPEC.md  DONT.md  DESIGN.md  REGIME.md  INDEX.md  ROADMAP.md  CLAUDE.md   # 仕様/禁則/視覚/体制
├── src/
│   ├── app/(main)/{input,list,lost,master}/   # 🆓 画面（作り直し対象）
│   ├── components/             # 🆓 共有UI（header/bottom-tabs/gate-screen/unit-card）
│   ├── lib/
│   │   ├── supabase/           # 🔒 クライアント + movements(insertMovement/insertReturnBatch) + View読込
│   │   ├── caaf-config/        # ♻️ 工具ドメインbinding（gen-2。流用 or 作り直し）
│   │   ├── llm/                # gemini.ts（共有 Gemini） + notes-generator
│   │   └── user-context.tsx    # F1 currentUser（sessionStorage）
│   └── app/sw.ts               # PWA Service Worker（serwist）
packages/caaf-core/             # ♻️ 汎用CaaF Core（捨てるなら丸ごと）
spec/caaf-migration.md, caaf-component.md   # CaaF 移行/部品の設計記録
```

---

### まとめ（作り直しの指針）
1. **Supabase スキーマ（§2）と禁則（§3）はそのまま使う** — ここが資産。
2. **§6 の 8 契約**を満たす形で、新しい UI・コンセプト・入力方式を自由に作る。
3. 難所（マスタ照合 / 二重持出 / 現場照合 / record→台帳の写像）は現行 `caaf-config` のロジックを**流用**すると安全。
4. 視覚は DESIGN.md トークン（Kakuman Blue・信号色・mono 番号・44px・グローブ前提）を引き継ぐと統一できる。
