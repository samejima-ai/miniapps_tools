# スコープ外定義 / 禁止事項

AI能力の向上に伴い、将来的にスコープ内へ移行する可能性がある。
本書はプロジェクト**固有**のDON'Tを集約する。哲学レベルの DONT は dialog-harness 本体の DONT.md を参照。

---

## 罠A群（**最優先・絶対遵守**）

| # | 禁止事項 | 正しい実装 |
|---|---|---|
| **罠A** | 実体テーブル（`items` / `individual_units`）に `status` / `current_holder` / `current_location` 等の状態カラムを持たせない | 状態は `item_movements` 最新行から View（`v_unit_current_status`）で導出する |
| **D-1** | `item_movements` を UPDATE / DELETE しない（append-only） | 訂正は「打消しイベント」を新規 INSERT して表現する |
| **D-2** | 返却を「状態を `in` に書き換える」で実装しない | 返却 = `movement_type='return'` の行を INSERT する |
| **D-3** | LLM抽出の `confidence` を状態判定に使わない | confidence はログ／自動登録の安全分析専用。所在・状態は事実(movement)のみで決める |
| **D-4** | 自動登録を `confidence > 閾値` 単独で判定しない | 確信度 × 参照一致(マスタ実在)の2軸。かつ **MVP は Phase0=全件確認**（自動登録は無効） |
| **D-5** | LLM に欠損情報を創作・補完させない | LLM は抽出器。曖昧は `ambiguities` に出し、人間に確認させる |
| **D-6** | テーブル名を `tools` にしない | `items`（工具/資材の共通器）。資材統合を命名で成立させる |
| **D-7** | `holder_id`（保持者）と `moved_by`（入力者）を統合しない | 代理入力（例: 大内くん持出をしょーや入力）を区別して保存する |
| **D-8** | スワイプ / ロングプレス操作を実装しない | DESIGN.md準拠。明示ボタンで操作。グローブ操作前提 |
| **D-9** | Google Workspace を業務データの保存先にしない | Supabase が SSOT。GWS は補助／エクスポートのみ |
| **D-10** | ILIKE 複数ヒット時に先頭採用しない（M0 追加） | 複数件マッチは `candidates_proposed` として全候補を確度スコア付き提示。誤選択事故防止 |
| **D-11** | 既に持出中の unit へ二重持出を許可しない（M0 追加） | `v_currently_out` 照合で `unit_already_out` 検出 → 確定不可。物理的に矛盾するイベントを記録しない |
| **D-12** | 紛失と廃棄を 1 ボタンに統合しない（M0 追加） | 紛失 = 所在不明、復帰可能。廃棄 = `is_active=false`、復帰不可。語彙と UI を分ける |

---

## RLS 関連の追加禁止

- `item_movements` の UPDATE / DELETE ポリシーは **作成しない**（append-only の RLS 層担保）
- RLS を一旦無効化してデータ修正する運用は禁止（修正は打消しイベントで）
- `items` / `individual_units` の `is_active=false` 切替以外の物理削除は禁止

### M0 仮運用での GRANT 例外（ADR-005、M3 で撤回）

- `anon` ロールに以下を付与済（migration 0004）:
  - `items` / `individual_units` / `locations`: INSERT, UPDATE
  - `item_movements`: **INSERT のみ**（UPDATE/DELETE は付与しない、D-1 維持）
  - `item_name_aliases` / `project_name_aliases`: INSERT, UPDATE
- 仮運用の認証モデル（Gate 画面で名前タップ、Supabase Auth セッションなし）と整合
- **M3 Platform 統合直前に必ず revoke する**。認証経路を `auth.users` セッション経由に切替

---

## CaaF / LLM の禁止

- LLM 出力 JSON 以外の文章（前置き・解説）を受理しない。プロンプトでJSON出力に強制する
- `confidence ≥ 閾値` 単独での自動 INSERT は実装しない（Phase 0 は全件確認、Phase 1 以降の自動化は別 ADR で判断）
- 「電動工具全返却」のような曖昧表現を LLM 推論で展開しない。返却モードへ誘導する（D-5）
- 抽出 JSON にユーザー名（実名）を直接保存しない。社員選択 ID 経由で保持する（PII 配慮の最低ライン）

---

## UI 禁止

- スワイプ / ロングプレス（D-8）
- 一覧カードの閲覧モードでの誤タップ可能化（カードタップ無効を維持）
- DESIGN.md トークン外の HEX リテラルを `src/` 配下に直書きしない（grep 検査対象）
- DESIGN.md の `## Do's and Don'ts` 違反パターン（フォントウェイト3種混在 / `colors.error` の通常表示流用 等）

---

## ストレージ / 統合の禁止

- Google Workspace へのプライマリ書き込み（業務データを SSOT 化しない、D-9）
- LINE グループへの業務データ自動投稿（MVPでは LINE自動連携を作らない、Phase 2 候補）
- 業務データを `localStorage` / IndexedDB に **長期保存しない**（セッションキャッシュは可）

## 所在トラッキングの禁止（M0 + M2 拡張前提、ADR-006）

- デフォルト所在は **事務所・倉庫**。返却・初期在庫はここに置かれる前提
- 暗黙の場所遷移を作らない（必ず movement_type と to_location_id を明示）
- 想定される移動経路（M2 で UI 化）:
  - 事務所・倉庫 → 現場 / 他社譲渡 / 裏倉庫
  - 裏倉庫 → 事務所・倉庫
  - 現場 → 事務所・倉庫 / 別現場
- `裏倉庫` は明示移動 (`transfer`) でのみ更新。デフォルトでは選ばれない

## 紛失/廃棄の禁止（M0 追加）

- 紛失 (lost) と廃棄 (`is_active=false`) を **1 ボタンに統合しない**（D-12）
- 紛失イベントを「打ち消し」で消さない（D-1）。発見時は新規 `found` イベント INSERT
- 紛失中 unit を持出ようとした場合の二重持出 INSERT を許可しない（D-11 と同等）

---

## MVP のスコープ外（将来候補）

| スコープ外 | 移行候補フェーズ | 理由 |
|---|---|---|
| 画像認識による工具識別 | Phase 1 候補（別系統） | 常に確認必須、CaaF とは独立した経路 |
| 数量管理の運用 | Phase 2（資材統合） | MVPは器のみ用意、運用は資材統合で開始 |
| LINE グループ自動連携 | Phase 2 | まずコピペ取込で代用 |
| 返却漏れプッシュ通知 | Phase 2 | MVP は色での可視化のみ |
| QR / バーコード読取 | v1.1 | 物理タグの運用整備が前提 |
| Platform SSO 統合 / アクティビティフィード | 統合フェーズ | 疎結合スタートで `holder_id` / `moved_by` を抽象 ID 保持 |
| 工具点検 / 廃棄履歴の体系化 | Phase 2 | 現状は notes / `is_active` で代替 |

---

## AI（L1）に対する明示禁止

- 罠A・D-1〜D-9 のいずれかを「便利だから」と緩和する提案を SPEC 改変なしで実装に反映しない
- DDL を SSOT 優先順位（`.ts > .sql > .md`）の逆順で改変しない。DDL を変える場合は `spec/domain.ts` の Zod 定義も同時更新する
- 状態カラムを「キャッシュとして」追加する誘惑に乗らない（罠Aの再来）。最適化が必要なら View にマテリアライズドビュー化を検討する形で別 ADR を起票する
- DESIGN.md のトークン参照を破壊する HEX 直書きを `src/` に混入させない
