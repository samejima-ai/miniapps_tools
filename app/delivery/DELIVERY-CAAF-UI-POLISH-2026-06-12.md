# DELIVERY.md — gen-2 入力画面 UI 作り込み（/input ポリッシュ）

## 体制情報
- Mode: M2 / LC=1 / dev_mode: autonomous / scope: full
- 契機: 利用者フィードバック「/input がしょぼい・古い」（実運用検証フェーズ）
- 種別: **UI 専用ポリッシュ**（gen-2 host の判断ロジック・Core・Adapter は無変更）
- ブランチ: `claude/dazzling-gauss-Lc0kI`（M-F merge 後 master 起点）

## 背景
M-F で gen-2 を `/input` に昇格したが、UI が簡素で「古い/しょぼい」との指摘。本番デプロイは最新
（Vercel production = `1d66564` = M-F、確認済み）であり、問題は**見た目の作り込み不足**。現場職人が
スマホで使う前提で、速くて分かりやすい入力体験に作り直す。

## 変更（`app/(main)/input/page.tsx` のみ）
判断ロジックは触らず、**レンダリングを全面的に作り込み**:

| 箇所 | Before | After |
|---|---|---|
| 番号入力 | テキストに「2,3」と打つ | **在庫番号のタップ式チップ**（mono 太字・複数選択・持出中は赤バッジ表示、checkout 時は選択不可=D-11）|
| 操作(enum) | 素のボタン | 持出=青 / 返却=緑 の**セグメント** |
| 数量 | テキスト入力のみ | **クイックピック（1/2/3/5/10）+ 手入力**（整数ガード維持） |
| 候補選択 | テキストボタン | **カード**（工具名 + 個体/数量バッジ + ›、shadow-card） |
| ready | 簡素な枠 | **登録確認カード**（信号色の左ボーダー・操作ピル・番号チップ/数量・現場行・大型 CTA）|
| 空状態 | 1 行 | アイコン + 例示カード |
| 履歴 | 簡素 | ユーザー吹き出し（影付き）/ 完了（✅）/ info の 3 種 |
| 全体 | — | DESIGN トークン（shadow-card(-strong)/primary-cta/cta・radius・signal 色・font-mono・44px+ タップ域）|

- 部品をコンポーネント分割（EmptyState / HistoryBubble / Notice / CandidateButton / UnitChips / RallyPrompt / ReadyCard / SiteRow / ActionPill）。
- `selectedUnits` ローカル state を追加（チップ複数選択）。confirm 時に `applyUnitNumbers`（純関数）へ。
- availableUnits 不在の個体管理はテキスト入力にフォールバック（`parseNumbers`）。

## 速度・UX への寄与
- 番号/数量/操作は**タップだけで完了**（server 往復ゼロの client 純関数）＝「速さ最重要」に直結。
- 持出中番号は視覚的に判別（checkout では選択不可）→ 二重持出を入口で防ぐ（D-11 と整合）。

## 不変条件 / 安全
- **判断ロジック無変更**: host-turn / host-server / Core / Adapter / mapping は一切触らず。`item_movements`・台帳・migration・View・RLS 非接触。罠A/D-1/D-3/D-7/D-11/D-4 維持。
- **HEX 直書きなし**（grep 確認、CLAUDE.md 規約）。全て DESIGN トークン。
- unit テスト **79 件**不変（UI 変更のため挙動ロジックに影響なし）。

## 検証
| 層 | 結果 |
|---|---|
| tsc --noEmit | PASS |
| vitest（caaf-config 79） | PASS |
| next build（/input 7.45kB） | PASS |
| biome | PASS |
| HEX 直書き grep | PASS（ゼロ） |
| **実機（preview）** | ⚠️ 要確認（DB/LLM キー無し環境のため）|

## 申し送り
- **preview の `/input` で見た目・操作感をご確認ください**（番号チップ / 候補カード / ready カード / 数量クイックピック）。
- さらなる作り込み希望（アイコン・アニメ・色味）があれば指定ください。
- 入力以外の画面（一覧/マスタ/ヘッダ）は本 PR 対象外（従来 UI のまま）。
