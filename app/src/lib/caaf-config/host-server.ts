/**
 * CaaF gen-2 Config — 工具 host サーバー結線（M-E.1、server-only）
 *
 * LLM（IntentClassifier / Extractor）と DB（tools db Adapter）を結線し、純粋な会話エンジン
 * （host-turn.ts）に「判断」を委ねる薄いオーケストレータ。server を経由するのは外界 I/O を伴う
 * 2 操作だけ:
 *   - capture(text): Intent 分類 → (add のみ) 抽出 → item を read 解決 → 候補分岐
 *   - execute(state): confirmRecord → Core executeRecord → Adapter.write（append-only）
 *
 * rally の answer/skip/choose は純関数（host-turn.ts）で client 側に閉じる（server 不要）。
 *
 * 本ファイルは server-only チェーン（factories/llm/tools-adapter 経由）を含むため、
 * ユニットテストからは import しない。判断ロジックは host-turn.test.ts が純粋に固定する。
 */

import "server-only";

import type { CaaFWriteResult } from "@caaf/core";
import { intentNeedsExtraction } from "@caaf/core";
import { executeRecord } from "@caaf/core";
import { createExtractor, createIntentClassifier } from "./factories";
import {
  type HostState,
  applyExtractedRecord,
  applyItemCandidates,
  applySiteResolution,
  confirmForExecute,
  initialHostState,
  intentPhase,
} from "./host-turn";
import { createToolsAdapter } from "./tools-adapter";
import { toolsApp } from "./tools-app";
import { TOOLS_FIELD } from "./tools-fields";
import type { ItemCandidate, SiteCandidate } from "./tools-mapping";

/** 工具 host。ctx.movedBy = 入力者（D-7）。host（Server Action）が現在ユーザーで生成する。 */
export function createToolsHost(ctx: { movedBy: string }) {
  const classifyIntent = createIntentClassifier();
  const extract = createExtractor();
  const adapter = createToolsAdapter(ctx);

  /**
   * 現場名（pendingRefs.site）を read 解決して record.site に昇格する（M-E.3）。
   * 既に解決済み（record に site あり）なら何もしない。現場は item と独立に解決できる。
   */
  async function resolveSiteRef(state: HostState): Promise<HostState> {
    const siteName = state.pendingRefs.site;
    if (!siteName || state.record.fields[TOOLS_FIELD.site]) return state;
    const sites = (await adapter.read(state.app, {
      kind: "resolve-site",
      name: siteName,
    })) as SiteCandidate[];
    return applySiteResolution(state, sites);
  }

  return {
    /**
     * 1 発話を取り込む。Intent 分類 → add のみ抽出 → item を read 解決 → 候補分岐。
     * 返り値は次の HostState（client が保持）。
     */
    async capture(text: string, prev?: HostState): Promise<HostState> {
      const base = prev ?? initialHostState();

      const intent = await classifyIntent(text, {
        app: base.app,
        recentMessages: [],
        currentRecord: base.record,
      });

      // コスト分岐（FW spec §3/§6）: add 以外は抽出を回さない。
      if (!intentNeedsExtraction(intent.intent)) {
        if (intent.intent === "cancel") return intentPhase(base, "cancelled");
        if (intent.intent === "out_of_scope") return intentPhase(base, "out_of_scope");
        // correct/remove/execute/reroute はラリー中の純操作 or UI ボタンで扱う想定（M-E.2）。
        // ここでは状態据え置き（UI が次アクションを提示）。
        return base;
      }

      const extracted = await extract(text, toolsApp);
      const captured = applyExtractedRecord(base, extracted);
      if (!captured.itemName) {
        // 工具名が取れない → not_found 扱い（空候補で分岐）。
        return resolveSiteRef(captured);
      }

      const candidates = (await adapter.read(toolsApp, {
        kind: "resolve-item",
        name: captured.itemName,
      })) as ItemCandidate[];

      return resolveSiteRef(applyItemCandidates(captured, candidates));
    },

    /**
     * ready の record を append-only で書き込む（明示トリガー＝ユーザー確認）。
     * confirmRecord → Core guards → Adapter.write（M-C: 罠A/D-1/D-7/D-11/D-3）。
     */
    async execute(state: HostState): Promise<CaaFWriteResult> {
      const confirmed = confirmForExecute(state);
      const { result } = await executeRecord(state.app, confirmed, adapter);
      return result;
    },
  };
}

export type { HostState };
export { TOOLS_FIELD };
