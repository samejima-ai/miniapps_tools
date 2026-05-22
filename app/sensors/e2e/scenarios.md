# E2E シナリオ定義（第 2 層 機械検証）

Playwright で実行する E2E シナリオ。critical Priority の F1〜F4 を網羅する。
詳細プロトコルは Level A skill `../../layer2-orchestrator/references/e2e-integration.md` を参照（本ファイルは L1 単独 / M2 で参照される）。

---

## 共通設定

- baseURL: `http://localhost:3000`
- timeout: 30,000 ms
- browsers: `chromium`（mobile viewport 430x780）
- fixtures: `tests/e2e/fixtures/seed.ts` でテスト用社員・items・units・locations を投入
- スクショ保存先: `delivery/screenshots/`

---

## シナリオ E2E-001: Gate → Employee 選択 → 一覧表示

- **Priority**: critical（F1, F3）
- **前提**: テスト用社員 `u_shoya`（しょーや）が存在、SEED データ（マキタ18Vバッテリー #18 を u_shoya 保持中）
- **操作**:
  1. ホームページを開く
  2. Gate 画面で「しょーや」を選択
  3. 一覧タブが表示される
- **期待結果**:
  - ヘッダーに「しょーや」が表示
  - 「自分」スコープで持出中の行 1 件以上が表示
  - `delivery/screenshots/E2E-001-gate.png` と `E2E-001-list-self.png` が保存される

---

## シナリオ E2E-002: CaaF 入力 → 確認カード → 確定 → 一覧反映

- **Priority**: critical（F2, F5, F3）
- **前提**: E2E-001 完了状態
- **操作**:
  1. 「入力」タブをタップ
  2. テキストエリアに「古田様邸\nマキタ18Vバッテリー11.18番\n充電攪拌機2番\n持ち出し」を入力
  3. 送信ボタンタップ
  4. 確認カード表示（信号色 green or yellow 期待）
  5. 「確定」ボタンタップ
- **期待結果**:
  - LLM 抽出が p95 5秒以内（IC-2）
  - 確認カードに「マキタ18Vバッテリー #11 #18」「充電攪拌機 #2」が表示
  - 「確定」タップで一覧タブへ遷移
  - 一覧に新規 3 件が反映される（IC-6 ≤ 1秒）
  - 一覧反映後 `delivery/screenshots/E2E-002-card.png` と `E2E-002-list-after.png` が保存

---

## シナリオ E2E-003: 「電動工具全返却」入力 → 🔴登録不可 → 返却モード誘導

- **Priority**: critical（F2, F4, F5）
- **前提**: 持出中の個体が複数存在
- **操作**:
  1. 「入力」タブで「グローリアス和合東\n電動工具全返却しました」を入力
  2. 送信
- **期待結果**:
  - 信号色 **red** で表示
  - 「対象が特定できません」相当の ambiguities 表示
  - 「確定」ボタンが**無効化**されている（disabled）
  - 一覧返却モードへの誘導文が表示
  - `delivery/screenshots/E2E-003-red-card.png` が保存

---

## シナリオ E2E-004: 一覧 → 返却モード → 複数選択 → 一括返却

- **Priority**: critical（F4）
- **前提**: 自分の持出中が 3 件以上
- **操作**:
  1. 一覧タブで「返却」ボタンタップ
  2. チェックボックス 2 件選択
  3. 「選択した 2 点を返却」ボタンタップ
- **期待結果**:
  - 選択件数バッジ「2」が表示
  - 一括返却が IC-5 ≤ 2,000 ms で完了
  - 一覧から該当 2 件が消える（View 経由、IC-6 ≤ 1秒）
  - `delivery/screenshots/E2E-004-return-selected.png` と `E2E-004-after-return.png` が保存

---

## シナリオ E2E-005: フィルタ・検索の即時反映

- **Priority**: standard（F3）
- **前提**: 「自分／全員」「現場」「フリー検索」のテストデータが存在
- **操作**:
  1. 「全員」セグメントタップ
  2. 現場ドロップダウン「古田様邸」選択
  3. フリー検索に「バッテリー」入力
- **期待結果**:
  - 各フィルタ変更が IC-4 ≤ 300 ms で反映
  - 結果件数が正しく絞り込まれる
  - `delivery/screenshots/E2E-005-filters.png` が保存

---

## シナリオ E2E-006: 経過日数 3 日以上の赤バッジ表示

- **Priority**: standard（F7）
- **前提**: 5 日前に checkout された個体 1 件がテストデータに存在
- **操作**:
  1. 一覧表示
- **期待結果**:
  - 該当行に「5日経過」赤バッジが表示
  - `delivery/screenshots/E2E-006-overdue.png` が保存

---

## シナリオ E2E-007: 代理入力（holder_id ≠ moved_by）

- **Priority**: critical（F2、D-7）
- **前提**: 社員「しょーや」と「大内くん」が存在
- **操作**:
  1. しょーやでログイン
  2. CaaF 入力「七宗町 鉄塔塗装\n充電サンダー 1台\n大内くん持ち出します」
  3. 抽出結果の `holder_note="大内くん"` で「大内くんを保持者として登録」を選択
  4. 確定
- **期待結果**:
  - INSERT された行が `holder_id="大内くんのID"`, `moved_by="しょーやのID"` で記録される
  - 一覧で全員スコープに切替えると、大内くんの持出として表示される
  - `delivery/screenshots/E2E-007-delegate.png` が保存

---

## シナリオ E2E-008: ユーザー切替

- **Priority**: standard（F1）
- **操作**:
  1. しょーやでログイン中
  2. ヘッダー「切替」ボタンタップ
  3. Gate 画面で「リム」選択
- **期待結果**:
  - Gate へ遷移、再選択でリムとしてログイン
  - 「自分」スコープでリムの持出が表示
  - `delivery/screenshots/E2E-008-switch.png` が保存

---

## 全シナリオ実行コマンド

```bash
pnpm run test:e2e            # 全シナリオ
pnpm run test:e2e -- --grep "E2E-001"  # 個別
pnpm run test:e2e:update     # baseline スクショ更新
```

## CI 統合

- PR 作成時に `pnpm run test:e2e` を実行
- スクショ差分（baseline 比較）は `delivery/screenshots/diff/` に出力
- baseline 更新は人間レビュー必須（autonomous-drive workflow の判断対象外）
