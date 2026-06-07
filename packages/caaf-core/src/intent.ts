/**
 * CaaF Core — Intent (FW spec §6, L0.3)
 *
 * App 確定中の全発話は、抽出（L1）の前に意図解析を通る。
 * 文脈（直近会話 + 現在の入力値）を軽量モデルに渡し分類する。
 * これで修正・削除・実行・種別変更・スコープ外を統一的に扱う。
 *
 * 原則: 分類のみ。値を作らない（設計原則 2: 抽出のみ・生成禁止）。
 * LLM 呼び出し自体はサーバー側（設計原則 4）。Core は分類器を「インターフェース」として受け取る。
 */

import type { CaaFApp, CaaFRecord } from "./types.js";

/** 意図種別（FW spec §6） */
export type Intent =
  | "add" // 新規入力・追記 → L1 抽出へ
  | "correct" // 既存値の修正（「〜を〜に直して」）
  | "remove" // 値の削除（「〜は無し」）
  | "execute" // 登録指示（「これで登録」）
  | "cancel" // 全リセット
  | "reroute" // 別種別と判明
  | "out_of_scope"; // App 範囲外の発話

/** intent ごとに L1 抽出を回すか（コスト効率: add のみ抽出。FW spec §3 / §6） */
export function intentNeedsExtraction(intent: Intent): boolean {
  return intent === "add";
}

/** Intent 解析の出力（FW spec §6） */
export interface IntentResult {
  intent: Intent;
  /** 対象 field（correct/remove 時）。不明なら undefined → 呼び出し側は add にフォール（§6 原則） */
  target?: string;
  /** 新値（ユーザー明示時のみ。生成禁止のため LLM が創作した値は入れない） */
  value?: unknown;
  reason?: string;
}

/** Intent 分類器に渡す文脈 */
export interface IntentContext {
  app: CaaFApp;
  /** 直近会話（古い→新しい順） */
  recentMessages: string[];
  /** 現在の入力値（埋まっている field の現状） */
  currentRecord: CaaFRecord | null;
}

/**
 * Intent 分類器（L0.3）。実装は利用者が Config 側（サーバー）で注入する。
 * 高速・軽量モデルを毎ターン呼ぶ役割。Core は LLM SDK に依存しない。
 */
export type IntentClassifier = (input: string, context: IntentContext) => Promise<IntentResult>;

/**
 * correct/remove で target が現スキーマに存在しない場合は add にフォールバックする（§6 原則）。
 * 分類器の出力を Core 側で正規化する純関数。
 */
export function normalizeIntent(result: IntentResult, app: CaaFApp): IntentResult {
  if (
    (result.intent === "correct" || result.intent === "remove") &&
    (!result.target || !app.schema.some((f) => f.name === result.target))
  ) {
    return { intent: "add", reason: result.reason ?? "target unresolved; fell back to add" };
  }
  return result;
}
