/**
 * CaaF gen-2 Config — 工具 host 会話エンジン（M-E.1、純関数）
 *
 * gen-1 の `useCaaF`（stroke 状態機械）に相当する「会話の脳」を、Core の純関数
 * （applyDefaults / validateRecord / nextRequiredField / isComplete / applyAnswer /
 *  skipOptional / confirmRecord / recordSignal / sanitizeRecord）の上に Config 側で組む。
 *
 * 設計方針:
 *  - **純関数のみ**（server-only 非依存）。LLM 呼び出し・DB read は server（host-server.ts）が行い、
 *    取得済みデータ（抽出結果・候補配列）を本エンジンに渡す。会話の「判断」は全てここ＝テスト可能。
 *  - tracking_type 解決後は `toolsAppForTracking` の effective app に切替えてラリーを回す（M-D）。
 *  - FW Don't は Core/M-C が担保。本エンジンは状態判定のみで write しない（罠を作らない）。
 *
 * スコープ（M-E.1）:
 *  - 解決するのは **item（必須 reference）+ tracking + units/quantity** まで。
 *  - site / holder は name→id 解決が未実装（M-E.2）。executable record に未解決名を id として
 *    混入させないため、抽出名は `pendingRefs`（表示専用）に退避し record には入れない。
 *
 * UI（M-E.2）は HostState を描画し、rally の answer/skip/choose は本純関数を client 側で適用する。
 * capture（LLM+read）と execute（write）だけが server（host-server.ts）を経由する。
 */

import type { CaaFApp, CaaFFieldValue, CaaFRecord, Signal } from "@caaf/core";
import {
  applyAnswer,
  applyDefaults,
  confirmRecord,
  isComplete,
  nextRequiredField,
  recordSignal,
  sanitizeRecord,
  skipOptional,
  validateRecord,
} from "@caaf/core";
import { toolsApp, toolsAppForTracking } from "./tools-app";
import { TOOLS_FIELD } from "./tools-fields";
import {
  type ItemCandidate,
  type ResolvedUnit,
  type SiteCandidate,
  resolveRequestedUnits,
} from "./tools-mapping";

/** M-E.1 で executable record に入れてよい（今 解決可能な）フィールド。site/holder は M-E.2。 */
const WRITABLE_FIELDS: ReadonlySet<string> = new Set([
  TOOLS_FIELD.action,
  TOOLS_FIELD.item,
  TOOLS_FIELD.units,
  TOOLS_FIELD.quantity,
]);

/** host 会話のフェーズ。 */
export type HostPhase =
  | "idle" // 入力待ち（初期）
  | "not_found" // 工具名がマスタに無い → 言い直し誘導
  | "candidates" // 複数候補 → ユーザー選択
  | "rally" // 不足必須を 1 つずつ質問（FW spec §7.2）
  | "ready" // 全必須充足 → サマリー + 実行ボタン
  | "out_of_scope" // 工具と無関係（Intent out_of_scope）
  | "cancelled"; // 全リセット（Intent cancel）

/** host が UI へ surface する注意点（罠を作らず、提示に徹する）。 */
export interface HostIssue {
  kind: "missing_units" | "already_out" | "not_found" | "no_unit_or_qty";
  message: string;
}

/** 抽出したが id 未解決の reference 名（表示用。M-E.2 で解決して record へ昇格）。 */
export interface PendingRefs {
  site: string | null;
  holder: string | null;
}

/** host 会話の全状態（serializable。client が保持し server へ受け渡す）。 */
export interface HostState {
  /** 現在の effective app（item 解決後は tracking 切替済み）。 */
  app: CaaFApp;
  record: CaaFRecord;
  phase: HostPhase;
  /** candidates フェーズ時の選択肢。 */
  candidates: ItemCandidate[];
  /** 解決中/解決済みの工具表示名。 */
  itemName: string | null;
  /** 解決済み item の在庫個体（rally で番号回答を client 側解決するため保持。quantity は []）。 */
  availableUnits: ResolvedUnit[];
  /** id 未解決の reference 名（site/holder）。site は解決後も表示名として保持する。 */
  pendingRefs: PendingRefs;
  /** 現場の複数候補（M-E.3。1 件確定時は record.site に昇格、複数/0 件は未昇格）。 */
  siteCandidates: SiteCandidate[];
  issues: HostIssue[];
  signal: Signal;
}

/** 空の初期状態（ベース toolsApp、未入力）。 */
export function initialHostState(): HostState {
  return {
    app: toolsApp,
    record: { app: toolsApp.id, fields: {}, status: "draft" },
    candidates: [],
    itemName: null,
    availableUnits: [],
    pendingRefs: { site: null, holder: null },
    siteCandidates: [],
    issues: [],
    phase: "idle",
    signal: "red",
  };
}

/** field 値を安全に取り出す。 */
function fieldVal(record: CaaFRecord, name: string): unknown {
  return record.fields[name]?.value;
}

/**
 * 工具固有の信号 overlay（migration §2: Core 3 色 + 工具 overlay）。
 * Core の recordSignal を基準に、提示すべき issue があれば red へ寄せる（要確認）。
 */
export function hostSignal(app: CaaFApp, record: CaaFRecord, issues: HostIssue[]): Signal {
  if (issues.length > 0) return "red";
  return recordSignal(app, record);
}

/**
 * record の充足状況からフェーズ・信号を再計算する（純関数の中核）。
 * default 充当 → 必須判定 → rally / ready。issues は呼び出し側が引き継ぐ。
 */
export function recompute(state: HostState): HostState {
  const record = applyDefaults(state.app, state.record);
  const phase: HostPhase = isComplete(state.app, record) ? "ready" : "rally";
  return { ...state, record, phase, signal: hostSignal(state.app, record, state.issues) };
}

function refName(extracted: Record<string, CaaFFieldValue>, name: string): string | null {
  const v = extracted[name]?.value;
  return typeof v === "string" && v !== "" ? v : null;
}

/**
 * 抽出結果（CaaFFieldValue マップ）を取り込み、解決前の record を作る。
 * - WRITABLE_FIELDS（action/item/units/quantity）のみ record へ（Don't #1 + 未解決 ref 混入防止）。
 * - site/holder は pendingRefs（表示専用）へ退避。
 * - item field には工具「名」（string）が入る段階。itemName を控え、解決待ち（idle）にする。
 */
export function applyExtractedRecord(
  prev: HostState,
  extracted: Record<string, CaaFFieldValue>,
): HostState {
  const fields: Record<string, CaaFFieldValue> = {};
  // 既存 record の writable field を引き継ぐ。
  for (const [name, fv] of Object.entries(prev.record.fields)) {
    if (WRITABLE_FIELDS.has(name)) fields[name] = fv;
  }
  for (const [name, fv] of Object.entries(extracted)) {
    if (!WRITABLE_FIELDS.has(name)) continue;
    const existing = fields[name];
    if (existing && existing.source === "user") continue; // 確定はユーザー
    if (fv.value === null || fv.value === undefined) continue;
    fields[name] = fv;
  }
  const record: CaaFRecord = { app: toolsApp.id, fields, status: "mapped" };
  const itemRaw = fieldVal(record, TOOLS_FIELD.item);
  const itemName = typeof itemRaw === "string" ? itemRaw : null;

  return {
    ...prev,
    app: toolsApp,
    record,
    itemName,
    pendingRefs: {
      site: refName(extracted, TOOLS_FIELD.site) ?? prev.pendingRefs.site,
      holder: refName(extracted, TOOLS_FIELD.holder) ?? prev.pendingRefs.holder,
    },
    candidates: [],
    availableUnits: [],
    siteCandidates: [],
    issues: [],
    phase: "idle",
    // 新 record に基づき signal を再計算（直前ターンの signal を残さない）。
    signal: hostSignal(toolsApp, record, []),
  };
}

/** itemName の表示フォールバック（空文字/空白も「工具」に寄せる）。 */
function itemLabel(name: string | null): string {
  return name && name.trim() !== "" ? name : "工具";
}

/**
 * item 解決の候補配列を取り込み、分岐する（read 後に server から呼ばれる純判断）。
 *  - 0 件 → not_found（言い直し誘導）
 *  - 1 件 → 確定解決（resolveToCandidate）
 *  - 複数 → candidates（ユーザー選択）
 */
export function applyItemCandidates(prev: HostState, candidates: ItemCandidate[]): HostState {
  if (candidates.length === 0) {
    return {
      ...prev,
      phase: "not_found",
      candidates: [],
      signal: "red",
      issues: [
        {
          kind: "not_found",
          message: `「${itemLabel(prev.itemName)}」がマスタに見つかりません。言い直してください`,
        },
      ],
    };
  }
  if (candidates.length === 1) {
    return resolveToCandidate(prev, candidates[0] as ItemCandidate, "context");
  }
  // 複数候補。issue は無いが signal は record に追従させる（直前 signal を残さない）。
  return {
    ...prev,
    phase: "candidates",
    candidates,
    issues: [],
    signal: hostSignal(prev.app, prev.record, []),
  };
}

/** candidates フェーズでユーザーが 1 つ選んだ（純関数。再 fetch 不要＝候補が units を保持）。 */
export function chooseCandidate(prev: HostState, candidate: ItemCandidate): HostState {
  return resolveToCandidate(prev, candidate, "user");
}

/**
 * 候補 1 件に確定し、tracking に応じた effective app へ切替えて record を再構成する。
 *  - item field = itemId（解決済 reference）
 *  - individual: 要求番号を candidate.units に突き合わせ units = ResolvedUnit[]（missing/already_out を issue 化）
 *  - quantity: quantity field を維持
 *  - effective app で sanitize（無関係 field を破棄: Don't #1）→ recompute
 */
function resolveToCandidate(
  prev: HostState,
  candidate: ItemCandidate,
  itemSource: CaaFFieldValue["source"],
): HostState {
  const app = toolsAppForTracking(candidate.trackingType);
  const issues: HostIssue[] = [];
  const itemConf = prev.record.fields[TOOLS_FIELD.item]?.confidence ?? 1;

  const fields: Record<string, CaaFFieldValue> = { ...prev.record.fields };
  // 解決済み item id を入れる（以後 re-extract で上書きされないよう user/context source）。
  fields[TOOLS_FIELD.item] = { value: candidate.itemId, confidence: itemConf, source: itemSource };

  const isCheckout = fieldVal(prev.record, TOOLS_FIELD.action) !== "return";

  if (candidate.trackingType === "individual") {
    const res = resolveRequestedUnits(readRequestedNumbers(prev.record), candidate.units);
    // 解決個体があるときだけ units を確定する。空配列は Core の hasValue で「充足」と
    // 誤判定されるため、番号未指定/全 missing 時は units を未設定にして rally で尋ねる。
    if (res.resolved.length > 0) {
      fields[TOOLS_FIELD.units] = { value: res.resolved, confidence: 1, source: "context" };
    } else {
      delete fields[TOOLS_FIELD.units];
    }
    if (res.missing.length > 0) {
      issues.push({
        kind: "missing_units",
        message: `${candidate.name} に存在しない番号: ${res.missing.join(", ")}`,
      });
    }
    // D-11 リスクは checkout のみ提示（return は持出中個体を戻すので拒否しない）。
    if (isCheckout && res.alreadyOut.length > 0) {
      issues.push({
        kind: "already_out",
        message: `${candidate.name} の持出中番号: ${res.alreadyOut.map((u) => u.unitNumber).join(", ")}`,
      });
    }
  }

  // effective app で sanitize（individual なら quantity を、quantity なら units を破棄）。
  const record = sanitizeRecord(app, { app: app.id, fields, status: "mapped" });

  return recompute({
    ...prev,
    app,
    record,
    itemName: candidate.name,
    availableUnits: candidate.units, // rally の番号回答を client 側で解決するため保持
    candidates: [],
    issues,
  });
}

/** 抽出された units field（番号配列 or 解決済み）から要求番号 number[] を取り出す。 */
function readRequestedNumbers(record: CaaFRecord): number[] {
  const raw = fieldVal(record, TOOLS_FIELD.units);
  if (!Array.isArray(raw)) return [];
  const nums: number[] = [];
  for (const u of raw) {
    if (typeof u === "number") nums.push(u);
    else if (u && typeof (u as ResolvedUnit).unitNumber === "number")
      nums.push((u as ResolvedUnit).unitNumber);
  }
  return nums;
}

/** rally: ユーザー回答を 1 field に適用して再計算（純）。 */
export function answerField(state: HostState, field: string, value: unknown): HostState {
  return recompute({ ...state, record: applyAnswer(state.record, field, value) });
}

/**
 * rally: 個体管理で番号を回答（client 側解決）。state.availableUnits に突き合わせて
 * units field を確定し、missing/already_out を issue 化する（resolveToCandidate と同じ規約）。
 */
export function applyUnitNumbers(state: HostState, numbers: number[]): HostState {
  const res = resolveRequestedUnits(numbers, state.availableUnits);
  const issues: HostIssue[] = [];
  if (res.missing.length > 0) {
    issues.push({
      kind: "missing_units",
      message: `${itemLabel(state.itemName)} に存在しない番号: ${res.missing.join(", ")}`,
    });
  }
  const isCheckout = fieldVal(state.record, TOOLS_FIELD.action) !== "return";
  if (isCheckout && res.alreadyOut.length > 0) {
    issues.push({
      kind: "already_out",
      message: `${itemLabel(state.itemName)} の持出中番号: ${res.alreadyOut.map((u) => u.unitNumber).join(", ")}`,
    });
  }
  if (res.resolved.length === 0) {
    // 全 missing 等 → units は未設定のまま rally 継続（issue で番号を示す）。
    return recompute({ ...state, issues });
  }
  const next = answerField(state, TOOLS_FIELD.units, res.resolved);
  // 新 issues に合わせて signal を再計算（answerField は旧 issues で計算済みのため）。
  return { ...next, issues, signal: hostSignal(next.app, next.record, issues) };
}

/** rally: 任意 field をスキップして再計算（必須はスキップ不可、Core が保証）。 */
export function skipField(state: HostState, field: string): HostState {
  return recompute({ ...state, record: skipOptional(state.app, state.record, field) });
}

/** 現場 field（reference）に解決済み project_id を入れる純関数。 */
function setSite(state: HostState, candidate: SiteCandidate): HostState {
  const fields = {
    ...state.record.fields,
    [TOOLS_FIELD.site]: { value: candidate.projectId, confidence: 1, source: "context" as const },
  };
  return recompute({
    ...state,
    record: { ...state.record, fields },
    // pendingRefs.site は確定名で表示更新。siteCandidates はクリア。
    pendingRefs: { ...state.pendingRefs, site: candidate.name },
    siteCandidates: [],
  });
}

/**
 * read("resolve-site") の候補を取り込む（M-E.3、純判断）。
 *  - 1 件 → 現場を確定（record.site に project_id を昇格）。
 *  - 0 件 → 未照合のまま（pendingRefs.site の表示名は維持、record には入れない＝write 安全）。
 *  - 複数 → siteCandidates に保持し UI で選択（未昇格）。
 * 現場は任意フィールドのため、未確定でも rally/ready の必須充足には影響しない。
 */
export function applySiteResolution(state: HostState, candidates: SiteCandidate[]): HostState {
  if (candidates.length === 1) return setSite(state, candidates[0] as SiteCandidate);
  return { ...state, siteCandidates: candidates };
}

/** 複数現場候補からユーザーが 1 つ選んだ（純）。 */
export function chooseSite(state: HostState, candidate: SiteCandidate): HostState {
  return setSite(state, candidate);
}

/** 次に尋ねるべき field（rally 中）。なければ null（= ready）。 */
export function pendingField(state: HostState) {
  return nextRequiredField(state.app, state.record);
}

/** record を confirmed にした「実行準備済み」record を返す（Don't #3: 明示確認）。 */
export function confirmForExecute(state: HostState): CaaFRecord {
  return confirmRecord(state.record);
}

/**
 * サマリーカード用の 1 行要約（ready フェーズ）。固有名詞 OK = Config 側。
 * 例: 「バッテリー #2,#3 を 池下現場 へ 持ち出し」
 */
export function summarize(state: HostState): string {
  const action = fieldVal(state.record, TOOLS_FIELD.action) === "return" ? "返却" : "持ち出し";
  const name = state.itemName ?? "工具";
  const unitsRaw = fieldVal(state.record, TOOLS_FIELD.units);
  const qty = fieldVal(state.record, TOOLS_FIELD.quantity);
  let target = "";
  if (Array.isArray(unitsRaw) && unitsRaw.length > 0) {
    target = ` ${(unitsRaw as ResolvedUnit[]).map((u) => `#${u.unitNumber}`).join(",")}`;
  } else if (typeof qty === "number") {
    target = ` ${qty}個`;
  }
  const site = state.pendingRefs.site ? ` ${state.pendingRefs.site}へ` : "";
  return `${name}${target}${site} を ${action}`;
}

/** out_of_scope / cancel を host フェーズへ写す（server が intent から呼ぶ）。 */
export function intentPhase(prev: HostState, phase: "out_of_scope" | "cancelled"): HostState {
  if (phase === "cancelled") return initialHostState();
  return { ...prev, phase: "out_of_scope" };
}

/** デバッグ/テスト補助: 現在の必須未充足一覧。 */
export function missingRequired(state: HostState): string[] {
  return validateRecord(state.app, state.record).missingRequired;
}
