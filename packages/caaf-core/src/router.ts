/**
 * CaaF Core — Router (FW spec §5, L0.5)
 *
 * App 未確定時、入力をどの App に流すか決定する。
 * Core は個別 App を知らず、注入された CaaFApp[] の routing だけで判定する（設計原則 1: Core純度）。
 *
 * スコアリング（LLM/キーワード）は分離し、確信度→決定の写像は純関数で行う。
 */

import type { CaaFApp } from "./types.js";

/** 1 App に対するルーティングスコア（0.0–1.0） */
export interface RouteScore {
  appId: string;
  score: number;
}

/** 確信度しきい値（FW spec §5） */
export interface RouteThresholds {
  /** これ以上で自動確定（「○○として記録」） */
  high: number;
  /** これ以上 high 未満で候補提示（「○○でいいですか？」） */
  mid: number;
}

export const DEFAULT_ROUTE_THRESHOLDS: RouteThresholds = { high: 0.8, mid: 0.6 };

export type RouteMode = "auto" | "candidate" | "fallback";

/** Router の判定結果（FW spec §5 の確信度分岐） */
export interface RouteDecision {
  mode: RouteMode;
  /** auto 時の確定 App、candidate 時の最有力 App */
  appId?: string;
  /** candidate 時のスコア降順候補（最有力を先頭に含む） */
  candidates?: RouteScore[];
}

/**
 * スコア群から Router 決定を導く純関数（FW spec §5）。
 *   最高スコア ≥ high → auto（自動確定）
 *   mid ≤ 最高 < high → candidate（候補提示 → 1 タップ確定）
 *   最高 < mid       → fallback（明示選択 UI へ）
 *
 * priority は同点時のタイブレークに使う（高 priority を優先）。
 */
export function routeByScores(
  scores: RouteScore[],
  apps: CaaFApp[],
  thresholds: RouteThresholds = DEFAULT_ROUTE_THRESHOLDS,
): RouteDecision {
  // 防御: 注入された scorer（LLM 等）が apps に存在しない appId を返しても、
  // 存在しない App を auto/candidate で確定しない。既知 App のスコアだけで判定する。
  const known = new Set(apps.map((a) => a.id));
  const valid = scores.filter((s) => known.has(s.appId));
  if (valid.length === 0) return { mode: "fallback" };

  const priorityOf = (appId: string): number =>
    apps.find((a) => a.id === appId)?.routing.priority ?? 0;

  const sorted = [...valid].sort(
    (a, b) => b.score - a.score || priorityOf(b.appId) - priorityOf(a.appId),
  );
  const top = sorted[0];
  if (!top) return { mode: "fallback" };

  if (top.score >= thresholds.high) {
    return { mode: "auto", appId: top.appId };
  }
  if (top.score >= thresholds.mid) {
    return { mode: "candidate", appId: top.appId, candidates: sorted };
  }
  return { mode: "fallback", candidates: sorted };
}

/**
 * キーワード一致による軽量スコアリング（LLM 不要のベースライン）。
 * routing.keywords のうち入力に含まれる比率を 0.0–1.0 で返す。
 * LLM スコアラと併用・代替できるよう純関数で提供する。
 */
export function keywordScores(input: string, apps: CaaFApp[]): RouteScore[] {
  const text = input.toLowerCase();
  return apps.map((app) => {
    const keywords = app.routing.keywords ?? [];
    if (keywords.length === 0) return { appId: app.id, score: 0 };
    const hits = keywords.filter((k) => text.includes(k.toLowerCase())).length;
    return { appId: app.id, score: hits / keywords.length };
  });
}

/** LLM ベースの Router スコアラ（実装は Config 側で注入。Core は SDK 非依存）。 */
export type RouterScorer = (input: string, apps: CaaFApp[]) => Promise<RouteScore[]>;
