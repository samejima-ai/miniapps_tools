# F2 フィードバックループ — エイリアス自動学習

## 概要

ユーザーの修正→確定フローから「入力名→正式名」マッピングを自動学習し、
次回入力時のマスタ照合精度を継続的に改善する。

## 問題

- ILIKE 部分一致では「充電ブロアー」→「エンジンブロワー」は一致しない
- 現場のカジュアルな略称は予測不能（マスタ登録で網羅できない）
- 毎回修正→確定を繰り返すのは UX 劣化

## 解決: 2層フィードバック

### Layer A: エイリアス DB（照合時）

```
resolveAgainstMaster の照合順:
1. item_name_aliases で exact match → 即解決
2. items で ILIKE → 従来フロー
3. どちらも不一致 → not_found
```

### Layer B: LLM プロンプト注入（抽出時）

```
EXTRACTION_PROMPT に動的追加:
### 過去の入力パターン
充電ブロアー → エンジンブロワー
バッテリー → マキタバッテリーV18 6
インパクト → 充電式インパクトドライバ
```

LLM が抽出段階で正式名に正規化 → ILIKE でも一致率が上がる。

## データモデル

```sql
item_name_aliases
├── alias TEXT UNIQUE     -- ユーザー入力名（lowercase）
├── item_id UUID FK       -- 対応するマスタ工具
├── canonical_name TEXT   -- マスタ正式名（表示用キャッシュ）
├── use_count INT         -- 累計使用回数（信頼度指標）
├── created_at TIMESTAMPTZ
└── last_used_at TIMESTAMPTZ
```

## キャプチャ条件

- `extractedName ≠ matchedName` かつ確定済み
- D-4 準拠: 人間タップ（確定ボタン）後のみ学習
- 同一 alias 再確定 → use_count インクリメント
- 同一 alias を別工具に確定 → 上書き（最新の人間判断が正）

## UPSERT ロジック

| 状態 | アクション |
|------|-----------|
| alias 未存在 | INSERT |
| alias 存在 & 同一 item_id | use_count++ / last_used_at 更新 |
| alias 存在 & 別 item_id | item_id + canonical_name 上書き / use_count=1 |

## フロー図

```
【初回】
User: "充電ブロアー" → LLM: name="充電ブロアー"
  → aliases: 該当なし → ILIKE: 該当なし → not_found ❌
  → User 修正: "充電ブロアーはエンジンブロワー"
  → re-resolve → matched ✅ → 確定
  → 学習: alias="充電ブロアー" → item="エンジンブロワー"

【2回目】
User: "充電ブロアー" → LLM: name="充電ブロアー"（or prompt注入で"エンジンブロワー"）
  → aliases: hit! → matched ✅（即解決）
```

## 制約遵守

| 制約 | 整合 |
|------|------|
| D-4 (Phase 0) | 確定ボタン押下後のみ学習。自動学習しない |
| D-5 (LLM抽出器) | LLM は正規化のみ。エイリアスを創作しない |
| D-1 (append-only) | aliases は movements ではない。UPSERT 可 |
| 罠A | aliases は状態カラムではない。照合補助テーブル |

## LLM プロンプト注入の上限

- 上位 30 件（use_count DESC）を注入
- トークン節約: 1 行 = "alias → canonical" 形式
