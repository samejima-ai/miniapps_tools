/**
 * CaaF Core — Execute (FW spec §3 L3 / §10.1)
 *
 * Adapter 経由で書き込む。明示トリガーのみ（呼び出し側がユーザー操作で confirmRecord 済みにする）。
 * 不可逆操作の保護（設計原則 5）: Guards を通過しない record は write しない。
 */

import type { CaaFAdapter, CaaFWriteResult } from "./adapter.js";
import { canExecute, sanitizeRecord } from "./guards.js";
import type { CaaFApp, CaaFRecord } from "./types.js";

/** record をユーザー確認済み（confirmed）にマークする純関数（設計原則 3）。 */
export function confirmRecord(record: CaaFRecord): CaaFRecord {
  return { ...record, status: "confirmed" };
}

export class CaaFExecuteBlockedError extends Error {
  readonly reasons: string[];
  constructor(reasons: string[], details: string[]) {
    super(`CaaF execute blocked: ${reasons.join(", ")}${details.length ? ` — ${details.join("; ")}` : ""}`);
    this.name = "CaaFExecuteBlockedError";
    this.reasons = reasons;
  }
}

/**
 * Guards を通過した record を Adapter.write へ渡す。
 * - schema 外フィールドを破棄（Don't #1）。
 * - canExecute が allowed=false なら CaaFExecuteBlockedError を投げ、write を呼ばない（Don't #2/#3）。
 * - 成功時は status を "executed" にした record も返す。
 */
export async function executeRecord(
  app: CaaFApp,
  record: CaaFRecord,
  adapter: CaaFAdapter,
): Promise<{ result: CaaFWriteResult; record: CaaFRecord }> {
  const clean = sanitizeRecord(app, record);
  const guard = canExecute(app, clean);
  if (!guard.allowed) {
    throw new CaaFExecuteBlockedError(guard.reasons, guard.details);
  }

  const result = await adapter.write(app, clean);
  const next: CaaFRecord = {
    ...clean,
    status: result.success ? "executed" : "error",
  };
  return { result, record: next };
}
