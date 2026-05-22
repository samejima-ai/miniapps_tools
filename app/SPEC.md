# 機能仕様

## WHY（目的）

カクマン工業の現場職人が、工具の持出・返却を **LINE自然文と同じノリ** で入力でき、裏側では機械可読な所在台帳として **正確に蓄積される** こと。返却漏れ・紛失検知の穴を「実態と台帳のズレ」によって作らないこと。

LINE運用（既に洗練済み）の入力習慣を殺さず、フォームを作らず、自然文→構造化→確認→確定の流れを最小ステップ数で回す。入力速度の劣化は失敗。

## SSOT優先順位

`.ts > .sql > .md`。本書（.md）はDDL（`supabase/migrations/0001_init_miniapps_tools.sql`）と TypeScript ドメイン定義（`spec/domain.ts`）に従属する。乖離時は DDL が正。

## WHAT（機能定義）

### F1. ユーザー識別

#### 概要
起動時に社員を選択して `currentUserId`（抽象ID）を保持する。表示名と分離する。将来 Platform SSO（employees.id）への差替えは参照1点の変更で済む構造にする。

#### 条件
- 起動時に未認証ならゲート画面を表示し、社員一覧から1人を選ばせる
- `currentUserId` はクライアントセッションに保持する（Supabase Auth セッションと併用）
- ヘッダーに表示名を出すが、内部処理は全て `currentUserId` で参照する
- 「切替」ボタンで再選択可能（同一端末を複数人で共有する想定）

#### Priority
critical

---

### F2. CaaF入力（自然文→構造化→確定登録）

#### 概要
自然文（LINEと同じノリ）を LLM で構造化し、確認カードで確信度・参照一致を可視化し、人間タップで `item_movements` に `movement_type='checkout'` 行を INSERT する。

#### 条件
- LLM ルーター経由で Gemini Flash Lite（本番）/ Claude API（開発時）を切替可能にする
- 抽出 JSON 形式は `{site, action, items[{name, tracking_type, unit_numbers[], quantity, confidence}], holder_note, ambiguities[]}`
- **LLM は抽出器であり、欠損情報を創作・補完しない**（DONT D-5）。曖昧は `ambiguities` に出す
- **Phase 0（MVP）は全件確認必須**。信号色は表示するが🟢でも人がタップしないと INSERT しない（DONT D-4）
- 確定時、`holder_id = currentUserId`、`moved_by = currentUserId`（代理入力時は対話で別 holder を選択可能、`holder_note` から候補生成）
- 個体管理（`tracking_type='individual'`）は `unit_numbers[]` の各番号で1行ずつ INSERT する
- 数量管理（`tracking_type='quantity'`）は1行で `quantity` を INSERT する
- 「電動工具全返却」のような対象不特定は🔴登録不可とし、一覧の返却モードへ誘導する

#### Priority
critical

#### UX制約
- Must 閾値: 持出登録の操作ステップ **3タップ以内**（自然文入力 → 確認 → 確定）
- Must 閾値: LLM 応答 **p95 5秒以内**（タイムアウト時はリトライ／手動入力誘導）
- Must 閾値: 確定後の一覧反映 **1秒以内**
- 禁止挙動: 確信度のみで自動 INSERT しない（D-4）。LLM 推論で対象を補完しない（D-5）
- 参考類似サービス: 現状の LINE 自然文運用（既存習慣を殺さない）

#### エッジケース
- 同一 unit_number の重複 INSERT（既に持出中の番号を再度持出）→ 確認カード上で「すでに持出中」と表示し、それでも確定するなら append-only として記録（事実として「もう一回 checkout」イベントが起きた、と扱う。打消しイベントで訂正可能）

---

### F3. 一覧表示

#### 概要
`v_currently_out` View から「現在持出中の個体」を読み、自分軸デフォルトで表示する。フィルタ・検索・経過日数の可視化を行う。

#### 条件
- デフォルトスコープは **「自分の持出中」**（`holder_id = currentUserId`）
- スコープセグメント「自分／全員」、現場フィルタ（プルダウン）、フリー検索（工具名／番号／現場名）を提供
- 各行に: 工具名・unit_number（個体時）・数量（数量時）・現場・保持者・最終 movement の `moved_at`
- 経過日数（`days_out`）が **3日以上で赤バッジ表示**、7日以上で警告色強化（閾値はアプリ側、View には `days_out` が含まれる）
- カードタップは閲覧モードでは **無効**（誤操作防止、D-8 スワイプ／ロングプレス禁止）

#### Priority
critical

#### UX制約
- Must 閾値: 初期表示 p95 **2秒以内**（View JOIN の最適化を要求）
- Must 閾値: フィルタ／検索の即時反映 **300ms以内**（クライアント側フィルタ）
- 禁止挙動: 状態カラム参照禁止（罠A、View 経由必須）
- 参考類似サービス: スプレッドシートのフィルタ感覚（直感的）

---

### F4. クイック返却（モード切替・複数選択一括返却）

#### 概要
一覧画面に「返却」モードを設け、複数選択 → 一括返却で `movement_type='return'` 行を INSERT する。「状態カラムの書き換え」では実装しない（D-2、罠A）。

#### 条件
- 「返却」ボタンで返却モードへ遷移（検索バー消失、チェックボックス出現）
- 「全選択」「全解除」「×（閲覧モードへ復帰）」を提供
- 選択件数バッジ表示「選択 N 点」
- 「選択した N 点を返却」確定で、各 unit_id に対し `movement_type='return'`, `from_location_id=現場, to_location_id=倉庫, holder_id=null, moved_by=currentUserId` の行を INSERT
- INSERT 成功時、一覧から該当行が消える（View 経由で消える、実体の状態カラム更新は存在しない）
- 「電動工具全返却」のような自然文 LLM 推論での全返却は実装しない（D-5）。返却は必ず本モードでの **明示選択** で行う

#### Priority
critical

#### UX制約
- Must 閾値: 一括返却 N 点の INSERT 完了 **2秒以内**（N≤30 想定、トランザクション単位）
- 禁止挙動: スワイプ／ロングプレスでの返却は実装しない（D-8）
- 禁止挙動: 状態書き換えでの返却は実装しない（D-2）

---

### F5. 信号色UI（確認カード）

#### 概要
CaaF入力の確認カードを、**確信度 × マスタ参照一致** の2軸で🟢🟡🟠🔴の信号色付きで表示する。**色は表示のみ、自動 INSERT 判定には使わない**（D-3/D-4）。

#### 条件
- 🟢 緑: 高確信(≥0.8) × マスタ全一致 × 状態矛盾なし → Phase1で自動化候補（MVPは人がタップ）
- 🟡 黄: 中確信(0.6〜0.8) → 該当項目ハイライト、タップ確定
- 🟠 橙: マスタ未一致あり OR 低確信(<0.6) → 新規登録 or 候補選択を促す
- 🔴 赤: 対象不特定 / items が空 → 確定不可ボタン無効化、返却モードへ誘導文を表示

#### Priority
standard

---

### F6. マスタ管理（items / individual_units / locations 最小）

#### 概要
工具マスタ（種類）と個体（unit_number）、保管場所（倉庫＋現場）の登録・更新を行う。MVP は最小機能（一覧 + 新規作成）に絞る。

#### 条件
- items の登録: 名前・カテゴリ（`tool`/`material`/`consumable`）・追跡方式（`individual`/`quantity`）・任意 item_code・notes
- individual_units の登録: 既存 item を選び unit_number を追加（item 内ユニーク、DDL の UNIQUE 制約に従う）
- locations: kind=`warehouse`（本社倉庫）と kind=`site`（現場、`project_id` を保持）
- 廃止／紛失は `is_active=false` での **論理削除のみ**。物理削除は禁止
- CaaF 入力で「マスタ未一致」工具名が出た場合、F2 確認カード内から本機能の「新規登録」を呼び出せる

#### Priority
standard

---

### F7. 経過日数の可視化

#### 概要
View `v_unit_current_status.days_out` を一覧に表示し、返却漏れの可視化を補助する。閾値判定はアプリ側で行い、View には残さない。

#### 条件
- `days_out >= 3` → 赤バッジ「N日経過」
- `days_out >= 7` → 強警告（背景色の変化など。`days_out` は View の `case when movement_type in ('checkout','transfer') then ...` で計算される）
- プッシュ通知での催促は MVP 範囲外（DONT 参照）

#### Priority
standard

---

## 制約

### 設計原則の絶対遵守（罠A / append-only）
- 実体テーブル（`items` / `individual_units`）に `status` / `current_holder` / `current_location` 等の状態カラムを **絶対に追加しない**（罠A）
- 状態は `item_movements` の最新行から View で導出する（`v_unit_current_status` / `v_currently_out`）
- `item_movements` は **append-only**。UPDATE / DELETE しない（D-1）。訂正は「打消しイベント」を新規 INSERT で表現する
- RLS は SELECT / INSERT のみ許可。UPDATE / DELETE ポリシーは **作らない**（append-only 担保）
- `holder_id`（実際の保持者）と `moved_by`（入力者）は **別カラム**に保持。代理入力（例: 大内くん持出をしょーや入力）を区別する（D-7）

### 命名
- テーブル名は `tools` ではなく `items`（D-6）。資材統合（Phase 2）を命名で成立させる

### 段階的自動登録（Phase 0 = 全件確認）
- MVPは🟢でも人がタップ確定する。自動 INSERT ロジックは作らない（D-4）
- Phase 1 以降の自動化は運用ログで安全確認後

### LLM
- Gemini Flash Lite（本番）と Claude API（開発時）を **LLM router 経由** で切替可能にする
- LLM は抽出器。生成・創作・補完は禁止（D-5）
- `confidence` は信号色表示と運用分析のログ用途のみ。状態判定には使わない（D-3）

### 操作
- スワイプ／ロングプレス禁止（D-8）。グローブ操作前提
- ボタンは明示タップで操作

### ストレージ
- Supabase が SSOT。Google Workspace は補助／エクスポートのみ（D-9）

### ARC
- monolith（単一デプロイ単位、Supabase + Next.js App Router + LLM router）
- 将来 Platform 統合時に `holder_id` / `moved_by` → `platform.employees(id)`、`project_id` → `platform.projects(id)` への FK 付与で疎結合を締める（本 SPEC は変更不要にする）

---

## 機能間相互作用（永続化レイヤ・状態共有）

### 共有レイヤ一覧
- DB テーブル `miniapps_tools.item_movements`: 全機能（F2/F4/F7）が読み書きの中心
- View `miniapps_tools.v_unit_current_status` / `v_currently_out`: F3/F7 が読み出し
- マスタ `items` / `individual_units` / `locations`: F2/F4/F6 が読み、F6 が書き

### 副作用マトリクス

| 機能実行 | 影響先機能 | 副作用内容 |
|---|---|---|
| F2 CaaF確定（checkout INSERT） | F3/F7 | 該当個体が一覧に出現、`days_out=0` で開始 |
| F4 一括返却（return INSERT） | F3/F7 | 該当個体が一覧から消失（View 経由） |
| F6 items.is_active=false | F2/F3 | CaaF抽出のマスタ参照一致から外れる、既存持出中は表示維持 |
| F6 individual_units.is_active=false | F2/F3 | 既存持出中は表示維持、新規 checkout は不能 |

### 同時刻整合性ルール
- `item_movements` の INSERT は **常に append**。同一 unit_id への複数イベントは `moved_at desc` で最新が現在状態
- 訂正は打消しイベントの追加 INSERT（UPDATE 禁止）
- 同一 unit_id への並行 INSERT は楽観的並行制御で OK（最新行で View が再計算される）

---

## データモデル進化

### 現行バージョン
v0.1 MVP（DDL は `supabase/migrations/0001_init_miniapps_tools.sql`）

### 互換性ポリシー
**full-compat**（MVP は新規導入のため。Phase 2 資材統合時に enum 拡張・category='material' 追加が予定されており、その際は read-compat 以上を維持する）

### デプロイ戦略
expand-contract（enum 追加は expand、既存利用面の削除は contract）

### 進行中のマイグレーション
なし（新規導入）

### 将来の統合接続ポイント
- `holder_id` / `moved_by` → `platform.employees(id)` に FK 付与（Platform 統合時）
- `project_id` → `platform.projects(id)` に FK 付与（同上）
- アクティビティフィード → `item_movements` を時系列で読むだけ（追加テーブル不要）
- 資材統合 → `category='material'` + `tracking_type='quantity'` で同テーブル運用
