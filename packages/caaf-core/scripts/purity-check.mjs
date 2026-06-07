#!/usr/bin/env node
/**
 * Core純度チェック（FW spec §10.1 Don't #6: Core に固有名詞・固有分岐を書かない / grep 検証）。
 *
 * 2 つの不変条件を src/ に対して検査する:
 *   1. 外部依存ゼロ — src/ の import は相対パス（./ ../）か node: 組込みのみ。
 *      provider/framework SDK（supabase / gemini / anthropic / next / react …）を Core に持ち込まない。
 *   2. ドメイン固有名詞ゼロ — 既知ドメイン語の denylist が src/ に出現しない。
 *
 * test/ は検査対象外（テスト用の中立サンプルに固有語を置けるようにするため）。
 * 利用者ドメインが増えたら DENYLIST に語を追加してよい（Core を汚さないための門番）。
 *
 * exit 0 = pure, exit 1 = violation。CI / sensors から呼ばれる。
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const SRC = join(here, "..", "src");

// 利用者ドメインの固有語。新ドメイン追加時にここへ足す（Core に紛れ込ませない）。
const DENYLIST = [
  // tools domain
  "工具",
  "item_movements",
  "individual_units",
  "holder_id",
  "moved_by",
  "tracking_type",
  // providers / frameworks (Core must stay SDK-free)
  "supabase",
  "gemini",
  "anthropic",
  "openai",
  "next/",
  "react",
];

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (extname(p) === ".ts") out.push(p);
  }
  return out;
}

const violations = [];
const IMPORT_RE = /^\s*(?:import|export)\b[^;]*?\bfrom\s+["']([^"']+)["']/gm;

for (const file of walk(SRC)) {
  const text = readFileSync(file, "utf8");
  const rel = file.slice(SRC.length + 1);

  // 1. external imports
  for (const m of text.matchAll(IMPORT_RE)) {
    const spec = m[1];
    const ok = spec.startsWith("./") || spec.startsWith("../") || spec.startsWith("node:");
    if (!ok) violations.push(`${rel}: external import "${spec}" (Core must be dependency-free)`);
  }

  // 2. domain proper nouns
  const lower = text.toLowerCase();
  for (const term of DENYLIST) {
    if (lower.includes(term.toLowerCase())) {
      violations.push(`${rel}: contains domain term "${term}" (Core純度 violation)`);
    }
  }
}

if (violations.length > 0) {
  console.error("✗ Core purity check FAILED:");
  for (const v of violations) console.error(`  - ${v}`);
  process.exit(1);
}
console.log("✓ Core purity check passed (no external imports, no domain proper nouns in src/).");
