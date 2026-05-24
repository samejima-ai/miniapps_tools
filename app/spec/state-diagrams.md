# L0-4 状態遷移図（Mermaid）

XState v5 定義は `spec/state-machine.ts` 参照。本書はその可視化と説明。

---

## 1. AppMachine — アプリ全体の画面遷移

```mermaid
stateDiagram-v2
    [*] --> gate

    gate --> authenticated: EMPLOYEE_SELECTED / setUser

    state authenticated {
        [*] --> list

        state list {
            [*] --> viewing

            viewing --> returning: ENTER_RETURN_MODE
            returning --> viewing: EXIT_RETURN_MODE
        }

        input --> list: GO_LIST
        list --> input: GO_INPUT (only from viewing)
    }

    authenticated --> gate: SWITCH_USER / clearUser
```

### 状態の意味

| 状態 | 説明 |
|---|---|
| `gate` | 社員選択画面（F1 ユーザー識別）。未認証 |
| `authenticated.input` | CaaF入力タブ（F2/F5） |
| `authenticated.list.viewing` | 一覧タブ・閲覧モード（F3/F7）。カードタップ無効 |
| `authenticated.list.returning` | 一覧タブ・返却モード（F4）。チェックボックスでの複数選択 |

### 遷移イベント

- `EMPLOYEE_SELECTED` — ゲートで社員選択
- `GO_INPUT` / `GO_LIST` — タブ切替（タブクリック）
- `ENTER_RETURN_MODE` / `EXIT_RETURN_MODE` — 一覧内モード切替
- `SWITCH_USER` — ヘッダー「切替」ボタンでゲートへ戻る

### 設計意図

- 返却モードは一覧の子状態。誤返却防止のため**閲覧と返却を物理的にモード分離**（方式B、SPEC F4 参照）
- `SWITCH_USER` は authenticated のどこからでも発火可能（複数人で端末共有想定）

---

## 2. CaaFCardMachine — 確認カードのライフサイクル

```mermaid
stateDiagram-v2
    [*] --> idle

    idle --> extracting: SUBMIT_TEXT / storeInput
    extracting --> reviewing: EXTRACTION_SUCCESS [action != return] / storeExtraction
    extracting --> redirecting: EXTRACTION_SUCCESS [action == return] / storeExtraction
    extracting --> error: EXTRACTION_ERROR / storeError

    reviewing --> confirmed: CONFIRM [canConfirm]
    reviewing --> idle: EDIT
    reviewing --> idle: RESET / reset

    redirecting --> idle: REDIRECT_TO_RETURN_MODE / reset
    error --> extracting: SUBMIT_TEXT / storeInput
    error --> idle: RESET / reset
    confirmed --> idle: RESET / reset
```

### 状態の意味

| 状態 | 説明 |
|---|---|
| `idle` | 自然文未入力 or 入力前 |
| `extracting` | LLM ルーター呼出中（タイムアウト 5000ms） |
| `reviewing` | 抽出結果を信号色付き確認カードで表示中。人間タップ待ち |
| `redirecting` | LLM が `action="return"` を抽出 → 一覧返却モードへ誘導フェーズ |
| `error` | パース失敗 / タイムアウト |
| `confirmed` | INSERT 完了。次の入力に備え `RESET` で `idle` へ |

### ガード（`canConfirm`）

- `extraction !== null`
- `extraction.items.length > 0`
- `signal !== "red"`
- `extraction.action !== "return"`

これは **「Phase 0 全件確認」「曖昧な返却を LLM 推論で展開しない」（D-5）** を機械的に担保する不変条件。

### 信号色の決定（status マシン外、純粋関数）

```
signal = computeSignal(extraction)
  if items.length == 0          → "red"
  if anyItem.confidence < 0.6   → "orange"
  if anyMasterMismatch          → "orange"
  if minConfidence >= 0.8       → "green"
  if minConfidence >= 0.6       → "yellow"
  else                          → "orange"
```

実装は `src/lib/llm/signal.ts`（モックは `caaftoolmockv3.jsx` の `signalOf` 関数を参照）。

### 設計意図

- `action=return` を **状態マシン内で別ルート（redirecting）に分岐** することで、CaaF カードからは返却 INSERT を絶対に発火させない（D-5、罠A補助）
- `confirmed` は副作用（INSERT）の責務を持たず、純粋に「人が確定タップした」事実を表現。実 INSERT は外部 effect handler が担う
- `RESET` は失敗・成功問わず `idle` へ戻る共通経路。連続入力に最適化

---

## 3. UnitMachine — 個体の状態ライフサイクル（M0 追加、ADR-004）

```mermaid
stateDiagram-v2
    [*] --> in

    in --> out: CHECKOUT / setHolder
    in --> lost: REPORT_LOST
    in --> deactivated: DEACTIVATE

    out --> in: RETURN / clearHolder
    out --> out: TRANSFER
    out --> lost: REPORT_LOST / clearHolder

    lost --> in: REPORT_FOUND
    lost --> deactivated: DEACTIVATE

    deactivated --> [*]
```

### 状態の意味

| 状態 | 説明 | view 導出条件 |
|---|---|---|
| `in` | 倉庫在庫（デフォルト = 事務所・倉庫） | 最新 movement が `return` / `found` / null |
| `out` | 現場に持出中 | 最新 movement が `checkout` / `transfer` |
| `lost` | 紛失中（所在不明） | 最新 movement が `lost` |
| `deactivated` | 論理削除（廃棄） | `is_active=false`（view から除外される、終端） |

### 不変条件

- **二重持出禁止（D-11）**: `out` 状態から `CHECKOUT` イベントは受理しない
- **紛失中の持出禁止**: `lost` から `CHECKOUT` / `RETURN` は受理しない。先に `REPORT_FOUND` で `in` 復帰必須
- **廃棄は終端（D-12）**: `deactivated` から復帰経路なし。紛失とは別概念
- **append-only との整合**: 全遷移は新規 movement INSERT で発火。状態カラム書き換えは存在しない（罠A）

### 実装との対応

| マシンイベント | 実装 |
|---|---|
| `CHECKOUT` | `confirmCheckoutAction` で `item_movements.movement_type='checkout'` INSERT |
| `RETURN` | F4 クイック返却で `movement_type='return'` INSERT |
| `TRANSFER` | M2 拡張候補（現場間直接移送） |
| `REPORT_LOST` | `reportLost()` で `movement_type='lost'` INSERT |
| `REPORT_FOUND` | `reportFound()` で `movement_type='found'` INSERT |
| `DEACTIVATE` | `deactivateUnit()` で `is_active=false` UPDATE |

### 設計意図

- view 経由で導出される実体ステータスと UI の概念モデルを一致させる（罠A の補強）
- 二重持出は確定ハンドラ側（`confirmCheckoutAction`）でも error 返却するが、状態マシンレベルでも禁止を明示
- 紛失と廃棄を異なる状態として持つことで、復帰可能性 / 表示先（/lost vs マスタ非表示）を区別
