/**
 * LLM Router — CaaF 入力の抽出エンジン
 *
 * - Gemini Flash Lite（本番）/ Claude API（開発時）を env で切替
 * - LLM は抽出器。欠損情報を創作・補完しない (D-5)
 * - 出力は JSON のみ受理。前置き・解説は受理しない
 * - confidence は信号色 UI 表示とログ用途のみ (D-3)
 * - Phase 0 = 全件確認。自動 INSERT しない (D-4)
 *
 * UX Must 閾値: LLM 応答 p95 5秒以内
 */

import type { CaaFExtractionResult, Signal } from "@/types";

const EXTRACTION_PROMPT = `あなたは工具管理システムの入力解析器です。
ユーザーの自然文から工具の持出・返却情報を抽出してください。

### 必ず守るルール
- JSON のみ出力する。前置き・解説・markdown は一切付けない
- 情報が欠損している場合は補完・創作しない。ambiguities に入れる
- 「全返却」「まとめて返す」等の曖昧な対象指定は action="return" として返し、items は空にする
- unit_numbers は明示的に番号が書かれている場合のみ抽出する
- confidence は抽出の確信度（0.0-1.0）

### 出力JSON形式
{
  "site": "現場名 or null",
  "action": "checkout" | "return",
  "items": [
    {
      "name": "工具名",
      "trackingType": "individual" | "quantity",
      "unitNumbers": [番号],
      "quantity": null | 数量,
      "confidence": 0.0-1.0
    }
  ],
  "holderNote": "保持者メモ or null",
  "ambiguities": ["曖昧な点"]
}`;

/**
 * 信号色を判定する（確信度 × マスタ参照一致の2軸）
 *
 * Phase 0 では表示のみ。自動 INSERT 判定には使わない (D-3/D-4)
 */
export function determineSignal(extraction: CaaFExtractionResult): Signal {
  // 🔴 赤: 対象不特定 / items が空
  if (extraction.items.length === 0) return "red";
  if (extraction.action === "return") return "red";

  // 各 item の confidence を確認
  const minConfidence = Math.min(...extraction.items.map((i) => i.confidence));

  // 🟢 緑: 高確信(≥0.8) × ambiguities なし
  if (minConfidence >= 0.8 && extraction.ambiguities.length === 0) {
    return "green";
  }

  // 🟡 黄: 中確信(0.6〜0.8)
  if (minConfidence >= 0.6) {
    return "yellow";
  }

  // 🟠 橙: 低確信(<0.6) or ambiguities あり
  return "orange";
}

/**
 * 自然文から構造化抽出を実行
 *
 * @throws Error - LLM API エラー、タイムアウト、JSON パースエラー
 */
export async function extractFromNaturalText(
  naturalText: string,
  opts?: { timeoutMs?: number },
): Promise<{ extraction: CaaFExtractionResult; signal: Signal }> {
  const timeoutMs = opts?.timeoutMs ?? 5000;

  // デモモード: LLM API キーが未設定の場合はローカル解析
  if (!process.env.NEXT_PUBLIC_LLM_API_KEY) {
    const demoResult = parseDemoExtraction(naturalText);
    return {
      extraction: demoResult,
      signal: determineSignal(demoResult),
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // TODO: Gemini Flash Lite / Claude API 実装
    // 現時点ではデモ解析にフォールバック
    const demoResult = parseDemoExtraction(naturalText);
    return {
      extraction: demoResult,
      signal: determineSignal(demoResult),
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * デモ用ローカル解析（LLM 未接続時のフォールバック）
 *
 * 簡易的なパターンマッチで自然文から工具情報を抽出。
 * 本番ではこの関数は使わない。
 */
function parseDemoExtraction(text: string): CaaFExtractionResult {
  const items: CaaFExtractionResult["items"] = [];
  const ambiguities: string[] = [];

  // 「返却」「返す」を検出
  if (/返却|返す|もどす|戻す/i.test(text)) {
    return {
      site: null,
      action: "return",
      items: [],
      holderNote: null,
      ambiguities: ["返却は一覧画面の返却モードで行ってください"],
    };
  }

  // 番号パターン: "バッテリー 7,8番" "バッテリー#7 #8"
  const numberPattern = /(\d+)\s*[,、]\s*(\d+)\s*番?/;
  const singlePattern = /(\d+)\s*番/;

  // 工具名の簡易検出
  const toolPatterns = [
    { pattern: /バッテリー/i, name: "マキタ18Vバッテリー" },
    { pattern: /インパクト/i, name: "インパクトドライバー" },
    { pattern: /レーザー|墨出し/i, name: "レーザー墨出し器" },
    { pattern: /丸ノコ|丸鋸/i, name: "マキタ丸ノコ" },
    { pattern: /ドリル/i, name: "振動ドリル" },
  ];

  for (const tp of toolPatterns) {
    if (tp.pattern.test(text)) {
      const unitNumbers: number[] = [];
      const multiMatch = text.match(numberPattern);
      const singleMatch = text.match(singlePattern);

      if (multiMatch) {
        unitNumbers.push(Number(multiMatch[1]), Number(multiMatch[2]));
      } else if (singleMatch) {
        unitNumbers.push(Number(singleMatch[1]));
      }

      items.push({
        name: tp.name,
        trackingType: "individual",
        unitNumbers,
        quantity: null,
        confidence: unitNumbers.length > 0 ? 0.85 : 0.5,
      });
    }
  }

  if (items.length === 0) {
    ambiguities.push("工具名を特定できませんでした。もう少し具体的に入力してください");
  }

  // 現場名の簡易検出
  const siteMatch = text.match(/([一-龥]+)(現場|の現場|に)/);
  const site = siteMatch?.[1] ?? null;

  // 保持者の簡易検出
  const holderMatch = text.match(/([一-龥]+)(が持|が使|の分|に渡)/);
  const holderNote = holderMatch?.[1] ?? null;

  return {
    site,
    action: "checkout",
    items,
    holderNote,
    ambiguities,
  };
}
