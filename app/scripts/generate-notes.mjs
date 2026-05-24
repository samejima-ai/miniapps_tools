/**
 * generate-notes.mjs
 *
 * 工具マスタの notes を Gemini Flash Lite で一括生成・投入する。
 *
 * 使い方:
 *   # 必要環境変数
 *   #   NEXT_PUBLIC_SUPABASE_URL
 *   #   NEXT_PUBLIC_SUPABASE_ANON_KEY  (writeable via RLS)
 *   #   GEMINI_API_KEY
 *
 *   node scripts/generate-notes.mjs              # notes 未設定のみ生成
 *   node scripts/generate-notes.mjs --dry-run    # 生成結果を出力するだけ。DB 更新しない
 *   node scripts/generate-notes.mjs --force      # 既存 notes も上書き
 *   node scripts/generate-notes.mjs --limit 10   # 先頭 10 件だけ
 *
 * Notes:
 *   - 既存 lib/llm/notes-generator.ts と同じプロンプト構造を維持
 *   - 1 件ずつ直列実行（Gemini レート制限と Supabase 負荷を考慮）
 *   - 500ms ディレイで API ペース調整
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// .env.local を簡易読み込み（dotenv 依存を避ける）
const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = resolve(__dirname, "..", ".env.local");
try {
  const raw = readFileSync(ENV_PATH, "utf8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
} catch {
  // .env.local が無くても OS env から拾えれば OK
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const GEMINI_KEY = process.env.GEMINI_API_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON) {
  console.error("ERROR: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY が未設定");
  process.exit(1);
}
if (!GEMINI_KEY) {
  console.error("ERROR: GEMINI_API_KEY が未設定");
  process.exit(1);
}

// CLI フラグ解析
const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const FORCE = args.includes("--force");
const limitIdx = args.indexOf("--limit");
const LIMIT = limitIdx >= 0 && args[limitIdx + 1] ? Number.parseInt(args[limitIdx + 1], 10) : null;

const GEMINI_MODEL = "gemini-2.0-flash-lite";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const NOTES_GENERATION_PROMPT = `あなたは日本の建設現場で使われる工具・資材のマスタ整備担当です。
与えられた工具情報から、現場でよく使われる別名・略称・メーカー・型番・用途を推定し、
検索ヒット率を高めるための notes を生成してください。

### 必ず守るルール
- JSON のみ出力。前置き・解説・markdown は禁止
- 推測で確証がない情報は含めない（捏造禁止）
- 名前に含まれる型番・品番（例: BL1860B, HR165DF, F88）はそのまま記載する
- 一般的な略称・別名（例: ディスクグラインダ→サンダー、ブロワー→送風機）は積極的に列挙する
- メーカー名がわかれば記載（マキタ, HiKOKI, Panasonic, BOSCH, グラコ, シンコー 等）
- 用途・分類（切断/研磨/塗装/締結/搬送/照明 等）を簡潔に
- ブランドが不明な場合は記載しない（無理に断定しない）
- 既存 notes に有用情報があればマージして発展させる
- 出力 notes は 1〜2 行、合計 100 文字程度を目安に

### 出力JSON形式
{
  "notes": "別名: X, Y. メーカー: Z. 型番: ABC. 用途: 切断/研磨.",
  "confidence": 0.0-1.0
}`;

async function generateNotes(item) {
  const context = [
    `name: ${item.name}`,
    `category: ${item.category}`,
    item.item_code ? `item_code: ${item.item_code}` : null,
    item.notes && item.notes.trim() !== "" ? `current_notes: ${item.notes}` : null,
  ]
    .filter((s) => s !== null)
    .join("\n");

  const url = `${GEMINI_ENDPOINT}?key=${GEMINI_KEY}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: NOTES_GENERATION_PROMPT },
            { text: `\n\n### 入力\n${context}` },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    if (process.env.DEBUG_NOTES) {
      console.log("\n   [DEBUG raw response]:", JSON.stringify(data).slice(0, 500));
    }
    throw new Error("Gemini 応答が空");
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`JSON パース失敗: ${text.slice(0, 200)}`);
  }

  if (process.env.DEBUG_NOTES) {
    console.log("\n   [DEBUG parsed]:", JSON.stringify(parsed).slice(0, 300));
  }

  // Gemini は responseMimeType: application/json 指定でも配列で返すことがある
  const obj = Array.isArray(parsed) ? parsed[0] : parsed;
  if (!obj || typeof obj !== "object") throw new Error("応答が object でない");

  const notes = typeof obj.notes === "string" ? obj.notes.trim() : "";
  const confidence =
    typeof obj.confidence === "number" && Number.isFinite(obj.confidence)
      ? Math.max(0, Math.min(1, obj.confidence))
      : 0;

  if (notes === "") throw new Error("notes が空");
  return { notes, confidence };
}

async function main() {
  console.log(`[generate-notes] mode: ${DRY_RUN ? "DRY-RUN" : "WRITE"}, force: ${FORCE}, limit: ${LIMIT ?? "all"}`);

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
    db: { schema: "miniapps_tools" },
    auth: { persistSession: false },
  });

  // 対象 item 取得
  let query = supabase
    .from("items")
    .select("id, name, category, item_code, notes")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (!FORCE) {
    query = query.or("notes.is.null,notes.eq.");
  }

  const { data: items, error } = await query;
  if (error) {
    console.error("items 取得失敗:", error.message);
    process.exit(1);
  }

  const targets = LIMIT ? items.slice(0, LIMIT) : items;
  console.log(`[generate-notes] 対象: ${targets.length} 件 (全 ${items.length} 件中)`);

  if (targets.length === 0) {
    console.log("対象なし。終了。");
    return;
  }

  let ok = 0;
  let ng = 0;
  const failures = [];

  for (let i = 0; i < targets.length; i++) {
    const item = targets[i];
    const idx = `[${i + 1}/${targets.length}]`;
    process.stdout.write(`${idx} ${item.name} ... `);

    try {
      const result = await generateNotes(item);
      console.log(`OK (conf=${result.confidence.toFixed(2)})`);
      console.log(`   → ${result.notes}`);

      if (!DRY_RUN) {
        const { error: updErr } = await supabase
          .from("items")
          .update({ notes: result.notes })
          .eq("id", item.id);

        if (updErr) {
          console.log(`   UPDATE 失敗: ${updErr.message}`);
          ng++;
          failures.push({ name: item.name, reason: updErr.message });
        } else {
          ok++;
        }
      } else {
        ok++;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`NG: ${msg}`);
      ng++;
      failures.push({ name: item.name, reason: msg });
    }

    // レート制限対策: 500ms 待機
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log("");
  console.log(`[generate-notes] 完了: OK=${ok}, NG=${ng}`);
  if (failures.length > 0) {
    console.log("失敗内訳:");
    for (const f of failures) {
      console.log(`  - ${f.name}: ${f.reason}`);
    }
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
