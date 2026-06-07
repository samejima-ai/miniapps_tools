/**
 * CaaF Core — Mapper (FW spec §7.1, L1)
 *
 * intent=add 時、確定 App の schema をプロンプトに展開し、スキーマ準拠の JSON 抽出を LLM にさせる。
 * Core は抽出器を「インターフェース」として受け取り、LLM SDK には依存しない（設計原則 4）。
 *
 * 抽出規約（FW spec §7.1）:
 *  - 書かれていない項目は必ず null。創作禁止（設計原則 2）。
 *  - enum は選択肢に正規化、該当なしは null。
 *  - 相対日付（今日/明日）は実日付に変換（実装は Config 側プロンプト責務）。
 *  - フィールドごとの確信度を返す。
 *
 * マッピング優先順位（FW spec §7.1）:
 *  ①明示指定 → ②ドメインスキル推論（Config 側）→ ③コンテキスト補完 → ④デフォルト値。
 */

import type { CaaFApp, CaaFFieldValue, CaaFRecord } from "./types.js";

/** L1 抽出器。実装は利用者が Config 側（サーバー）で注入する。 */
export type Extractor = (input: string, app: CaaFApp) => Promise<Record<string, CaaFFieldValue>>;

/**
 * 抽出結果から CaaFRecord を組み立てる純関数。
 * - 既存 record があればフィールドをマージ（ユーザー確定値 source="user" は AI 値で上書きしない）。
 * - 未充足 default はここでは埋めない（Resolver/applyDefaults が担う）。
 */
export function buildRecord(
  app: CaaFApp,
  extracted: Record<string, CaaFFieldValue>,
  base: CaaFRecord | null = null,
): CaaFRecord {
  const fields: Record<string, CaaFFieldValue> = { ...(base?.fields ?? {}) };

  for (const [name, incoming] of Object.entries(extracted)) {
    const existing = fields[name];
    // ユーザー確定値は AI 抽出で上書きしない（設計原則 3: 確定はユーザー）。
    if (existing && existing.source === "user") continue;
    // null は「書かれていない」= 既存値を消さない（remove は Intent 経由で行う）。
    if (incoming.value === null || incoming.value === undefined) continue;
    fields[name] = incoming;
  }

  return { app: app.id, fields, status: "mapped" };
}
