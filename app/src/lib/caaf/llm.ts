/**
 * CaaF LLM Pipeline — Gemini API utilities.
 *
 * Shared across domains for structured JSON extraction.
 * Server-only: import only from server actions or server components.
 */

const GEMINI_MODEL = "gemini-2.0-flash-lite";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export type GeminiCallConfig = {
  temperature?: number;
};

export function isGeminiConfigured(): boolean {
  const apiKey = process.env.GEMINI_API_KEY;
  return !!apiKey && apiKey !== "ここにキーを貼る";
}

/**
 * Call Gemini API with structured prompt parts.
 * Returns the raw text response.
 */
export async function callGemini(
  parts: Array<{ text: string }>,
  config?: GeminiCallConfig,
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "ここにキーを貼る") {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const url = `${GEMINI_ENDPOINT}?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: {
        temperature: config?.temperature ?? 0.1,
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
  const text: string | undefined =
    data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error("LLM から有効な応答がありませんでした");
  }

  return text;
}

/**
 * Call Gemini and parse the JSON response.
 */
export async function callGeminiJSON<T = unknown>(
  parts: Array<{ text: string }>,
  config?: GeminiCallConfig,
): Promise<T> {
  const text = await callGemini(parts, config);
  try {
    return JSON.parse(text) as T;
  } catch {
    console.error("Gemini JSON parse error:", text);
    throw new Error("LLM の応答を JSON として解析できませんでした");
  }
}
