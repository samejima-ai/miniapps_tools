/**
 * CaaF gen-2 Config — IntentClassifier（L0.3 意図解析、FW spec §6）
 *
 * Core の `IntentClassifier` インターフェース実装を生成する。任意の CaaFApp に対して汎用に動く。
 * 文脈（直近会話 + 現在の入力値）を軽量モデルに渡し、7 種の意図に分類する。
 *
 * 原則（設計原則 2）: 分類のみ。値を作らない。ユーザーが明示した値だけ value に載せる。
 *
 * 本ファイルは純関数のみ（buildIntentPrompt / parseIntentResponse）= ユニットテスト対象。
 * server-only な LLM 結線（createIntentClassifier、normalizeIntent 適用）は factories.ts に置く。
 */

import type { CaaFApp, Intent, IntentContext, IntentResult } from "@caaf/core";

const INTENTS: readonly Intent[] = [
  "add",
  "correct",
  "remove",
  "execute",
  "cancel",
  "reroute",
  "out_of_scope",
];

interface RawIntent {
  intent?: unknown;
  target?: unknown;
  value?: unknown;
  reason?: unknown;
}

/** 現在の入力値を「field: value」の読みやすい一覧にする（純関数の補助）。 */
function describeCurrentValues(context: IntentContext): string {
  const rec = context.currentRecord;
  if (!rec || Object.keys(rec.fields).length === 0) return "（まだ何も入力されていません）";
  return Object.entries(rec.fields)
    .map(([name, fv]) => `- ${name}: ${JSON.stringify(fv.value)}`)
    .join("\n");
}

/** Intent 分類プロンプト（system + user）を生成する（純関数）。 */
export function buildIntentPrompt(
  app: CaaFApp,
  context: IntentContext,
  input: string,
): { system: string; user: string } {
  const fieldNames = app.schema.map((f) => f.name).join(", ");
  const recent =
    context.recentMessages.length > 0
      ? context.recentMessages.map((m) => `- ${m}`).join("\n")
      : "（なし）";

  const system = `あなたは「${app.context.role}」のチャット入力における意図分類器です。
ユーザーの発話を、以下の 7 種のいずれか 1 つに分類してください。

| intent | 意味 |
|---|---|
| add | 新規入力・追記（値を述べている） |
| correct | 既存値の修正（「〜を〜に直して」） |
| remove | 値の削除（「〜は無し」「〜を消して」） |
| execute | 登録指示（「これで登録」「確定」） |
| cancel | 全リセット（「やめる」「最初から」） |
| reroute | この入力対象とは別の種別だと判明 |
| out_of_scope | この入力の範囲外の話題 |

### このアプリのフィールド
${fieldNames}

### 必ず守るルール
- JSON のみ出力。前置き・解説・markdown は禁止。
- 分類のみ行う。値を創作しない。
- correct / remove の場合、target は上記フィールド名のいずれか。特定できなければ target は null。
- value は「ユーザーが明示した新しい値」がある場合のみ入れる。なければ null。
- 判断に迷う値の入力は add とする。

### 出力 JSON 形式
{ "intent": "add|correct|remove|execute|cancel|reroute|out_of_scope", "target": "<フィールド名 or null>", "value": <値 or null>, "reason": "<日本語1文>" }`;

  const user = `### 直近の会話
${recent}

### 現在の入力値
${describeCurrentValues(context)}

### ユーザーの発話
${input}`;

  return { system, user };
}

/** LLM 生 JSON を IntentResult へ変換する（純関数）。不正な intent は add にフォール。 */
export function parseIntentResponse(raw: unknown): IntentResult {
  const r = (raw ?? {}) as RawIntent;
  const intent: Intent = INTENTS.includes(r.intent as Intent) ? (r.intent as Intent) : "add";
  // LLM 出力の前後空白を許容しない（" amount" 等で schema 一致を取りこぼさないよう trim）。
  const target =
    typeof r.target === "string" && r.target.trim() !== "" ? r.target.trim() : undefined;
  const value = r.value === null || r.value === undefined || r.value === "" ? undefined : r.value;
  const reason = typeof r.reason === "string" ? r.reason : undefined;

  const result: IntentResult = { intent };
  if (target !== undefined) result.target = target;
  if (value !== undefined) result.value = value;
  if (reason !== undefined) result.reason = reason;
  return result;
}
