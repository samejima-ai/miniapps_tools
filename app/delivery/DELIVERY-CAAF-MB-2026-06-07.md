# DELIVERY.md — CaaF gen-2 M-B（Extractor / IntentClassifier 注入実装）

## 体制情報
- Mode: M2 / LC=1 / dev_mode: autonomous / scope: full
- マイルストン: M-B（`spec/caaf-migration.md` §6 ロードマップ第 2 段）
- 自律修正回数: 1 / 上限 3（server-only がテストで throw する問題 → 純関数を server 結線から分離して解消。biome format 1 回）

## 実装済み（M-B スコープ = Core 注入実装 + test）
Config 側 `app/src/lib/caaf-config/`（固有名詞 OK、Core純度の grep 対象外）:
- `llm.ts`（server-only）: `callLLMJSON` / `isLLMConfigured`（Gemini Flash Lite）。gen-1 `caaf/llm.ts` 非依存 → M-F で gen-1 撤去しても無傷
- `extractor.ts`（純関数）: `buildExtractionPrompt(app, today)` / `parseExtraction(app, raw)`。schema 反復で Don't #1 構造担保、enum 正規化・number 強制・absent 省略・confidence clamp(source=ai)
- `intent.ts`（純関数）: `buildIntentPrompt(app, ctx, input)` / `parseIntentResponse(raw)`。7 種分類・不正は add フォール・値創作なし
- `factories.ts`（server）: `createExtractor():Extractor` / `createIntentClassifier():IntentClassifier`。純関数 + llm + Core `normalizeIntent` を結線。server-only チェーンをここに隔離
- `index.ts`: 純関数 + factories の再エクスポート
- `extractor.test.ts`(10) / `intent.test.ts`(8): 純関数 unit test
- `_wiring-check.ts` 削除（M-A プレースホルダを実利用で置換）

## 自己検証（5層検出スタック）
| 層 | 対象 | 結果 |
|---|---|---|
| Shift Left 基盤 | spec/caaf-migration §6 M-B / SPEC §7.1 照合 | PASS |
| 第1層 計算的センサー | app typecheck + caaf-config vitest 18 件 + biome(new files) | PASS |
| 第2層 ビルド機械検証 | `next build`（8 ページ、型チェック含む） | PASS |
| 第3層 Interaction Cost | UI 変更なし（M-E 範囲） | N/A |
| 第4層 推論的センサー | 「仕様に合う・動く」= 注入関数が Core 契約を満たし、純ロジックがテストで動く | PASS |
| 第5層 独立検証 | layer1-independent-reviewer | PASS（`VERIFICATION-CAAF-MB-2026-06-07.md`） |

## 設計判断（記録）
- **server-only 隔離**: 純関数（テスト対象）と server 結線（llm.ts）を分離。`import "server-only"` は llm.ts のみ。テストが jsdom 下で server-only を引かない（18 テスト PASS が実証）
- **gen-1 非依存**: llm.ts を gen-2 に独立実装（caaf/llm.ts を再利用しない）。M-F の gen-1 一括撤去を clean に保つ
- **汎用性**: Extractor/IntentClassifier は任意の CaaFApp に対し汎用（tools 固有ロジックなし）。tools CaaFApp 定義は M-D

## スコープ境界（独立検証 提起）
- 「add 時のみ抽出」の per-turn ゲートループは M-E（host Engine 連結）。M-B はコスト分離の建付け（Intent 低温 / Extract 別呼び出し）+ Core `intentNeedsExtraction` まで
- 実 LLM の end-to-end 検証は M-E / 手動（LLM 呼び出しはユニットテスト対象外）

## pre-existing（M-B 回帰ではない）
- `pnpm lint` 全体の 23 errors は既存ファイル由来。新規 caaf-config 7 ファイルは clean。

## 仕様改訂提案（Type C）/ 異常献上（Type D）
なし。

## opt-in/opt-out 判定（§7.5）
- **opt-out（暗黙オート）**: 追加的 Config コード + テストのみ。build-topology / migration / DONT 抵触 / 不可逆操作なし。現時点で running app から未 import（UI 連結は M-E）= 実挙動への影響ゼロ。→ `human-review-needed` 付与せず。

## 体制事後評価
- M2 妥当。M-B は純ロジック中心で独立検証が有効に機能（server-only 隔離・Don't #1 構造担保を grep + テストで確認）。
- L2 閾値未接近。次 M-C（db Adapter）/ M-D（tools App 定義）。M-C は本 M-B と独立に着手可。M-E（host UI）は M-B + M-D 依存。
