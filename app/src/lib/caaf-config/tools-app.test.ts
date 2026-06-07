import type { CaaFFieldValue, CaaFRecord } from "@caaf/core";
import {
  applyAnswer,
  applyDefaults,
  isComplete,
  keywordScores,
  nextRequiredField,
  routeByScores,
  validateRecord,
} from "@caaf/core";
import { describe, expect, it } from "vitest";
import { type ToolsTracking, toolsApp, toolsAppForTracking } from "./tools-app";
import { TOOLS_FIELD } from "./tools-fields";

/** confidence=1 / source=user の確定値（テスト用ヘルパ）。 */
const v = (value: unknown): CaaFFieldValue => ({ value, confidence: 1, source: "user" });

/** draft record を field 値マップから組む。 */
function record(fields: Record<string, unknown>): CaaFRecord {
  const out: CaaFRecord = { app: toolsApp.id, fields: {}, status: "draft" };
  for (const [k, val] of Object.entries(fields)) out.fields[k] = v(val);
  return out;
}

const fieldNames = (tracking: ToolsTracking) =>
  toolsAppForTracking(tracking).schema.map((f) => f.name);
const fieldByName = (tracking: ToolsTracking, name: string) =>
  toolsAppForTracking(tracking).schema.find((f) => f.name === name);

describe("toolsApp 定義（M-D / migration §3）", () => {
  it("Core に注入する最低限の形を満たす", () => {
    expect(toolsApp.id).toBe("tools");
    expect(toolsApp.name).toBe("工具入力");
    expect(toolsApp.adapter.type).toBe("db");
    expect(toolsApp.adapter.config.schema).toBe("miniapps_tools");
    expect(toolsApp.context.role.length).toBeGreaterThan(0);
    expect(toolsApp.context.examples?.length ?? 0).toBeGreaterThan(0);
    expect(toolsApp.routing.priority).toBe(1);
    expect(toolsApp.routing.description.length).toBeGreaterThan(0);
  });

  it("ベース schema は M-C の TOOLS_FIELDS をそのまま使う（action 必須+default, item 必須, units/quantity は optional）", () => {
    const action = toolsApp.schema.find((f) => f.name === TOOLS_FIELD.action);
    const item = toolsApp.schema.find((f) => f.name === TOOLS_FIELD.item);
    const units = toolsApp.schema.find((f) => f.name === TOOLS_FIELD.units);
    const quantity = toolsApp.schema.find((f) => f.name === TOOLS_FIELD.quantity);
    expect(action?.required).toBe(true);
    expect(action?.default).toBe("checkout");
    expect(item?.required).toBe(true);
    expect(item?.type).toBe("reference");
    // tracking 未確定では両方 optional（item 解決後に overlay で確定する）
    expect(units?.required).toBe(false);
    expect(quantity?.required).toBe(false);
  });

  it("dont に D-5（曖昧展開禁止）と D-11（二重持出）の制約を含む", () => {
    const joined = toolsApp.dont.join("\n");
    expect(joined).toContain("全返却");
    expect(joined).toContain("二重持出");
  });
});

describe("toolsAppForTracking — tracking_type 条件付き必須 overlay", () => {
  it("individual: units を required 化、quantity は schema から除外", () => {
    expect(fieldNames("individual")).toContain(TOOLS_FIELD.units);
    expect(fieldNames("individual")).not.toContain(TOOLS_FIELD.quantity);
    expect(fieldByName("individual", TOOLS_FIELD.units)?.required).toBe(true);
  });

  it("quantity: quantity を required 化、units は schema から除外", () => {
    expect(fieldNames("quantity")).toContain(TOOLS_FIELD.quantity);
    expect(fieldNames("quantity")).not.toContain(TOOLS_FIELD.units);
    expect(fieldByName("quantity", TOOLS_FIELD.quantity)?.required).toBe(true);
  });

  it("他フィールド（action/item/site/holder）の required・default は不変", () => {
    for (const t of ["individual", "quantity"] as const) {
      expect(fieldByName(t, TOOLS_FIELD.action)?.required).toBe(true);
      expect(fieldByName(t, TOOLS_FIELD.action)?.default).toBe("checkout");
      expect(fieldByName(t, TOOLS_FIELD.item)?.required).toBe(true);
      expect(fieldByName(t, TOOLS_FIELD.site)?.required).toBe(false);
      expect(fieldByName(t, TOOLS_FIELD.holder)?.required).toBe(false);
    }
  });

  it("ベース toolsApp は変更しない（純関数・新オブジェクトを返す）", () => {
    toolsAppForTracking("individual");
    expect(toolsApp.schema.map((f) => f.name)).toContain(TOOLS_FIELD.quantity);
    expect(toolsApp.schema.find((f) => f.name === TOOLS_FIELD.units)?.required).toBe(false);
  });
});

describe("schema 駆動 Resolver ラリー（M-D 完了条件）", () => {
  it("個体管理: item 解決済・units 未充足 → 次に units を尋ね、回答で完了する", () => {
    const app = toolsAppForTracking("individual");
    // action は default 充当（applyDefaults）、item は解決済 id
    let rec = applyDefaults(app, record({ [TOOLS_FIELD.item]: "item-1" }));
    expect(rec.fields[TOOLS_FIELD.action]?.value).toBe("checkout");

    // units が未充足の必須として残る
    expect(nextRequiredField(app, rec)?.name).toBe(TOOLS_FIELD.units);
    expect(isComplete(app, rec)).toBe(false);

    // units を回答 → 完了
    rec = applyAnswer(rec, TOOLS_FIELD.units, [
      { unitNumber: 1, unitId: "u1", currentHolderId: null },
    ]);
    expect(nextRequiredField(app, rec)).toBeNull();
    expect(isComplete(app, rec)).toBe(true);
  });

  it("数量管理: quantity 未充足 → 次に quantity を尋ね、回答で完了する", () => {
    const app = toolsAppForTracking("quantity");
    let rec = applyDefaults(app, record({ [TOOLS_FIELD.item]: "item-2" }));
    expect(nextRequiredField(app, rec)?.name).toBe(TOOLS_FIELD.quantity);
    expect(isComplete(app, rec)).toBe(false);

    rec = applyAnswer(rec, TOOLS_FIELD.quantity, 5);
    expect(nextRequiredField(app, rec)).toBeNull();
    expect(isComplete(app, rec)).toBe(true);
  });

  it("item 未解決時はベース app で item を先に尋ねる（units/quantity は必須にならない）", () => {
    const rec = applyDefaults(toolsApp, record({}));
    // action は default 充当済 → 次の必須は item
    expect(nextRequiredField(toolsApp, rec)?.name).toBe(TOOLS_FIELD.item);
    // ベースでは units/quantity は未充足でも missingRequired に入らない
    expect(validateRecord(toolsApp, rec).missingRequired).not.toContain(TOOLS_FIELD.units);
    expect(validateRecord(toolsApp, rec).missingRequired).not.toContain(TOOLS_FIELD.quantity);
  });

  it("個体管理で units を空のまま確定しようとしても isComplete=false（必須未充足では write しない: Don't #2）", () => {
    const app = toolsAppForTracking("individual");
    const rec = applyDefaults(app, record({ [TOOLS_FIELD.item]: "item-1" }));
    expect(validateRecord(app, rec).missingRequired).toContain(TOOLS_FIELD.units);
  });
});

describe("Router 連携（keywordScores / routeByScores）", () => {
  // 注: keyword 一致は粗いベースライン（hits/keywords）。単一 App 運用では実際には
  // LLM スコアラを使う想定（migration §1: Router 点灯は 2 App 目登場時）。ここでは
  // tools の routing が機能する（語に反応し、誤確定しない）ことを確認する。
  it("keywordScores: 工具語は正のスコア / 無関係語は 0", () => {
    const tooling = keywordScores("工具を現場へ持ち出し、返却もある", [toolsApp]);
    expect(tooling.find((s) => s.appId === "tools")?.score ?? 0).toBeGreaterThan(0);
    const unrelated = keywordScores("今日の天気はどう", [toolsApp]);
    expect(unrelated.find((s) => s.appId === "tools")?.score ?? 0).toBe(0);
  });

  it("routeByScores: 高スコアは tools を auto 確定する", () => {
    const decision = routeByScores([{ appId: "tools", score: 0.9 }], [toolsApp]);
    expect(decision.mode).toBe("auto");
    expect(decision.appId).toBe("tools");
  });

  it("routeByScores: スコア 0（無関係）は fallback で誤確定しない", () => {
    const decision = routeByScores([{ appId: "tools", score: 0 }], [toolsApp]);
    expect(decision.mode).toBe("fallback");
    expect(decision.appId).toBeUndefined();
  });
});
