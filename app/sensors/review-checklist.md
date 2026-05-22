# 独立検証 - プロジェクト固有チェックリスト

layer1-independent-reviewer がプロジェクト固有の検証観点を参照するチェックリスト。
agent本体は Level A に存在し、本ファイルがプロジェクト差異を吸収する。

---

## 必須確認項目（罠A 群、reject 即発火）

### 1. 状態カラムの不在
- [ ] `items` テーブルに `status` / `current_holder` / `current_location` 等のカラムが**存在しない**
- [ ] `individual_units` テーブルに同上のカラムが**存在しない**
- [ ] 違反時: 即 reject + 「罠A違反、View 経由で導出する設計に戻す」とフィードバック

### 2. append-only の RLS 担保
- [ ] `item_movements` に UPDATE policy が**存在しない**
- [ ] `item_movements` に DELETE policy が**存在しない**
- [ ] 違反時: 即 reject + 「D-1 違反、訂正は打消しイベント INSERT で表現する」とフィードバック

### 3. holder_id ≠ moved_by の分離
- [ ] `spec/domain.ts` の `ItemMovement` 型に `holderId` と `movedBy` が**別フィールド**として存在する
- [ ] DDL の `item_movements` テーブルに `holder_id` と `moved_by` が**別カラム**として存在する
- [ ] 代理入力 UI（`holder_note` を確認させる流れ）が `src/app/input/` 配下に実装されている
- [ ] 違反時: 即 reject + 「D-7 違反、代理入力区別は MVP の核要件」

### 4. Phase 0 全件確認
- [ ] `src/` 配下に `confidence >= 閾値` 単独での自動 INSERT 実装が**存在しない**
- [ ] CaaFCardMachine の `confirmed` 状態への遷移が **CONFIRM イベント**でのみ起こる
- [ ] 「電動工具全返却」相当の入力で確認カードの確定ボタンが**無効化**される
- [ ] 違反時: 即 reject + 「D-4 違反、Phase 0 は人間タップ必須」

### 5. テーブル命名（items / NOT tools）
- [ ] DDL のスキーマが `miniapps_tools` で、テーブル名が `items` / `individual_units` / `locations` / `item_movements`
- [ ] `tools` テーブルが**存在しない**
- [ ] 違反時: 即 reject + 「D-6 違反、資材統合のため命名は items」

---

## UI 必須確認項目

### 6. スワイプ / ロングプレス禁止
- [ ] `src/` 配下に `onSwipe` / `onLongPress` / `touchstart` + `setTimeout` 等のロングプレス実装が**存在しない**
- [ ] 違反時: 即 reject + 「D-8 違反、グローブ操作不能になる」

### 7. DESIGN.md トークン参照
- [ ] `src/` 配下の TSX / CSS に HEX リテラル（`#[0-9a-fA-F]{3,6}`）の直書きが**存在しない**（DESIGN.md トークン経由のみ）
- [ ] `tailwind.config.ts` が DESIGN.md の YAML フロントマターを参照している
- [ ] 違反時: warning（軽度 reject）+ 「DESIGN.md トークン経由に置換」

### 8. 一覧カードの閲覧モードでのタップ無効化
- [ ] `src/app/list/` 配下で、`returnMode === false` 時にカードタップで何も起きない実装になっている
- [ ] 違反時: warning + 「誤返却防止のため閲覧モードのタップは無効化」

---

## 視覚検証（第 5 層 Vision 判定）

### 9. DESIGN.md `## Do's and Don'ts` 遵守
- [ ] `delivery/screenshots/` の主要4画面スクショを Vision モデルで判定
- [ ] フォントウェイト 3 種以上混在なし
- [ ] `colors.error` の通常通知流用なし
- [ ] `colors.signal-*` の信号UI以外での使用なし
- [ ] `colors.primary` の装飾背景使用なし
- [ ] WCAG AA コントラスト比（4.5:1）違反なし
- [ ] タッチターゲット 44px 以上

---

## CaaF / LLM 確認項目

### 10. LLM 抽出結果の Zod 検証
- [ ] `src/lib/llm/router.ts` が LLM 応答を `CaaFExtractionResult` で parse している
- [ ] パース失敗時に CaaFExtractionError が throw され、UI でエラー表示
- [ ] 違反時: 警告 + 「型安全性なしの LLM 出力は危険」

### 11. 「全返却」推論禁止
- [ ] LLM システムプロンプトに「対象不特定は items 空 + ambiguities に出す」が明記されている
- [ ] 「電動工具全返却」入力で red 信号が決定論的に出る（テストケース存在）
- [ ] 違反時: 即 reject + 「D-5 違反、LLM 創作禁止」

### 12. LLM router の切替性
- [ ] `src/lib/llm/router.ts` で provider を `gemini-flash-lite` / `claude-api` から選択可能
- [ ] env var `LLM_PROVIDER` で切替可能
- [ ] タイムアウト 5000ms（UX Must 閾値）が実装されている

---

## ストレージ / 統合確認項目

### 13. Supabase が SSOT
- [ ] 業務データの主たる書き込み先が Supabase である
- [ ] Google Sheets / Drive / GAS が業務データ書込み先として src/ 配下に**存在しない**
- [ ] `localStorage` / IndexedDB に業務データを長期保存していない
- [ ] 違反時: 即 reject + 「D-9 違反、SSOT は Supabase」

### 14. 疎結合の維持
- [ ] `item_movements.holder_id` / `moved_by` が **抽象 ID 保持**（Supabase Auth user_id）で、Platform employees(id) への直接 FK がない
- [ ] `locations.project_id` も同様に疎結合
- [ ] 違反時: warning + 「統合フェーズで困る、抽象 ID 保持を維持」

---

## E2E / Interaction Cost 確認項目

### 15. UX Must 閾値の達成
- [ ] 持出登録 3 タップ以内（測定済）
- [ ] LLM 応答 p95 5秒以内（測定済）
- [ ] 一覧初期表示 p95 2秒以内
- [ ] フィルタ即時反映 300ms 以内
- [ ] 違反時: cosmetic warning（critical でない限り即 reject はしない）

### 16. Playwright 主要4画面スクショ
- [ ] `delivery/screenshots/` に Gate / Input / List(viewing) / List(returning) のスクショが存在
- [ ] 違反時: 即 reject + 「DESIGN.md 視覚検証経路の前提が崩れる」

---

## レビュー判定

### PASS 条件
- 必須確認項目 1〜5（罠A群）が全て PASS
- 必須項目 6〜8（UI）が全て PASS
- 視覚検証 9 が PASS
- CaaF 10〜12 が全て PASS
- ストレージ 13〜14 が PASS
- E2E 16 が PASS

### Conditional PASS（warning あり）
- cosmetic 違反のみ（trailing whitespace 等）

### REJECT
- 必須項目 1〜5 / 6〜8 / 10〜11 / 13 のいずれかで違反検出
- フィードバックは DELIVERY.md の該当 D-* 番号で具体化
