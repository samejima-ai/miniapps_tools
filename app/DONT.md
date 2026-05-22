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

---

## RLS 関連の追加禁止

- `item_movements` の UPDATE / DELETE ポリシーは **作成しない**（append-only の RLS 層担保）
- RLS を一旦無効化してデータ修正する運用は禁止（修正は打消しイベントで）
- `items` / `individual_units` の `is_active=false` 切替以外の物理削除は禁止

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
