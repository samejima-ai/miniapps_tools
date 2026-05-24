"use server";

/**
 * Input Server Action — Gemini Flash Lite 経由の自然文抽出
 *
 * API キーはサーバー専用 env（GEMINI_API_KEY）で管理。
 * クライアントには結果のみ返す（キー漏洩防止）。
 *
 * LLM は抽出器。欠損補完しない (D-5)。
 * confidence は信号色 UI 表示とログ用途のみ (D-3)。
 */

import { learnAlias } from "@/lib/caaf/alias";
import { callGeminiJSON, isGeminiConfigured } from "@/lib/caaf/llm";
import { determineSignal } from "@/lib/caaf/signal";
import { createPublicServerClient, createServerSupabaseClient } from "@/lib/supabase/server";
import type { CaaFExtractionResult, Signal } from "@/types";
import { CaaFExtractionResultSchema } from "@/types";

/** LLM が抽出した site 文字列を本番 projects テーブルと照合した結果 */
export type ResolvedProject = {
  /** マッチした最有力候補（複数候補なら先頭、未一致なら null） */
  projectId: string | null;
  projectName: string | null;
  /** site が指定されなかった or マッチ 0 件 / 1件 / 複数候補 */
  status: "matched" | "not_found" | "no_site" | "multiple";
  /** 複数候補（最大10件、status="multiple" 時のピッカー UI 用） */
  candidates: Array<{ projectId: string; name: string }>;
};

/**
 * LLM 抽出 site → public.projects.name 部分一致照合。
 * - 先頭 1 件マッチ → matched
 * - 複数件 → multiple（クライアントで候補選択 UI 表示）
 * - エイリアス（project_name_aliases）にヒット → 即解決
 */
async function resolveProjectFromSite(siteName: string | null): Promise<ResolvedProject> {
  if (!siteName || siteName.trim() === "") {
    return {
      projectId: null,
      projectName: null,
      status: "no_site",
      candidates: [],
    };
  }
  // public スキーマ未設定 (env なし) で throw すると抽出全体が落ちるので、
  // 案件解決は best-effort: 失敗時は not_found で続行する。
  let supabase: Awaited<ReturnType<typeof createPublicServerClient>>;
  try {
    supabase = await createPublicServerClient();
  } catch (e) {
    console.warn("resolveProjectFromSite: public schema client unavailable:", e);
    return { projectId: null, projectName: null, status: "not_found", candidates: [] };
  }
  const supabaseTools = await createServerSupabaseClient();
  const trimmed = siteName.trim();

  // 0. プロジェクトエイリアス検索（学習済マッピング → ILIKE より優先）
  const { data: aliasHit } = await supabaseTools
    .from("project_name_aliases")
    .select("id, project_id, canonical_name, use_count")
    .eq("alias", trimmed.toLowerCase())
    .limit(1);

  if (aliasHit?.[0]) {
    // use_count をインクリメント
    await supabaseTools
      .from("project_name_aliases")
      .update({
        use_count: (aliasHit[0].use_count as number) + 1,
        last_used_at: new Date().toISOString(),
      })
      .eq("id", aliasHit[0].id);
    return {
      projectId: aliasHit[0].project_id as string,
      projectName: aliasHit[0].canonical_name as string,
      status: "matched",
      candidates: [],
    };
  }

  // 1. projects テーブル ILIKE 部分一致
  const { data, error } = await supabase
    .from("projects")
    .select("project_id, name")
    .ilike("name", `%${trimmed}%`)
    .is("deleted_at", null)
    .limit(10);

  if (error || !data || data.length === 0) {
    return {
      projectId: null,
      projectName: null,
      status: "not_found",
      candidates: [],
    };
  }

  const candidates = data.map((p) => ({
    projectId: p.project_id as string,
    name: p.name as string,
  }));

  // 単一マッチ → 確定
  if (candidates.length === 1) {
    const top = candidates[0];
    if (!top) {
      return {
        projectId: null,
        projectName: null,
        status: "not_found",
        candidates: [],
      };
    }
    return {
      projectId: top.projectId,
      projectName: top.name,
      status: "matched",
      candidates: [],
    };
  }

  // 複数候補 → ピッカー UI 用に候補リストを返す（先頭を仮選択）
  const top = candidates[0];
  if (!top) {
    return {
      projectId: null,
      projectName: null,
      status: "not_found",
      candidates: [],
    };
  }
  return {
    projectId: top.projectId,
    projectName: top.name,
    status: "multiple",
    candidates,
  };
}

/**
 * マスタ照合済みアイテム — 信号色カードに表示する。
 * LLM 抽出名 → DB 正式名称、番号存在チェック結果を保持。
 */
export type ResolvedItem = {
  extractedName: string;
  matchedName: string | null;
  matchedItemId: string | null;
  trackingType: "individual" | "quantity";
  unitResolutions: Array<{
    unitNumber: number;
    unitId: string | null;
    exists: boolean;
    /** 個体が存在し、かつ現在誰かが持出中の場合の holder_id */
    currentHolderId: string | null;
    currentHolderName: string | null;
  }>;
  availableUnits: number[];
  /**
   * 番号選択 UI 用: unitNumber → unitId マッピング + 持出状態。
   * currentHolderId が non-null なら現在誰かが持出中 = checkout 不可。
   */
  availableUnitDetails: Array<{
    unitNumber: number;
    unitId: string;
    currentHolderId: string | null;
    currentHolderName: string | null;
  }>;
  quantity: number | null;
  confidence: number;
  status:
    | "matched"
    | "not_found"
    | "unit_missing"
    | "unit_already_out"
    | "no_unit_specified"
    | "candidates_proposed";
  /** LLM 提案候補（status="candidates_proposed" 時のピッカー UI 用） */
  candidates: Array<{
    itemId: string;
    name: string;
    trackingType: "individual" | "quantity";
    /** LLM が推定した類似度（0-1） */
    confidence: number;
    /** 番号選択 UI 用に候補工具の利用可能番号も先取り */
    availableUnits: number[];
    availableUnitDetails: Array<{
      unitNumber: number;
      unitId: string;
      currentHolderId: string | null;
      currentHolderName: string | null;
    }>;
  }>;
};

const EXTRACTION_PROMPT = `あなたは工具管理システムの入力解析器です。
ユーザーの自然文から工具の持出・返却情報を抽出してください。

### 入力形式
ユーザーは LINE のような短いメッセージで入力します。以下のパターンすべてに対応すること：
- 1行に複数情報: 「バッテリー 2,3番 ブロワ 1番 池下現場」
- 複数行で1工具ずつ: 各行が工具名・番号・現場・日付・アクション等
- 工具名と番号が同じ行: 「18Vバッテリー11番」→ name:"18Vバッテリー", unitNumbers:[11]
- 数量表記: 「はかり1台」「ビス2箱」→ trackingType:"quantity", quantity:1 or 2
- カジュアルな略称: 「充電ブロアー」「インパクト」「バッテリー」等はそのまま name に入れる

### 無視する行
- 日付: 「今日」「明日」「5/23」等
- 曜日: 「月」「火」「月曜」等（1文字の曜日も含む）
- 時刻: 「6:59」「14:00」等
- これらは工具名ではないので items に含めない

### アクション判定
- 「持ち出し」「持出」「借りる」→ action: "checkout"
- 「返却」「返す」「戻す」→ action: "return"
- 明示されていなければ action: "checkout"（デフォルト）

### 必ず守るルール
- JSON のみ出力する。前置き・解説・markdown は一切付けない
- 情報が欠損している場合は補完・創作しない。ambiguities に入れる
- 「全返却」「まとめて返す」等の曖昧な対象指定は action="return" として返し、items は空にする
- unit_numbers は明示的に番号が書かれている場合のみ抽出する
- confidence は抽出の確信度（0.0-1.0）
- 1つの入力に複数工具が含まれる場合、必ずすべて items に含める

### 入力例と期待出力

入力: 「バッテリー 2,3番 ブロワ 1番 池下現場」
→ items: [{name:"バッテリー",unitNumbers:[2,3]}, {name:"ブロワ",unitNumbers:[1]}], site:"池下現場"

入力:
「今日
月
充電ブロアー
18Vバッテリー11番
はかり1台
持ち出し
6:59」
→ items: [{name:"充電ブロアー",trackingType:"individual",unitNumbers:[]}, {name:"18Vバッテリー",unitNumbers:[11]}, {name:"はかり",trackingType:"quantity",quantity:1}], action:"checkout"
（「今日」「月」「6:59」は日付・曜日・時刻なので無視）

### 出力JSON形式
{
  "site": "現場名 or null",
  "action": "checkout" | "return",
  "items": [
    {
      "name": "工具名",
      "trackingType": "individual" | "quantity",
      "unitNumbers": [番号],
      "quantity": null,
      "confidence": 0.0-1.0
    }
  ],
  "holderNote": "保持者メモ or null",
  "ambiguities": ["曖昧な点"]
}`;

/**
 * Gemini が snake_case で返す場合に camelCase へ正規化。
 * Zod スキーマは camelCase を期待するため。
 */
function normalizeExtraction(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const obj = raw as Record<string, unknown>;

  // items 配列の各要素を正規化
  const rawItems = (obj.items as unknown[]) ?? [];
  const items = rawItems.map((item) => {
    if (!item || typeof item !== "object") return item;
    const i = item as Record<string, unknown>;
    // unitNumbers: Gemini が文字列配列で返す場合があるため数値変換
    const rawNums = (i.unitNumbers ?? i.unit_numbers ?? []) as unknown[];
    const unitNumbers = rawNums
      .map((n) => (typeof n === "string" ? Number.parseInt(n, 10) : n))
      .filter((n): n is number => typeof n === "number" && !Number.isNaN(n));
    return {
      name: i.name,
      trackingType: i.trackingType ?? i.tracking_type ?? "individual",
      unitNumbers,
      quantity: i.quantity ?? null,
      confidence: typeof i.confidence === "number" ? i.confidence : 0,
    };
  });

  return {
    site: obj.site ?? null,
    action: obj.action ?? "checkout",
    items,
    holderNote: obj.holderNote ?? obj.holder_note ?? null,
    ambiguities: obj.ambiguities ?? [],
  };
}

/**
 * Layer C: not_found のアイテムを LLM で意味的に類似する候補と紐付ける。
 *
 * ILIKE 部分一致で見つからなかったアイテムに対し、マスタ全件を LLM に渡して
 * 上位3候補を提案させる。確信度 0.5 未満は破棄。
 *
 * D-5 維持: LLM は提案のみ。最終決定は人間タップ（status="candidates_proposed"）。
 */
const CANDIDATE_PROPOSAL_PROMPT = `あなたは工具名の類似性判定器です。
ユーザーが入力した工具名と、マスタの工具一覧を比較して、
意味的に近い候補を上位3件まで提案してください。

### マスタ行の読み方
"- {ID} | {正式名} [{category}/{tracking_type}]"
  notes: {備考} （存在する場合のみ次行にインデント付きで表示）

- category: tool=工具, material=資材, consumable=消耗品
- tracking_type: individual=個体番号管理, quantity=数量管理
- notes: 別名・メーカー・用途・互換情報などの補足。マッチ判定の参考にしてよい

### 必ず守るルール
- JSON のみ出力。前置き・解説・markdown は禁止
- マスタにある工具のみ提案する（IDが必要）
- 確信度 0.5 未満の候補は出さない（無理に出さない）
- 全く似た工具がなければ空配列を返す（候補を捏造しない）
- 「充電ブロアー」←→「エンジンブロワー」のような表記揺れ・略称・別名を許容
- 動力源違い（電動/エンジン）など属性違いでも、用途が同じなら候補とする
- notes に書かれた別名・メーカー・用途も類似性判定の根拠に使う
- 工具カテゴリ（category）が完全に異なるものは出さない（バッテリーをドライバの候補にしない）

### 出力JSON形式
{
  "proposals": [
    {
      "extractedName": "ユーザー入力名",
      "candidates": [
        { "itemId": "マスタID", "name": "マスタ正式名", "confidence": 0.0-1.0 }
      ]
    }
  ]
}`;

async function augmentNotFoundWithCandidates(
  resolved: ResolvedItem[],
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
): Promise<void> {
  const notFound = resolved.filter((r) => r.status === "not_found");
  if (notFound.length === 0) return;
  if (!isGeminiConfigured()) return;

  // マスタ全件取得（active のみ）。category と notes も渡して LLM の意味的マッチを補強
  const { data: allItems, error: itemsErr } = await supabase
    .from("items")
    .select("id, name, tracking_type, category, notes")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (itemsErr) {
    console.warn("[Layer C] master items fetch failed:", itemsErr);
    return;
  }
  if (!allItems || allItems.length === 0) return;

  const masterList = allItems
    .map((i) => {
      const base = `- ${i.id} | ${i.name} [${i.category}/${i.tracking_type}]`;
      const notes = i.notes && String(i.notes).trim() !== "" ? `\n    notes: ${i.notes}` : "";
      return `${base}${notes}`;
    })
    .join("\n");
  const queryList = notFound.map((r) => `- ${r.extractedName}`).join("\n");

  let parsed: unknown;
  try {
    parsed = await callGeminiJSON([
      { text: CANDIDATE_PROPOSAL_PROMPT },
      { text: `\n\n### マスタ工具一覧（ID | 名前 (追跡方式)）\n${masterList}` },
      { text: `\n\n### ユーザー入力（マスタ未一致）\n${queryList}` },
    ]);
  } catch (err) {
    console.warn("[Layer C] candidate proposal failed:", err);
    return;
  }

  // 防御的バリデーション: 仕様外の JSON 形式は破棄して Layer C スキップ
  if (
    !parsed ||
    typeof parsed !== "object" ||
    !("proposals" in parsed) ||
    !Array.isArray((parsed as { proposals: unknown }).proposals)
  ) {
    console.warn("[Layer C] invalid proposals shape, skipping:", parsed);
    return;
  }

  const rawProposals = (parsed as { proposals: unknown[] }).proposals;
  const proposalsByName = new Map<
    string,
    Array<{ itemId: string; name: string; confidence: number }>
  >();

  for (const rawP of rawProposals) {
    if (!rawP || typeof rawP !== "object") continue;
    const p = rawP as Record<string, unknown>;
    if (typeof p.extractedName !== "string") continue;
    if (!Array.isArray(p.candidates)) continue;

    const validCandidates = (p.candidates as unknown[])
      .map((rawC): { itemId: string; name: string; confidence: number } | null => {
        if (!rawC || typeof rawC !== "object") return null;
        const c = rawC as Record<string, unknown>;
        if (typeof c.itemId !== "string" || c.itemId === "") return null;
        if (typeof c.name !== "string" || c.name === "") return null;
        if (typeof c.confidence !== "number" || !Number.isFinite(c.confidence)) return null;
        const conf = Math.max(0, Math.min(1, c.confidence));
        return { itemId: c.itemId, name: c.name, confidence: conf };
      })
      .filter((c): c is { itemId: string; name: string; confidence: number } => c !== null);

    proposalsByName.set(p.extractedName, validCandidates);
  }

  // 各 not_found に対して候補を取得し、各候補の availableUnits も先取り
  const allCandidateIds = new Set<string>();
  for (const props of proposalsByName.values()) {
    for (const c of props) {
      if (c.confidence >= 0.5) allCandidateIds.add(c.itemId);
    }
  }

  if (allCandidateIds.size === 0) return;

  // 全候補の active unit + 持出状態を一括取得
  const candidateIdsArr = Array.from(allCandidateIds);
  const { data: candidateUnits, error: unitsErr } = await supabase
    .from("individual_units")
    .select("id, item_id, unit_number")
    .in("item_id", candidateIdsArr)
    .eq("is_active", true)
    .order("unit_number", { ascending: true });

  if (unitsErr) {
    console.warn("[Layer C] candidate units fetch failed:", unitsErr);
  }

  const outMap = await fetchCurrentlyOutByItems(supabase, candidateIdsArr);
  const holderNameMap = await fetchHolderNames(
    Array.from(outMap.values())
      .map((v) => v.holderId)
      .filter((id): id is string => !!id),
  );

  const unitsByItem = new Map<string, Array<{ id: string; unit_number: number }>>();
  for (const u of candidateUnits ?? []) {
    const itemId = u.item_id as string;
    const list = unitsByItem.get(itemId) ?? [];
    list.push({ id: u.id as string, unit_number: u.unit_number as number });
    unitsByItem.set(itemId, list);
  }

  // resolved に候補を反映
  const masterById = new Map(allItems.map((i) => [i.id as string, i]));

  for (const item of notFound) {
    const props = proposalsByName.get(item.extractedName) ?? [];
    const filtered = props
      .filter((c) => c.confidence >= 0.5)
      .filter((c) => masterById.has(c.itemId))
      .slice(0, 3);

    if (filtered.length === 0) continue;

    item.status = "candidates_proposed";
    item.candidates = filtered.map((c) => {
      const m = masterById.get(c.itemId);
      const rawUnits = unitsByItem.get(c.itemId) ?? [];
      const details = buildUnitDetails(rawUnits, outMap, holderNameMap);
      return {
        itemId: c.itemId,
        name: c.name,
        trackingType: (m?.tracking_type as "individual" | "quantity") ?? "individual",
        confidence: c.confidence,
        availableUnits: details.map((d) => d.unitNumber),
        availableUnitDetails: details,
      };
    });
  }
}

/**
 * 指定 item_id 群について、現在持出中の unit_id → holder_id マップを返す。
 * holder_id の保持者名解決は別途 fetchHolderNames を使う。
 */
async function fetchCurrentlyOutByItems(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  itemIds: string[],
): Promise<Map<string, { holderId: string | null }>> {
  const result = new Map<string, { holderId: string | null }>();
  if (itemIds.length === 0) return result;
  const { data, error } = await supabase
    .from("v_currently_out")
    .select("unit_id, current_holder_id")
    .in("item_id", itemIds);
  if (error) {
    console.warn("[resolveAgainstMaster] currently_out fetch failed:", error);
    return result;
  }
  for (const row of data ?? []) {
    result.set(row.unit_id as string, {
      holderId: (row.current_holder_id as string | null) ?? null,
    });
  }
  return result;
}

/**
 * 持出中 holder_id 群を public.employees から名前解決。
 * best-effort: 失敗時は空 Map を返して名前は null になる。
 */
async function fetchHolderNames(holderIds: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const ids = holderIds.filter((id): id is string => !!id);
  if (ids.length === 0) return result;
  try {
    const supabase = await createPublicServerClient();
    const { data, error } = await supabase
      .from("employees")
      .select("employee_id, family_name, given_name")
      .in("employee_id", ids);
    if (error) {
      console.warn("[resolveAgainstMaster] employees fetch failed:", error);
      return result;
    }
    for (const e of data ?? []) {
      const name =
        `${(e.family_name as string) ?? ""} ${(e.given_name as string) ?? ""}`.trim() || "(無名)";
      result.set(e.employee_id as string, name);
    }
  } catch (err) {
    console.warn("[resolveAgainstMaster] public client unavailable:", err);
  }
  return result;
}

/**
 * unit_id → { unitNumber, unitId, currentHolderId, currentHolderName } のリストを作る共通処理。
 * availableUnits / availableUnitDetails で使う形式に統一する。
 */
function buildUnitDetails(
  units: Array<{ id: string; unit_number: number }>,
  outMap: Map<string, { holderId: string | null }>,
  holderNameMap: Map<string, string>,
): Array<{
  unitNumber: number;
  unitId: string;
  currentHolderId: string | null;
  currentHolderName: string | null;
}> {
  return units.map((u) => {
    const out = outMap.get(u.id);
    const holderId = out?.holderId ?? null;
    return {
      unitNumber: u.unit_number,
      unitId: u.id,
      currentHolderId: holderId,
      currentHolderName: holderId ? (holderNameMap.get(holderId) ?? null) : null,
    };
  });
}

/**
 * LLM 抽出結果をマスタ DB と照合し、正式名称・番号存在を解決する。
 * 確認カード表示前に呼ぶことで、人間の入力ミスを確定前に補完・警告。
 */
async function resolveAgainstMaster(extraction: CaaFExtractionResult): Promise<ResolvedItem[]> {
  const supabase = await createServerSupabaseClient();
  const resolved: ResolvedItem[] = [];

  for (const item of extraction.items) {
    // 0. エイリアス検索（学習済みマッピング → ILIKE より優先）
    let matched: { id: string; name: string; tracking_type: string } | undefined;

    // alias は learnAlias と同じく trim + lowercase で正規化（前後空白で hit を漏らさない）
    const aliasKey = item.name.trim().toLowerCase();
    const { data: aliasHit } = await supabase
      .from("item_name_aliases")
      .select("id, item_id, canonical_name, use_count")
      .eq("alias", aliasKey)
      .limit(1);

    if (aliasHit?.[0]) {
      const { data: aliasItem } = await supabase
        .from("items")
        .select("id, name, tracking_type")
        .eq("id", aliasHit[0].item_id)
        .eq("is_active", true)
        .single();
      if (aliasItem) {
        matched = aliasItem as typeof matched;
        // エイリアスが照合で実際に使われた → use_count++ (確定前でもカウント)
        await supabase
          .from("item_name_aliases")
          .update({
            use_count: (aliasHit[0].use_count as number) + 1,
            last_used_at: new Date().toISOString(),
          })
          .eq("id", aliasHit[0].id);
      }
    }

    // 1. エイリアス未ヒット → items ILIKE 部分一致
    //    複数ヒットした場合は単純先頭採用せず、候補リストとして提示する
    let ilikeCandidates: Array<{ id: string; name: string; tracking_type: string }> = [];
    if (!matched) {
      const { data: matchedItems } = await supabase
        .from("items")
        .select("id, name, tracking_type")
        .ilike("name", `%${item.name}%`)
        .eq("is_active", true)
        .order("name", { ascending: true })
        .limit(10);

      ilikeCandidates = (matchedItems ?? []) as typeof ilikeCandidates;

      // 単一ヒットのみ matched として確定。複数ヒットは下で候補提示に回す
      if (ilikeCandidates.length === 1) {
        matched = ilikeCandidates[0];
      }
    }

    // 1b. 複数 ILIKE ヒット → 曖昧として候補提示モードへ
    if (!matched && ilikeCandidates.length > 1) {
      // 確度スコア: 完全一致(1.0) > 前方一致(0.9) > 含む(0.7)
      const query = item.name.trim().toLowerCase();
      const scored = ilikeCandidates.map((c) => {
        const name = (c.name as string).toLowerCase();
        let confidence: number;
        if (name === query) confidence = 1.0;
        else if (name.startsWith(query)) confidence = 0.9;
        else confidence = 0.7;
        return { ...c, confidence };
      });
      scored.sort((a, b) => b.confidence - a.confidence);

      // 各候補の active unit + 持出状態を一括取得
      const candidateIds = scored.map((c) => c.id);
      const { data: candidateUnits } = await supabase
        .from("individual_units")
        .select("id, item_id, unit_number")
        .in("item_id", candidateIds)
        .eq("is_active", true)
        .order("unit_number", { ascending: true });

      const outMap = await fetchCurrentlyOutByItems(supabase, candidateIds);
      const holderNameMap = await fetchHolderNames(
        Array.from(outMap.values())
          .map((v) => v.holderId)
          .filter((id): id is string => !!id),
      );

      const unitsByItem = new Map<string, Array<{ id: string; unit_number: number }>>();
      for (const u of candidateUnits ?? []) {
        const itemId = u.item_id as string;
        const list = unitsByItem.get(itemId) ?? [];
        list.push({ id: u.id as string, unit_number: u.unit_number as number });
        unitsByItem.set(itemId, list);
      }

      resolved.push({
        extractedName: item.name,
        matchedName: null,
        matchedItemId: null,
        trackingType: item.trackingType,
        unitResolutions: [],
        availableUnits: [],
        availableUnitDetails: [],
        quantity: item.quantity,
        confidence: item.confidence,
        status: "candidates_proposed",
        candidates: scored.slice(0, 5).map((c) => {
          const rawUnits = unitsByItem.get(c.id) ?? [];
          const details = buildUnitDetails(rawUnits, outMap, holderNameMap);
          return {
            itemId: c.id,
            name: c.name,
            trackingType: (c.tracking_type as "individual" | "quantity") ?? "individual",
            confidence: c.confidence,
            availableUnits: details.map((d) => d.unitNumber),
            availableUnitDetails: details,
          };
        }),
      });
      continue;
    }

    if (!matched) {
      resolved.push({
        extractedName: item.name,
        matchedName: null,
        matchedItemId: null,
        trackingType: item.trackingType,
        unitResolutions: item.unitNumbers.map((n) => ({
          unitNumber: n,
          unitId: null,
          exists: false,
          currentHolderId: null,
          currentHolderName: null,
        })),
        availableUnits: [],
        availableUnitDetails: [],
        quantity: item.quantity,
        confidence: item.confidence,
        status: "not_found",
        candidates: [],
      });
      continue;
    }

    // 2. 該当工具の全個体番号 + 持出状態を取得（候補表示用）
    const { data: allUnits } = await supabase
      .from("individual_units")
      .select("id, unit_number")
      .eq("item_id", matched.id)
      .eq("is_active", true)
      .order("unit_number", { ascending: true });

    const rawUnits = (allUnits ?? []).map((u) => ({
      id: u.id as string,
      unit_number: u.unit_number as number,
    }));
    const outMap = await fetchCurrentlyOutByItems(supabase, [matched.id]);
    const holderNameMap = await fetchHolderNames(
      Array.from(outMap.values())
        .map((v) => v.holderId)
        .filter((id): id is string => !!id),
    );
    const availableUnitDetails = buildUnitDetails(rawUnits, outMap, holderNameMap);
    const availableUnits = availableUnitDetails.map((u) => u.unitNumber);
    const unitMap = new Map(availableUnitDetails.map((u) => [u.unitNumber, u.unitId]));

    // 3. 指定番号の存在チェック + 持出中チェック
    const detailByNumber = new Map(availableUnitDetails.map((d) => [d.unitNumber, d]));
    const unitResolutions = item.unitNumbers.map((num) => {
      const d = detailByNumber.get(num);
      return {
        unitNumber: num,
        unitId: d?.unitId ?? null,
        exists: !!d,
        currentHolderId: d?.currentHolderId ?? null,
        currentHolderName: d?.currentHolderName ?? null,
      };
    });

    const hasUnitMissing = unitResolutions.some((r) => !r.exists);
    const hasUnitAlreadyOut = unitResolutions.some((r) => r.exists && r.currentHolderId);
    // 番号必須かはマスタの tracking_type だけで判定する。LLM 抽出の trackingType が
    // 誤判定でも、quantity マスタなら番号なしで matched 扱いにする。
    const isIndividualNoUnit =
      matched.tracking_type === "individual" && item.unitNumbers.length === 0;

    resolved.push({
      extractedName: item.name,
      matchedName: matched.name as string,
      matchedItemId: matched.id as string,
      trackingType: (matched.tracking_type as "individual" | "quantity") ?? item.trackingType,
      unitResolutions,
      availableUnits,
      availableUnitDetails,
      quantity: item.quantity,
      confidence: item.confidence,
      status: hasUnitMissing
        ? "unit_missing"
        : hasUnitAlreadyOut
          ? "unit_already_out"
          : isIndividualNoUnit
            ? "no_unit_specified"
            : "matched",
      candidates: [],
    });
  }

  // ── Layer C: not_found のアイテムに LLM 類似度マッチング ──
  await augmentNotFoundWithCandidates(resolved, supabase);

  return resolved;
}

/**
 * マスタ照合結果を加味した信号色判定。
 * - return action → red (domain-specific)
 * - not_found / unit_missing → orange
 * - no_unit_specified → yellow
 * - 全 matched → 元の confidence ベース判定
 */
function determineSignalWithResolution(
  extraction: CaaFExtractionResult,
  resolved: ResolvedItem[],
): Signal {
  if (extraction.action === "return") return "red";
  const baseSignal = determineSignal(extraction);

  if (resolved.length === 0) return baseSignal;
  if (resolved.some((r) => r.status === "not_found")) return "orange";
  if (resolved.some((r) => r.status === "unit_missing")) return "orange";
  // unit_already_out: 既に他人が持出中 → 二重持出は明示確認が必要なので赤
  if (resolved.some((r) => r.status === "unit_already_out")) return "red";
  // candidates_proposed: LLM 提案ありだが人間タップ未確定 → 黄（要選択）
  if (resolved.some((r) => r.status === "candidates_proposed")) return "yellow";
  if (resolved.some((r) => r.status === "no_unit_specified")) return "yellow";

  return baseSignal;
}

export async function extractAction(naturalText: string): Promise<{
  extraction: CaaFExtractionResult;
  signal: Signal;
  resolved: ResolvedItem[];
  resolvedProject: ResolvedProject;
}> {
  if (!isGeminiConfigured()) {
    // フォールバック: デモ解析（LLM なし）でも UI で確認できるよう、
    // マスタ照合と案件解決まで通す。
    const { extractFromNaturalText } = await import("@/lib/llm/router");
    const demo = await extractFromNaturalText(naturalText);
    const demoResolved = await resolveAgainstMaster(demo.extraction);
    const demoProject = await resolveProjectFromSite(demo.extraction.site);
    return {
      extraction: demo.extraction,
      signal: determineSignalWithResolution(demo.extraction, demoResolved),
      resolved: demoResolved,
      resolvedProject: demoProject,
    };
  }

  // Layer B: 上位エイリアスを LLM プロンプトに注入（正規化精度向上）
  const supabase = await createServerSupabaseClient();
  const { data: topAliases } = await supabase
    .from("item_name_aliases")
    .select("alias, canonical_name")
    .order("use_count", { ascending: false })
    .limit(30);

  // プロンプト注入防止: alias / canonical_name から改行・制御文字を除去、長さ制限
  // (RLS で authenticated 限定にしているが、防御層は重ねる)
  const sanitize = (s: unknown): string =>
    String(s ?? "")
      .replace(/[\r\n\t]+/g, " ")
      // biome-ignore lint/suspicious/noControlCharactersInRegex: 制御文字を除去するためにレンジ指定が必要
      .replace(/[ -]/g, "")
      .slice(0, 100);

  const aliasContext =
    topAliases && topAliases.length > 0
      ? `\n\n### 過去の入力パターン（この名前で入力されたら対応する正式名に読み替えてください）\n${topAliases.map((a) => `${sanitize(a.alias)} → ${sanitize(a.canonical_name)}`).join("\n")}`
      : "";

  const parsed = await callGeminiJSON([
    { text: EXTRACTION_PROMPT + aliasContext },
    { text: `\n\n### ユーザー入力\n${naturalText}` },
  ]);

  // Gemini が snake_case / 文字列型で返す場合の正規化
  const normalized = normalizeExtraction(parsed);
  const result = CaaFExtractionResultSchema.safeParse(normalized);

  if (!result.success) {
    console.error("Zod validation error:", result.error.issues);
    throw new Error("LLM の応答が期待されるスキーマと一致しませんでした");
  }

  const extraction = result.data;

  // マスタ照合: 正式名称 + 番号存在を事前解決
  const resolved = await resolveAgainstMaster(extraction);
  // 案件照合: 本番 public.projects と部分一致
  const resolvedProject = await resolveProjectFromSite(extraction.site);
  const signal = determineSignalWithResolution(extraction, resolved);

  return { extraction, signal, resolved, resolvedProject };
}

/**
 * 解決済みアイテムで movement INSERT（持出確定）
 *
 * resolveAgainstMaster で事前解決した item_id / unit_id を使い、
 * 重複 DB クエリなしで直接 INSERT する。
 *
 * holder_id = 保持者、moved_by = 入力者 (D-7)
 */
export async function confirmCheckoutAction(
  extraction: CaaFExtractionResult,
  resolved: ResolvedItem[],
  movedBy: string,
  holderId: string | null,
  projectId: string | null = null,
  projectCanonicalName: string | null = null,
): Promise<{ insertedCount: number; errors: string[] }> {
  const supabase = await createServerSupabaseClient();
  const errors: string[] = [];
  let insertedCount = 0;

  for (const item of resolved) {
    if (!item.matchedItemId) {
      errors.push(`「${item.extractedName}」に一致する工具が見つかりませんでした`);
      continue;
    }

    if (item.unitResolutions.length > 0) {
      for (const unit of item.unitResolutions) {
        if (!unit.exists || !unit.unitId) {
          errors.push(
            `「${item.matchedName}」の ${unit.unitNumber}番 は存在しません（${item.availableUnits.join(",")}番が利用可能）`,
          );
          continue;
        }

        // 持出中の二重持出を拒否（checkout のみ。return / transfer は対象外）
        if (extraction.action === "checkout" && unit.currentHolderId) {
          const holder = unit.currentHolderName ?? "他の人";
          errors.push(
            `「${item.matchedName}」の #${unit.unitNumber} は ${holder} が持出中です（二重持出は不可）`,
          );
          continue;
        }

        const { error } = await supabase.from("item_movements").insert({
          item_id: item.matchedItemId,
          unit_id: unit.unitId,
          quantity: null,
          movement_type: extraction.action,
          from_location_id: null,
          to_location_id: null,
          project_id: projectId,
          holder_id: holderId ?? movedBy,
          moved_by: movedBy,
          source: "caaf",
          confidence: item.confidence,
          notes: extraction.site ? `現場: ${extraction.site}` : null,
        });

        if (error) {
          errors.push(`${item.matchedName} #${unit.unitNumber}: ${error.message}`);
        } else {
          insertedCount++;
        }
      }
    } else if (item.trackingType === "individual") {
      errors.push(
        `「${item.matchedName}」は個体管理です。番号を指定してください（${item.availableUnits.join(",")}番が利用可能）`,
      );
    } else {
      const { error } = await supabase.from("item_movements").insert({
        item_id: item.matchedItemId,
        unit_id: null,
        quantity: item.quantity ?? 1,
        movement_type: extraction.action,
        from_location_id: null,
        to_location_id: null,
        project_id: projectId,
        holder_id: holderId ?? movedBy,
        moved_by: movedBy,
        source: "caaf",
        confidence: item.confidence,
        notes: extraction.site ? `現場: ${extraction.site}` : null,
      });

      if (error) {
        errors.push(`${item.matchedName}: ${error.message}`);
      } else {
        insertedCount++;
      }
    }
  }

  // ── エイリアス学習: extractedName ≠ matchedName を自動保存 (D-4: 確定後のみ) ──
  for (const item of resolved) {
    if (!item.matchedItemId || !item.matchedName || item.extractedName === item.matchedName) {
      continue;
    }
    await learnAlias(
      supabase,
      { table: "item_name_aliases", foreignKeyColumn: "item_id" },
      item.extractedName,
      item.matchedItemId,
      item.matchedName,
    );
  }

  // ── プロジェクトエイリアス学習 ──
  if (
    projectId &&
    projectCanonicalName &&
    extraction.site &&
    extraction.site.trim() !== "" &&
    extraction.site.trim() !== projectCanonicalName
  ) {
    await learnAlias(
      supabase,
      { table: "project_name_aliases", foreignKeyColumn: "project_id" },
      extraction.site.trim(),
      projectId,
      projectCanonicalName,
    );
  }

  return { insertedCount, errors };
}

/**
 * ストローク内対話修正 — LLM に修正指示を解釈させ、抽出結果を更新する。
 *
 * 元の入力・現在の抽出結果・修正指示を LLM に渡し、
 * 更新された抽出結果を受け取って再度マスタ照合する。
 *
 * D-5: 元の入力にない工具を創作しない。
 */

const CLARIFICATION_PROMPT = `あなたは工具管理システムの修正指示解釈器です。
元の入力と現在の抽出結果を踏まえ、ユーザーの修正指示に従って抽出結果を更新してください。

### 必ず守るルール
- JSON のみ出力。前置き・解説・markdown は禁止
- 修正対象のアイテムのみ変更し、それ以外は元のまま維持する
- 元の入力にない工具を新たに創作しない
- 「やめる」「キャンセル」= items を空配列にする
- 「◯◯はスキップ」= items から該当工具を除外する
- 番号変更（「3番は1番に変更」）= 該当アイテムの unitNumbers を修正
- 現場変更（「現場は星ヶ丘」）= site を修正
- アイテム追加（「バッテリーは4番も追加」）= 既存工具の番号追加のみ許可

### 出力JSON形式
{
  "site": "現場名 or null",
  "action": "checkout" | "return",
  "items": [
    {
      "name": "工具名",
      "trackingType": "individual" | "quantity",
      "unitNumbers": [番号],
      "quantity": null,
      "confidence": 0.0-1.0
    }
  ],
  "holderNote": "保持者メモ or null",
  "ambiguities": ["曖昧な点"],
  "summary": "変更内容の1行要約（日本語）"
}`;

export async function clarifyAction(
  originalText: string,
  currentExtraction: CaaFExtractionResult,
  clarificationText: string,
): Promise<{
  extraction: CaaFExtractionResult;
  signal: Signal;
  resolved: ResolvedItem[];
  resolvedProject: ResolvedProject;
  summary: string;
}> {
  if (!isGeminiConfigured()) {
    throw new Error("修正機能には Gemini API キーが必要です");
  }

  const parsed = await callGeminiJSON<Record<string, unknown>>([
    { text: CLARIFICATION_PROMPT },
    { text: `\n\n### 元の入力\n${originalText}` },
    { text: `\n\n### 現在の抽出結果\n${JSON.stringify(currentExtraction)}` },
    { text: `\n\n### ユーザーの修正指示\n${clarificationText}` },
  ]);

  // summary を抽出してから正規化
  const summary = typeof parsed.summary === "string" ? parsed.summary : "修正を反映しました";

  const normalized = normalizeExtraction(parsed);
  const validationResult = CaaFExtractionResultSchema.safeParse(normalized);

  if (!validationResult.success) {
    console.error("Zod validation error (clarify):", validationResult.error.issues);
    throw new Error("LLM の応答が期待されるスキーマと一致しませんでした");
  }

  const extraction = validationResult.data;
  const resolved = await resolveAgainstMaster(extraction);
  const resolvedProject = await resolveProjectFromSite(extraction.site);
  const signal = determineSignalWithResolution(extraction, resolved);

  return { extraction, signal, resolved, resolvedProject, summary };
}
