/**
 * CaaF Core — Signal (FW spec §7.3)
 *
 * 信頼度スコア → 信号色の純写像。Core は 3 色（green/yellow/red）に閉じる。
 *
 *   0.80–1.0  → green  （確定/高: 明示・手動・ドメイン推論）
 *   0.60–0.79 → yellow （中: キーワード推論）
 *   0.00–0.59 → red    （低: 要確認）
 */

import type { Confidence, CaaFApp, CaaFRecord, Signal } from "./types.js";
import { validateRecord } from "./validate.js";

export function confidenceSignal(confidence: Confidence): Signal {
  if (confidence >= 0.8) return "green";
  if (confidence >= 0.6) return "yellow";
  return "red";
}

/**
 * record 全体の信号色。
 * - 必須未充足/型エラーがあれば red（要確認）。
 * - そうでなければ「必須フィールドの最小確信度」を信号化（最も弱い項目に律速される）。
 */
export function recordSignal(app: CaaFApp, record: CaaFRecord): Signal {
  const result = validateRecord(app, record);
  if (!result.ok) return "red";

  const requiredNames = app.schema.filter((f) => f.required).map((f) => f.name);
  if (requiredNames.length === 0) return "green";

  let min = 1.0;
  for (const name of requiredNames) {
    const fv = record.fields[name];
    if (fv) min = Math.min(min, fv.confidence);
  }
  return confidenceSignal(min);
}
