/**
 * seed-tools.mjs
 *
 * Parses embedded CSV of power tools inventory and generates SQL INSERT
 * statements for miniapps_tools.items + miniapps_tools.individual_units.
 *
 * Usage:  node scripts/seed-tools.mjs
 * Output: supabase/seed/001_seed_tools.sql
 */

import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = resolve(__dirname, "..", "supabase", "seed", "001_seed_tools.sql");

// ---------------------------------------------------------------------------
// 1. RAW CSV DATA
// ---------------------------------------------------------------------------

const CSV_RAW = `"タイムスタンプ","呼称（呼び方）","型番","ロット番号","数","備考"
"2025/12/28 11:12:44","洗浄機","JC-1513 KB","","1",""
"2025/12/28 11:15:35","高圧洗浄用ホースドラム","HD 60","","2",""
"2025/12/28 11:17:11","ポッキン延長ブレーカー","PBW-EK-T(防雨型)","","2",""
"2025/12/28 11:19:12","漏電ブレーカー","PIPB-EK- T屋内型","","1",""
"2025/12/28 11:26:19","モルタルミキサー","RL-MM80L","","1",""
"2025/12/28 11:26:38","撹拌機（充電）","UT130D","","2",""
"2025/12/28 11:28:50","ホッパー付きエアレス","AETFL54P0003","","1",""
"2025/12/28 11:29:57","エアレス","ABPFL14PK005","","1",""
"2025/12/28 11:30:30","撹拌機（有線）","UT2204","","1",""
"2025/12/28 11:30:57","撹拌機（有線）","UT1305","","1",""
"2025/12/28 11:32:43","ドラム延長コード　HAYATA","BE-30K","","3",""
"2025/12/28 11:34:44","ドラム延長コード　RAINBOW","SS-30","","1",""
"2025/12/28 11:34:45","ホッパー付きエアレス","AETFL54P0003","","1",""
"2025/12/28 11:35:52","ドラム延長コード　マキタ","A-48234","","1",""
"2025/12/28 11:36:37","高圧洗浄機","JC-1513DPN+","BJ119002","1",""
"2025/12/28 11:39:36","マックス スーパーエアタンク","AK94986","","1","未開封"
"2025/12/28 11:40:12","マックス スーパーエアコンプレッサー","AK98471","","1","未開封"
"2025/12/28 11:40:40","エンジンブロワー","EBLK-2100","028513","1",""
"2025/12/28 11:41:48","エンジンブロワー","EBLK-2100","028503","1",""
"2025/12/28 11:42:38","シール攪拌機　1","カルマゼ","2017-C-0120","1",""
"2025/12/28 11:43:16","シール攪拌機　2","カルマゼ","2019-C-0400","1",""
"2025/12/28 11:43:59","充電式扇風機","CF301D","125105","1",""
"2025/12/28 11:44:45","シール攪拌機　4","カルマゼ","2020-C-0015","1",""
"2025/12/28 11:45:20","シール攪拌機　5","カルマゼ","2020-C-0404","1",""
"2025/12/28 11:45:35","充電式扇風機","CF300D","134335","1",""
"2025/12/28 11:46:35","大型扇風機","RL-AR600TF","","1",""
"2025/12/28 11:48:05","発電機","EG2500I","3203329","1",""
"2025/12/28 11:50:00","ライスター","ライスター","2104018754","1",""
"2025/12/28 11:51:37","インバーターノンガス半自動溶接機","SBD-80","012121060185","1",""
"2025/12/28 11:53:32","充電ブロワー","MUB363D","87658Y","1",""
"2025/12/28 11:53:49","電気チェーンソー","ED-300T","20DX00404","1",""
"2025/12/28 11:54:44","延長コード 10m","G3130","","1","緑色"
"2025/12/28 11:56:35","延長コード 黄色","不明","","1","型番汚れで不明　コード黄色"
"2025/12/28 11:57:40","延長コード Kowa 黒色","不明","","1",""
"2025/12/28 11:59:37","発電機","GE-900SS-IV","6005733","1","使用時、白煙注意"
"2025/12/28 12:01:30","集じん機","VC1530","0022128","1",""
"2025/12/28 12:09:44","エアホース","30m 赤","","1",""
"2025/12/28 12:10:23","エアホース","10m 青","","1",""
"2025/12/28 12:10:41","エアホース","20m 紫？","","1",""
"2025/12/28 12:11:25","水道ホース","5m 青","","1",""
"2025/12/28 12:11:48","水道ホース","5m 青","","1",""
"2025/12/28 12:12:51","水道ホース","17m 緑","","1",""
"2025/12/28 12:13:26","水道ホース","15m 青","","1",""
"2025/12/28 12:13:58","高圧洗浄用ホース","30m","","1","未開封"
"2025/12/28 12:15:34","高圧洗浄用ホース","20m","","3",""
"2025/12/28 12:16:04","高圧洗浄用ホース","30m","","3",""
"2025/12/28 12:16:54","高圧洗浄用ホース","30m","","1","さっきのに合算して"
"2025/12/28 12:21:15","充電式ハンマドリル","HR244DRGXB","1269190","1",""
"2025/12/28 12:21:18","マックス スーパーエアコンプレッサー","AK-HL-HH1310E","AK-HL1310Eブラック  23406007H","1",""
"2025/12/28 12:24:44","シーリング攪拌機","カルマゼ","","1","未開封"
"2025/12/28 12:26:43","充電式ハンマドリル","HR244DRGXB","1347690","1","充電器入り"
"2025/12/28 12:27:17","充電式インパクト 茶色","TD171D","405503","1","ケース入り"
"2025/12/28 12:27:22","急速充電器","DC18RF","1029520","1",""
"2025/12/28 12:30:32","グラコ 充電式エアレスガン","20B477","E23A20B477000622","1",""
"2025/12/28 12:31:13","35mmハンマドリル","HR3530","92365","1",""
"2025/12/28 12:32:40","35mmハンマドリル","HR3530","85451","1",""
"2025/12/28 12:33:34","35mmハンマドリル","HR3530","82878","1",""
"2025/12/28 12:34:31","グラコ インパクト取り付け方エアレスガン","26D360","E24A26D360037222","1",""
"2025/12/28 12:36:19","充電式マルチツール","TM52DRG","0392017Y","1","充電器有り"
"2025/12/28 12:36:33","吹き付け万能ガン","SG-50","","1",""
"2025/12/28 12:36:53","急速充電器","DC18RF","1008522","1",""
"2025/12/28 12:38:23","充電式マルチツール","TM52DRG","0392016Y","1","充電器有り"
"2025/12/28 12:39:10","ホームベンチグラインダー","BGR-150A","17CE","1",""
"2025/12/28 12:39:14","急速充電器","DC18RF","1008522","1",""
"2025/12/28 12:42:08","レシプロソー","JR3050T","1251994K","1",""
"2025/12/28 12:44:55","ヒートガン","HG6031VK","191213769","1",""
"2025/12/28 12:45:50","圧送ガン","PC-18D","","1",""
"2025/12/28 12:47:25","充電式ラジオ","MR108","00048229","1",""
"2025/12/28 12:48:33","充電式スプレーが？","QIP-WYT16-18","","1",""
"2025/12/28 12:52:45","充電式ブロア","DUB182Z","","1","型番不明"
"2025/12/28 12:54:56","125mmランダムオービットサンダ","BO5030","1788945A","1",""
"2025/12/28 12:55:00","125mm ランダムオービットサンダ","BO5030","1793727A","1",""
"2025/12/28 12:55:57","125mm 充電式チップソー切断機","LC540D","14023","1",""
"2025/12/28 12:57:23","仕上サンダ","BO3710","00111000K","1",""
"2025/12/28 12:59:51","仕上げサンダ","BO3710","00111657K","1",""
"2025/12/28 13:00:00","マックス釘打機スーパーネイラ","HN91016","23201103F 65N4","1",""
"2025/12/28 13:03:11","マックス スーパーエア・ホースドラム赤","SD-630A","","1",""
"2025/12/28 13:05:18","マックス釘打機スーパーネイラ","HN91117","23309018F 50N4","1",""
"2025/12/28 13:05:20","100mmディスクグラインダ","9533BL","281170","1",""
"2025/12/28 13:09:46","マックス釘打機スーパーネイラ","HN91017","22914125F65N4","1",""
"2025/12/28 13:10:47","ウインチ","AWI62","022098","1",""
"2025/12/28 13:11:39","マックス スーパーネイラ","HN-50","14724193F","1",""
"2025/12/28 13:13:14","充電式クリーナ","CL141FD","237542Y","1",""
"2025/12/28 13:14:17","丸ノコ（有線）","KS4000FX","41568","1",""
"2025/12/28 13:14:24","洗浄機バケツ","SEIWA 水桶フロート","","2",""
"2025/12/28 13:14:46","マックス バラ釘連結機","WH-2","23316061W","1",""
"2025/12/28 13:15:00","充電式墨出し器","SK10GD","1906263","1","充電器有り"
"2025/12/28 13:16:12","ポリッシャー","PEG-132","018899","1",""
"2025/12/28 13:16:31","BLUE-HOSE","30m (3/8)","","1",""
"2025/12/28 13:16:37","バッテリ","BL1040B","2390207D","1",""
"2025/12/28 13:17:25","ガソリン携行缶 10L","不明","","2",""
"2025/12/28 13:18:02","マックス　エアタンク","AK-T30RII","22040079","1",""
"2025/12/28 13:18:17","ガソリン携行缶 20L","不明","","1",""
"2025/12/28 13:20:29","釘打機","NV 90HM","不明","1",""
"2025/12/28 13:21:31","丸ノコ（充電式）","HS474D","21.8 114974","1",""
"2025/12/28 13:24:00","充電器(14.4V-18V)","DC18RF","0210522","1",""
"2025/12/28 13:24:06","スプレーガン","SPGK-15S","","1",""
"2025/12/28 13:26:44","充電式サンダー","GA412D","0132264Y","1",""
"2025/12/28 13:26:48","釘打機","NT 55A","830153","1",""
"2025/12/28 13:27:36","充電器(14.4V-18V)","DC18RF","0307522","1",""
"2025/12/28 13:27:40","スプレーガン","F88","","1",""
"2025/12/28 13:28:20","充電器(14.4V-18V)","DC18RF","0816518","1",""
"2025/12/28 13:29:20","充電器(7.2-18V)","DC18RC","1208616","1",""
"2025/12/28 13:30:32","充電器(7.2-18V)","DC18RD","21076001554","1",""
"2025/12/28 13:36:05","充電器(14.4V-18V)","DC18RF","0508519","1","バッテリーボックス　BP1"
"2025/12/28 13:37:08","漏電ブレーカー","KD-LB-2121SA","","1","ラベルがこすれて不明"
"2025/12/28 13:37:36","充電器(14.4V-18V)","DC18RF","0210522","1","バッテリーボックス　BP2"
"2025/12/28 13:39:11","充電器(7.2-18V)","DC18RD","21066003406","1","バッテリーボックス　BP5"
"2025/12/28 13:40:46","充電器(14.4V-18V)","DC18RF","0923522","1","バッテリーボックス　BP4"
"2025/12/28 13:41:06","充電式インパクトドライバ","TD149D","117386Y","1",""
"2025/12/28 13:42:02","充電器","DC18RF","0806519","1",""
"2025/12/28 13:42:42","充電器(7.2-18V)","DC18RC","0810511","1",""
"2025/12/28 13:43:26","バッテリ","BL1860B","252227SWSC00262","1",""
"2025/12/28 13:45:38","バッテリーコンバータ","YOKI8","","2",""
"2025/12/28 13:48:55","ビリビリガード","PIPB-EK-T","","1",""
"2025/12/28 13:50:49","充電ブロワー","UB185D","53103","1",""
"2025/12/28 13:51:24","充電ブロワー","UB185D","605989","1",""
"2025/12/28 13:52:04","充電ブロワー","UB185D","53101","1",""
"2025/12/28 13:56:52","バッテリー 6.0Ah 18V","BL1860B","212530LWJ A6252J","1",""
"2025/12/28 13:58:08","充電ブロワー","不明","","1","シールが取れてて型番、ロット不明"
"2025/12/28 13:59:03","バッテリー 6.0Ah 18V","BL1860B","212905MWS A90900","1",""
"2025/12/28 14:01:54","バッテリー 6.0Ah 18V","BL1860B","192403KWS B53550","1",""
"2025/12/28 14:03:36","バッテリー 6.0Ah 18V","BL1860B","222396MWS A62755","1",""
"2025/12/28 14:04:35","バッテリー 6.0Ah 18V","BL1860B","22701NWS Y30345","1",""
"2025/12/28 14:05:24","バッテリー 6.0Ah 18V","BL1860B","222616NWS X10789","1",""
"2025/12/28 14:06:41","バッテリー 6.0Ah 18V","BL1860B","222307MWS A60440","1",""
"2025/12/28 14:07:10","バッテリー 6.0Ah 18V","BL1860B","222209MWS A62596","1",""
"2025/12/28 14:07:44","バッテリー 6.0Ah 18V","BL1860B","222909NWS Y30032","1",""
"2025/12/28 14:08:23","バッテリー 6.0Ah 18V","BL1860B","222311MWS A63518","1",""
"2025/12/28 14:09:21","バッテリー 6.0Ah 18V","BL1860B","222X11NWS A62329","1",""
"2025/12/28 14:09:58","バッテリー 6.0Ah 18V","BL1860B","222701NWS Y30348","1",""
"2025/12/28 14:11:21","バッテリー 3.0Ah 18V","BL1830B","182725FWS A61489","1",""
"2025/12/28 14:20:25","バッテリー 6.0Ah 18V","BL1860B","212725LWJ  A92230","1",""
"2025/12/28 14:22:25","バッテリー 3.0Ah 14.4V","BL1430","112Z21V B02274","1",""
"2025/12/28 14:23:02","バッテリー 3.0Ah 14.4V","BL1430","092203N A00807","1",""
"2025/12/28 14:23:35","バッテリー 3.0Ah 14.4V","BL1430","1380502C A05349","1",""
"2025/12/28 14:24:18","バッテリー 3.0Ah 14.4V","BL1430","112127T B00590","1",""
"2025/12/28 14:35:26","エアホース","3.0m","","1",""
"2025/12/28 14:37:27","充電式クリーナ","CL107FD","1092546Y","1",""
"2025/12/28 14:38:46","充電式クリーナ","CL140FD","263530Y","1",""
"2025/12/28 14:39:40","バッテリー 3.0Ah 14.4V","BL1430B","218X30GVM E06192","1",""
"2025/12/28 14:40:25","充電器(10.8V)","DC10SA","1107622","1",""
"2025/12/28 14:43:51","高圧エアホース(ピンク)","25.0m","","1",""
"2025/12/28 14:44:25","エアホース(赤)","25.0m","","2",""
"2025/12/28 14:58:22","TH形 ジブクレーン","TH00000010","No.756","1",""
"2025/12/29 10:26:17","充電式インパクトドライバ","TD134D","9398","1",""
"","充電式インパクトドライバー","","","1","26.5.9購入　バッテリー付x2"
"","充電式ハンマドリル 30mm","","","1","26.5.9購入"
"","充電式防じん 125mm","","","1","26.5.9購入　バッテリー付x2"
"","充電式集じん機","","","1","26.5.9購入"
"","集じん機","","","1","26.5.9購入"
"","充電式保冷温庫23L","","","1","26.5.9購入"
"","充電式ジグソー","","","1","26.5.9購入　バッテリー付x2"
"","充電式ハンマドリル 28mm","","","1","26.5.9購入"
"","充電式ブロア","","","1","26.5.9購入"
"","バッテリー","BL4050F","","1","26.5.9購入"
"","バッテリー","BL4050F","","1","26.5.9購入"`;

// ---------------------------------------------------------------------------
// 2. CSV PARSER (simple, handles quoted fields)
// ---------------------------------------------------------------------------

function parseCSVLine(line) {
  const fields = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        fields.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
  }
  fields.push(current);
  return fields;
}

function parseCSV(text) {
  const lines = text.split("\n").filter((l) => l.trim());
  const headers = parseCSVLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = (values[idx] || "").trim();
    });
    rows.push(row);
  }
  return rows;
}

// ---------------------------------------------------------------------------
// 3. NORMALIZATION RULES
// ---------------------------------------------------------------------------

/** Normalize name: trim, collapse full-width spaces to half-width, etc. */
function normalizeName(name) {
  let n = name.trim();
  // Collapse multiple spaces (half or full-width) into single half-width space
  n = n.replace(/[　\s]+/g, " ");
  return n;
}

/**
 * Name equivalence map: keys are raw names that should be normalized to values.
 * Applied after basic whitespace normalization.
 */
const NAME_ALIASES = {
  "仕上サンダ": "仕上げサンダ",
  "125mmランダムオービットサンダ": "125mm ランダムオービットサンダ",
};

function applyAliases(name) {
  return NAME_ALIASES[name] || name;
}

// ---------------------------------------------------------------------------
// 4. GROUPING LOGIC
// ---------------------------------------------------------------------------

/**
 * Determine if rows with the same name but different models should be
 * separate items. Returns a "disambiguation key" for each row.
 *
 * Rules:
 *   - Same name + same model (or model is measurement-like for hoses) = same item
 *   - Same name + different models that are clearly different products = separate items
 *   - Models that are just length/size specs (e.g. "30m", "5m 青") for hoses/cables
 *     are treated as distinguishing suffixes
 */
function computeItemKey(name, model) {
  // Items where model is just a measurement or color descriptor --
  // these are inherently different items per model variant.
  // For these, we always append the model to the name.
  const measurementModels = [
    "エアホース",
    "水道ホース",
    "高圧洗浄用ホース",
    "高圧エアホース(ピンク)",
    "エアホース(赤)",
    "BLUE-HOSE",
  ];

  if (measurementModels.includes(name)) {
    return `${name} ${model}`;
  }

  return name;
}

/**
 * Check if same-named rows with different models are truly different products
 * and need disambiguation.
 */
function needsModelDisambiguation(rows) {
  const models = new Set(
    rows.map((r) => r.model).filter((m) => m && m !== "不明")
  );
  if (models.size <= 1) return false;

  // If models are all the same base model, no disambiguation needed
  // (e.g., same tool with different serial numbers)
  return true;
}

// ---------------------------------------------------------------------------
// 5. MAIN PROCESSING
// ---------------------------------------------------------------------------

const rows = parseCSV(CSV_RAW);
const issues = []; // Data quality issues log

// Step 1: Parse and normalize all rows
const parsed = rows.map((r, idx) => {
  let name = normalizeName(r["呼称（呼び方）"]);
  name = applyAliases(name);
  const model = (r["型番"] || "").trim().replace(/[　\s]+/g, " ");
  const lot = (r["ロット番号"] || "").trim().replace(/[　\s]+/g, " ");
  const qty = parseInt(r["数"] || "1", 10) || 1;
  const notes = (r["備考"] || "").trim().replace(/[　\s]+/g, " ");

  return { idx: idx + 2, name, model, lot, qty, notes }; // idx+2 for 1-based + header
});

// Step 2: Apply special merging rules

// Rule 5: "高圧洗浄用ホース 30m" row with "さっきのに合算して" -- merge with previous 30m entry
for (let i = 0; i < parsed.length; i++) {
  if (parsed[i].notes === "さっきのに合算して") {
    // Find the previous entry with same name and model
    for (let j = i - 1; j >= 0; j--) {
      if (parsed[j].name === parsed[i].name && parsed[j].model === parsed[i].model) {
        issues.push(
          `Row ${parsed[i].idx}: "${parsed[i].notes}" -- merged ${parsed[i].qty} units into row ${parsed[j].idx} (${parsed[j].name} ${parsed[j].model})`
        );
        parsed[j].qty += parsed[i].qty;
        parsed.splice(i, 1);
        i--;
        break;
      }
    }
  }
}

// Log normalization applied
const aliasedNames = rows.filter((r) => {
  const raw = normalizeName(r["呼称（呼び方）"]);
  const aliased = applyAliases(raw);
  return raw !== aliased;
});
aliasedNames.forEach((r) => {
  const raw = normalizeName(r["呼称（呼び方）"]);
  issues.push(
    `Normalization: "${raw}" -> "${applyAliases(raw)}"`
  );
});

// Log leading/trailing whitespace removals
rows.forEach((r, i) => {
  const raw = r["呼称（呼び方）"];
  const trimmed = raw.trim();
  if (raw !== trimmed) {
    issues.push(`Row ${i + 2}: trimmed whitespace from name "${raw}" -> "${trimmed}"`);
  }
});

// Step 3: Group by item key
// First pass: group by normalized name to detect model disambiguation needs
const nameGroups = new Map();
for (const row of parsed) {
  const key = row.name;
  if (!nameGroups.has(key)) nameGroups.set(key, []);
  nameGroups.get(key).push(row);
}

// Decide which names need model disambiguation
const disambiguatedNames = new Set();

// Items where same name has different models that represent different products
const ALWAYS_DISAMBIGUATE = new Set([
  "撹拌機（有線）",       // UT2204 vs UT1305 -- clearly different
  "充電式扇風機",         // CF301D vs CF300D
  "発電機",               // EG2500I vs GE-900SS-IV
  "マックス スーパーエアコンプレッサー", // AK98471 vs AK-HL-HH1310E
  "マックス釘打機スーパーネイラ",       // HN91016 vs HN91117 vs HN91017 -- different models
  "充電器(14.4V-18V)",    // All DC18RF -- same model, should NOT disambiguate
  "充電器(7.2-18V)",      // DC18RC vs DC18RD -- different models
  "釘打機",               // NV 90HM vs NT 55A -- different models
  "スプレーガン",          // SPGK-15S vs F88 -- different models
  "漏電ブレーカー",        // PIPB-EK-T屋内型 vs KD-LB-2121SA -- different models
  "充電式クリーナ",        // CL141FD vs CL107FD vs CL140FD -- different models
  "充電ブロワー",          // MUB363D vs UB185D vs 不明 -- different models
  "バッテリー 3.0Ah 14.4V", // BL1430 vs BL1430B -- different models
]);

for (const [name, groupRows] of nameGroups) {
  const models = new Set(
    groupRows.map((r) => r.model).filter((m) => m && m !== "不明")
  );

  if (models.size > 1) {
    if (ALWAYS_DISAMBIGUATE.has(name)) {
      disambiguatedNames.add(name);
      issues.push(
        `Disambiguation: "${name}" has ${models.size} different model numbers: ${[...models].join(", ")} -- creating separate items per model`
      );
    } else {
      // Same model across rows = same item (units), no disambiguation
      // Only report if there are legitimately different models we're NOT splitting
    }
  }
}

// Step 4: Build final item map
// key = final item name, value = { name, item_code, units: [{lot, notes}] }
const items = new Map();

for (const row of parsed) {
  let itemName = row.name;
  let itemCode = row.model && row.model !== "不明" ? row.model : null;

  // Apply measurement-based items (hoses, cables with size in model)
  const measurementItems = [
    "エアホース",
    "水道ホース",
    "高圧洗浄用ホース",
    "高圧エアホース(ピンク)",
    "エアホース(赤)",
    "BLUE-HOSE",
  ];

  if (measurementItems.includes(itemName) && row.model) {
    itemName = `${itemName} ${row.model}`;
    itemCode = null; // model is really just a size descriptor
  }

  // Apply model disambiguation for tools with different models
  if (disambiguatedNames.has(row.name) && row.model && row.model !== "不明") {
    itemName = `${row.name} ${row.model}`;
    itemCode = row.model;
  } else if (disambiguatedNames.has(row.name) && (!row.model || row.model === "不明")) {
    // Keep base name for unknown-model entries
    itemName = `${row.name} (型番不明)`;
    itemCode = null;
  }

  // For non-disambiguated items, item_code comes from model
  // If multiple rows have same model, that's fine -- item_code stays the same

  if (!items.has(itemName)) {
    items.set(itemName, {
      name: itemName,
      item_code: itemCode,
      notes: null, // Will be set from model info
      units: [],
    });
  }

  const item = items.get(itemName);

  // Update item_code if this row has one and existing doesn't
  if (!item.item_code && itemCode) {
    item.item_code = itemCode;
  }

  // Generate units based on quantity
  for (let u = 0; u < row.qty; u++) {
    const unitNotes = [];
    // For qty > 1 rows, lot applies to all (or none)
    if (row.lot) unitNotes.push(`ロット: ${row.lot}`);
    if (row.notes) unitNotes.push(row.notes);
    item.units.push({
      notes: unitNotes.length > 0 ? unitNotes.join(" / ") : null,
    });
  }
}

// Step 5: Handle item_code uniqueness
// The schema has `item_code text unique` -- need to ensure no two items share the same code.
// For disambiguated items, the item_code is already unique (it's the model number in the name).
// For non-disambiguated items with shared model numbers, we need to check.
// Special case: 充電器 DC18RF and 充電器(14.4V-18V) DC18RF -- both use DC18RF
// Solution: only set item_code when it's unambiguous.
const codeUsage = new Map();
for (const [name, item] of items) {
  if (item.item_code) {
    if (!codeUsage.has(item.item_code)) codeUsage.set(item.item_code, []);
    codeUsage.get(item.item_code).push(name);
  }
}

for (const [code, names] of codeUsage) {
  if (names.length > 1) {
    issues.push(
      `item_code conflict: "${code}" used by ${names.length} items: ${names.join(", ")} -- item_code set to NULL for these items`
    );
    for (const name of names) {
      const item = items.get(name);
      // Store code in notes instead
      if (!item.notes) item.notes = `型番: ${code}`;
      item.item_code = null;
    }
  }
}

// Step 6: Set items.notes from model info for items without item_code
for (const [name, item] of items) {
  // If item_code is set, notes stays as-is (model is already in item_code)
  // If no item_code and no notes yet, model info goes to notes
  if (!item.item_code && !item.notes) {
    // Check if name already contains the model info
    // For measurement items, model is in the name, no need for notes
    // For unknown model items, no notes needed
    item.notes = null;
  }
}

// ---------------------------------------------------------------------------
// 6. SQL GENERATION
// ---------------------------------------------------------------------------

function escapeSQL(s) {
  if (s === null || s === undefined) return "NULL";
  return "'" + s.replace(/'/g, "''") + "'";
}

const sqlLines = [];

sqlLines.push("-- ============================================================================");
sqlLines.push("--  miniapps_tools seed data: power tools inventory");
sqlLines.push(`--  Generated: ${new Date().toISOString().slice(0, 10)}`);
sqlLines.push(`--  Source: CSV inventory (2025/12/28-29)`);
sqlLines.push("-- ============================================================================");
sqlLines.push("");
sqlLines.push("BEGIN;");
sqlLines.push("");

let totalItems = 0;
let totalUnits = 0;

for (const [itemName, item] of items) {
  totalItems++;

  sqlLines.push(`-- Item: ${itemName}`);
  sqlLines.push(
    `INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)`
  );
  sqlLines.push(
    `VALUES (${escapeSQL(itemName)}, ${escapeSQL(item.item_code)}, 'tool', 'individual', ${escapeSQL(item.notes)});`
  );
  sqlLines.push("");

  item.units.forEach((unit, idx) => {
    totalUnits++;
    const unitNum = idx + 1;
    sqlLines.push(
      `INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)`
    );
    sqlLines.push(
      `VALUES (`
    );
    sqlLines.push(
      `  (SELECT id FROM miniapps_tools.items WHERE name = ${escapeSQL(itemName)}),`
    );
    sqlLines.push(`  ${unitNum}, ${escapeSQL(unit.notes)}`);
    sqlLines.push(`);`);
  });

  sqlLines.push("");
}

sqlLines.push("COMMIT;");

const sql = sqlLines.join("\n");

// ---------------------------------------------------------------------------
// 7. OUTPUT
// ---------------------------------------------------------------------------

writeFileSync(OUTPUT_PATH, sql, "utf-8");

console.log("=== Seed SQL Generated ===");
console.log(`Output: ${OUTPUT_PATH}`);
console.log(`Total unique item types: ${totalItems}`);
console.log(`Total individual units:  ${totalUnits}`);
console.log("");
console.log("=== Data Quality Issues ===");
issues.forEach((issue) => console.log(`  - ${issue}`));
console.log(`\nTotal issues: ${issues.length}`);
