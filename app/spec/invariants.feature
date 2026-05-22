# L0-6 層間不変条件 — Gherkin (Happy / Sad / Evil 三分類)
#
# 罠A 群（DONT.md 参照）を機械可読な不変条件として落とす。
# L1 実装時のテスト基盤（vitest / playwright）で本 .feature を検証する。

Feature: 罠A遵守 - 状態は View 経由で導出する

  状態カラムを実体テーブルに持たせない設計を守ること。
  状態（持出中 / 在庫）は item_movements の最新行から View で導出される。

  # ========== Happy Path ==========
  Scenario: Happy - checkout 後に v_unit_current_status で out が導出される
    Given items テーブルに "マキタ18Vバッテリー" (id=I1, tracking_type=individual) が登録されている
    And individual_units に I1 の #7 (id=U7) が登録されている
    And locations に "本社倉庫"(id=L_W, kind=warehouse) と "古田様邸"(id=L_S, kind=site) が登録されている
    When item_movements に (item_id=I1, unit_id=U7, movement_type=checkout, from=L_W, to=L_S, holder_id=H1, moved_by=H1) を INSERT する
    Then v_unit_current_status で unit_id=U7 の current_status は "out" になる
    And current_holder_id は H1 になる
    And current_project_id は L_S に紐づく project_id になる

  Scenario: Happy - return 後に v_unit_current_status で in が導出される
    Given U7 が checkout 済（current_status=out）
    When item_movements に (item_id=I1, unit_id=U7, movement_type=return, from=L_S, to=L_W, holder_id=null, moved_by=H1) を INSERT する
    Then v_unit_current_status で unit_id=U7 の current_status は "in" になる
    And v_currently_out には U7 が含まれない

  # ========== Sad Path ==========
  Scenario: Sad - items テーブルに status カラムを追加しようとすると CI で検出される
    Given supabase/migrations/ 配下のいずれかが items / individual_units テーブルに status / current_holder / current_location カラムを追加する DDL を含む
    When CI で migration lint を実行する
    Then エラー "罠A違反: 状態カラムを実体テーブルに追加してはならない" で fail する

  # ========== Evil Path ==========
  Scenario: Evil - アプリ層が v_unit_current_status を経由せず生 items テーブルから状態を読もうとする
    Given src/ 配下のコードが items テーブルに対し `.status` プロパティを参照する
    When grep "items.status\|item.status" を src/ で実行する
    Then 検出件数 0（views を経由していない参照は禁止）

# ----------------------------------------------------------------------------

Feature: append-only - item_movements は UPDATE / DELETE しない

  訂正は打消しイベント INSERT で表現すること（D-1, D-2）。

  Scenario: Happy - 訂正は打消しイベントで行う
    Given item_movements に誤った checkout 行 (movement_id=M1, unit_id=U7) が存在する
    When 訂正のため新規 INSERT で打消しイベント (notes="訂正:M1の取消", movement_type=return, unit_id=U7) を追加する
    Then M1 は履歴として残る（UPDATE / DELETE されない）
    And v_unit_current_status は最新 movement に基づき正しい状態を返す

  Scenario: Sad - item_movements の UPDATE ポリシーが定義されている
    Given supabase/migrations/ 配下が item_movements への UPDATE policy を作成する CREATE POLICY 文を含む
    When CI で RLS policy lint を実行する
    Then エラー "append-only違反: item_movements の UPDATE / DELETE policy は禁止" で fail する

  Scenario: Sad - item_movements の DELETE ポリシーが定義されている
    Given supabase/migrations/ 配下が item_movements への DELETE policy を作成する CREATE POLICY 文を含む
    When CI で RLS policy lint を実行する
    Then エラー "append-only違反: item_movements の DELETE policy は禁止" で fail する

  Scenario: Evil - 開発者が「便利だから」と service_role で物理削除を試みる
    Given service_role を使った DELETE FROM miniapps_tools.item_movements クエリが src/ または scripts/ に書かれる
    When grep "delete.*from.*item_movements\|DELETE FROM.*item_movements" を実行する
    Then 検出件数 0
    Or 該当箇所が「打消しイベント INSERT に変更してください」のコメント付きで block される

# ----------------------------------------------------------------------------

Feature: holder_id と moved_by の分離

  代理入力（例: 大内くん持出をしょーや入力）を区別して保存すること（D-7）。

  Scenario: Happy - 代理入力で holder_id != moved_by
    Given currentUserId = "u_shoya" (しょーや)
    And LLM抽出結果の holder_note = "大内くん"
    When ユーザーが UI で holder_note を確認し、別社員 "u_ouchi"（大内くん）を holder として指定する
    And item_movements に (holder_id="u_ouchi", moved_by="u_shoya", ...) を INSERT する
    Then 当該行で holder_id != moved_by である

  Scenario: Happy - 代理ではない通常入力で holder_id == moved_by
    Given currentUserId = "u_shoya"
    And LLM抽出結果の holder_note = null
    When ユーザーが確定する
    And item_movements に INSERT される
    Then holder_id = "u_shoya" かつ moved_by = "u_shoya"

  Scenario: Sad - holder_id と moved_by を統合する型定義
    Given spec/domain.ts の ItemMovement 型から holder_id または moved_by のどちらかが削除されている
    When CI で domain.ts と DDL の整合チェックを行う
    Then エラー "D-7違反: holder_id と moved_by の分離は必須" で fail する

  Scenario: Evil - アプリ層が holder_id を moved_by から自動代入する
    Given src/ 配下が `holder_id: currentUserId, moved_by: currentUserId` を**例外なく**全 INSERT で実行する（代理入力UIをスキップ）
    When 推論センサーが UI フローを検査する
    Then 「代理入力選択肢が表示されない」フローが検出され、独立検証で警告される

# ----------------------------------------------------------------------------

Feature: Phase 0 全件確認 - LLM 抽出結果は人間タップで確定する

  自動 INSERT ロジックは実装しないこと（D-4）。

  Scenario: Happy - 確信度 0.95 の緑信号でも人がタップして INSERT される
    Given LLM抽出結果の minConfidence = 0.95（signal = green）
    When ユーザーが「確定」ボタンをタップしない
    Then item_movements に INSERT されない（待機継続）

  Scenario: Happy - 人がタップしてはじめて INSERT される
    Given LLM抽出結果の minConfidence = 0.95（signal = green）
    When ユーザーが「確定」ボタンをタップする
    Then item_movements に INSERT される

  Scenario: Sad - 確信度ベースの自動 INSERT コードが混入
    Given src/ 配下に `if (confidence >= 0.8) await insertMovement(...)` のようなコードが存在する
    When grep で `confidence.*>=.*insertMovement\|if.*confidence.*await.*Insert` を検査
    Then 検出件数 0

  Scenario: Evil - 開発者が「ユーザーが速くしたいって言ってる」を理由に自動INSERTを実装
    Given Phase 1 移行時の閾値判定なしに自動 INSERT を実装する PR が提出される
    When layer1-independent-reviewer が自己検証する
    Then 「D-4 違反: Phase 0 全件確認の解除は ADR + Council 諮問必須」で reject

# ----------------------------------------------------------------------------

Feature: 個体 / 数量 の排他

  ItemMovement の unit_id と quantity は排他制約（DB CHECK + Zod refine）。

  Scenario: Happy - individual は unit_id 必須、quantity は null
    When item_movements に (item_id=I1, unit_id=U7, quantity=null, movement_type=checkout) を INSERT
    Then INSERT 成功

  Scenario: Happy - quantity は quantity 必須、unit_id は null
    When item_movements に (item_id=I_material, unit_id=null, quantity=3, movement_type=inbound) を INSERT
    Then INSERT 成功

  Scenario: Sad - 両方 null
    When item_movements に (item_id=I1, unit_id=null, quantity=null, ...) を INSERT
    Then CHECK 制約 chk_individual_xor_quantity 違反でエラー

  Scenario: Sad - 両方 non-null
    When item_movements に (item_id=I1, unit_id=U7, quantity=3, ...) を INSERT
    Then CHECK 制約 chk_individual_xor_quantity 違反でエラー

# ----------------------------------------------------------------------------

Feature: 「電動工具全返却」の LLM 推論禁止

  対象不特定の曖昧表現を LLM 推論で展開しないこと（D-5）。返却は明示選択で行う。

  Scenario: Happy - 「電動工具全返却」入力時に信号赤・登録不可
    Given ユーザーが入力欄に「グローリアス和合東 電動工具全返却しました」と入力する
    When LLM 抽出が実行される
    Then 抽出結果は { action: "return", items: [], ambiguities: ["対象工具が不特定（一覧の返却モードで選択が必要）"] }
    And 信号色は red になる
    And 確認カードの確定ボタンは無効になる
    And 一覧返却モードへの誘導文が表示される

  Scenario: Sad - LLM が「電動工具」を items に展開してしまう（プロンプト不備）
    Given LLM プロンプトが「全」をパターンとして許容している
    When 「電動工具全返却」が入力される
    Then 抽出結果の items に LLM が推測した工具リストが含まれる（プロンプト改善が必要）
    And 推論センサーが本ケースを警告する

# ----------------------------------------------------------------------------

Feature: SSOT 整合 - DDL と Zod ドメイン定義の同期

  spec/domain.ts と DDL の乖離を検出すること。

  Scenario: Happy - 同期している
    Given DDL の item_movements カラム名と spec/domain.ts の ItemMovement フィールド名が camelCase 変換規則で一致する
    When 整合性チェックスクリプトを実行する
    Then 全カラムが対応する

  Scenario: Sad - DDL に新カラム追加、Zod 未更新
    Given DDL に新カラム `tracking_id` が追加されている
    And spec/domain.ts の ItemMovement に対応フィールドがない
    When 整合性チェックを実行する
    Then エラー「SSOT乖離: DDL の tracking_id が domain.ts に未反映」で fail
