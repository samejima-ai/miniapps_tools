# 推論的センサー

LLMによる確率的判定。仕様合致の自己評価に使う。L1 自己検証で実行。

## 仕様合致チェック

以下の観点で SPEC.md / DESIGN.md / DONT.md と実装を照合する。

### チェック項目
- [ ] SPEC.md に記載された全機能（F1〜F7）が実装されているか
- [ ] 各機能の条件が満たされているか（UX制約の Must 閾値含む）
- [ ] DONT.md の禁止事項（罠A, D-1〜D-9）に違反していないか
- [ ] DESIGN.md トークンが TSX / CSS から参照されているか（HEX 直書きなし）
- [ ] CaaF 抽出結果が `spec/domain.ts` の Zod スキーマで validate されているか
- [ ] item_movements の INSERT が常に append-only パスを通っているか（service_role 直接 DELETE/UPDATE なし）

### 判定基準
- 全項目クリア → 献上可能
- 1項目でも未クリア → 自力修正を試みる → 修正不可能なら DELIVERY.md の「フィードバックレポート」に記載

## 「動く」チェック

- アプリケーションが起動するか（`pnpm run dev` で http://localhost:3000 が 200）
- ゲート画面で社員選択ができるか
- 入力タブで自然文を送信し、信号色付き確認カードが表示されるか
- 「確定」タップで一覧タブへ遷移し、新規行が反映されるか
- 一覧返却モードで複数選択 → 一括返却が成功するか
- 返却後、一覧から該当行が消えるか

## 「使える」チェック

- 持出登録が 3 タップ以内で完了するか（UX Must 閾値）
- LLM 応答が p95 5秒以内か（タイムアウト時にエラー表示が出るか）
- カードタップが閲覧モードで無効化されているか（誤操作防止）
- 信号色（緑/黄/橙/赤）が確信度×参照一致のロジックで正しく決まるか
- 「電動工具全返却」入力時に🔴登録不可となり、返却モードへ誘導されるか
- 経過日数 3 日以上で赤バッジが出るか

## 罠A / append-only の運用上チェック

### 状態は View 経由でのみ取得しているか
- `src/lib/supabase/` 配下のクエリが `v_unit_current_status` / `v_currently_out` / `v_item_quantity_status` のいずれかを使っているか
- 直接 `items` テーブルから `current_holder` 等を取得していないか（grep + 推論判定）

### 返却が `movement_type='return'` INSERT で実装されているか
- F4 一括返却の実装で UPDATE 系の SQL を生成していないか
- Supabase Client の `.update()` / `.delete()` が `item_movements` に対し呼ばれていないか

### 代理入力 UI が機能しているか
- LLM 抽出結果に `holder_note` が含まれる場合、UI で別 holder 選択 UI が出るか
- 選択された結果が `holder_id`（≠ `moved_by`）として INSERT されるか

## DESIGN.md 視覚整合

### 第 5 層 Vision モデル判定
- `delivery/screenshots/` に保存された主要4画面のスクショと DESIGN.md `## Do's and Don'ts` を Vision モデルに入力
- 検出対象:
  - フォントウェイト 3 種以上混在（Don't 違反）
  - `colors.error` の通常通知への流用（Don't 違反）
  - `colors.primary` の装飾背景使用（Don't 違反）
  - `colors.signal-*` の信号UI以外での使用（Don't 違反）
- 結果は `delivery/VERIFICATION.md` の「視覚検証」セクションに記録

### LLM プロンプト品質
- CaaF 抽出プロンプトが「JSON 以外を出力しない」「items 空時は ambiguities に出す」「全返却は推論しない」を明示しているか
- 開発時の Claude API と本番の Gemini Flash Lite で抽出精度の差を測定するログがあるか
