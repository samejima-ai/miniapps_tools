/**
 * CaaF gen-2 Config — サーバーサイド LLM JSON 呼び出し（Gemini）
 *
 * 設計原則 4（サーバーサイド LLM）: API キーはサーバー専用 env（GEMINI_API_KEY）。
 * `import "server-only"` により、クライアントコンポーネントが import するとビルドが失敗する。
 *
 * 本ファイルは Config 側の独立した Gemini クライアント（master notes 用の
 * `@/lib/llm/gemini` とは別系統）。M-F で旧 stroke 実装は撤去済み。
 *
 * 2 回 LLM 呼び出しの役割分離（FW spec §3）:
 *   - Intent(L0.3): 軽量・低 temperature（毎ターン）
 *   - Extract(L1): 中量（add 時のみ）
 * いずれも Gemini Flash Lite を使い、temperature で挙動を分ける。
 */

import "server-only";

const GEMINI_MODEL = "gemini-2.5-flash-lite";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export type LLMCallOptions = {
  /** 0.0–1.0。Intent 分類は低温（決定的）、抽出は既定で低温。 */
  temperature?: number;
};

export function isLLMConfigured(): boolean {
  const apiKey = process.env.GEMINI_API_KEY;
  return !!apiKey && apiKey !== "ここにキーを貼る";
}

/** Gemini を JSON 応答モードで呼び、生テキストを返す。 */
async function callLLM(parts: Array<{ text: string }>, opts?: LLMCallOptions): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "ここにキーを貼る") {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const res = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: {
        temperature: opts?.temperature ?? 0.1,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("Gemini API error:", res.status, err);
    throw new Error(`LLM API エラー (${res.status})`);
  }

  const data = await res.json();
  const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("LLM から有効な応答がありませんでした");
  return text;
}

/** Gemini を呼び、JSON を parse して返す。 */
export async function callLLMJSON<T = unknown>(
  parts: Array<{ text: string }>,
  opts?: LLMCallOptions,
): Promise<T> {
  const text = await callLLM(parts, opts);
  try {
    return JSON.parse(text) as T;
  } catch {
    console.error("LLM JSON parse error:", text);
    throw new Error("LLM の応答を JSON として解析できませんでした");
  }
}
