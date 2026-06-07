"use server";

/**
 * CaaF gen-2 host — Server Actions（M-E.2）
 *
 * 外界 I/O を伴う 2 操作だけを Server Action として公開する:
 *  - captureAction: 1 発話の取込（Intent 分類 → 抽出 → item read 解決）
 *  - executeAction: ready record の append-only 書き込み（confirm → executeRecord → write）
 *
 * rally の answer/skip/choose は純関数（`@/lib/caaf-config`）で client 側に閉じる（server 往復ゼロ）。
 * gen-1（`/input`）には一切触れない新規ルート。movedBy = 入力者（D-7）を client から受け取る。
 */

import type { HostState } from "@/lib/caaf-config";
import { createToolsHost } from "@/lib/caaf-config/server";
import type { CaaFWriteResult } from "@caaf/core";

export async function captureAction(
  movedBy: string,
  text: string,
  prev: HostState | null,
): Promise<HostState> {
  const host = createToolsHost({ movedBy });
  return host.capture(text, prev ?? undefined);
}

export async function executeAction(movedBy: string, state: HostState): Promise<CaaFWriteResult> {
  const host = createToolsHost({ movedBy });
  return host.execute(state);
}
