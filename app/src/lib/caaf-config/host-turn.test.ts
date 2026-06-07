import type { CaaFFieldValue } from "@caaf/core";
import { describe, expect, it } from "vitest";
import {
  type HostState,
  answerField,
  applyExtractedRecord,
  applyItemCandidates,
  chooseCandidate,
  confirmForExecute,
  hostSignal,
  initialHostState,
  intentPhase,
  missingRequired,
  pendingField,
  recompute,
  summarize,
} from "./host-turn";
import { TOOLS_FIELD } from "./tools-fields";
import type { ItemCandidate, ResolvedUnit } from "./tools-mapping";

/** 抽出 field（source=ai）を素早く作る。 */
const ai = (value: unknown, confidence = 0.9): CaaFFieldValue => ({
  value,
  confidence,
  source: "ai",
});

const unit = (over: Partial<ResolvedUnit> = {}): ResolvedUnit => ({
  unitNumber: 1,
  unitId: "u1",
  currentHolderId: null,
  ...over,
});

const individualCandidate = (over: Partial<ItemCandidate> = {}): ItemCandidate => ({
  itemId: "item-batt",
  name: "バッテリー",
  trackingType: "individual",
  units: [unit({ unitNumber: 2, unitId: "u2" }), unit({ unitNumber: 3, unitId: "u3" })],
  ...over,
});

const quantityCandidate = (over: Partial<ItemCandidate> = {}): ItemCandidate => ({
  itemId: "item-glove",
  name: "軍手",
  trackingType: "quantity",
  units: [],
  ...over,
});

/** capture（抽出→候補解決）をテスト用に純合成する（server なし）。 */
function capture(
  extracted: Record<string, CaaFFieldValue>,
  candidates: ItemCandidate[],
): HostState {
  return applyItemCandidates(applyExtractedRecord(initialHostState(), extracted), candidates);
}

describe("initialHostState / recompute", () => {
  it("初期はベース toolsApp・空 record・idle", () => {
    const s = initialHostState();
    expect(s.app.id).toBe("tools");
    expect(s.phase).toBe("idle");
    expect(s.record.fields).toEqual({});
    expect(s.pendingRefs).toEqual({ site: null, holder: null });
  });
});

describe("applyExtractedRecord", () => {
  it("writable field（action/item/units）だけ record へ。site/holder は pendingRefs へ退避", () => {
    const s = applyExtractedRecord(initialHostState(), {
      [TOOLS_FIELD.action]: ai("checkout"),
      [TOOLS_FIELD.item]: ai("バッテリー"),
      [TOOLS_FIELD.units]: ai([2, 3]),
      [TOOLS_FIELD.site]: ai("池下"),
      [TOOLS_FIELD.holder]: ai("田中"),
    });
    expect(s.itemName).toBe("バッテリー");
    expect(s.record.fields[TOOLS_FIELD.site]).toBeUndefined(); // 未解決名を record に入れない
    expect(s.record.fields[TOOLS_FIELD.holder]).toBeUndefined();
    expect(s.pendingRefs).toEqual({ site: "池下", holder: "田中" });
    expect(s.phase).toBe("idle"); // 解決待ち
  });

  it("ユーザー確定値（source=user）は AI 抽出で上書きしない", () => {
    const base = initialHostState();
    base.record.fields[TOOLS_FIELD.item] = { value: "確定品", confidence: 1, source: "user" };
    const s = applyExtractedRecord(base, { [TOOLS_FIELD.item]: ai("別物") });
    expect(s.record.fields[TOOLS_FIELD.item]?.value).toBe("確定品");
  });
});

describe("applyItemCandidates 分岐", () => {
  it("0 件 → not_found + issue", () => {
    const s = capture({ [TOOLS_FIELD.item]: ai("謎工具") }, []);
    expect(s.phase).toBe("not_found");
    expect(s.signal).toBe("red");
    expect(s.issues[0]?.kind).toBe("not_found");
  });

  it("複数 → candidates（ユーザー選択待ち）", () => {
    const s = capture({ [TOOLS_FIELD.item]: ai("バ") }, [
      individualCandidate({ itemId: "a", name: "バッテリーA" }),
      individualCandidate({ itemId: "b", name: "バッテリーB" }),
    ]);
    expect(s.phase).toBe("candidates");
    expect(s.candidates).toHaveLength(2);
  });

  it("1 件（individual）→ tracking 切替 + units 解決 → rally（site 等は必須でないので ready 条件は units）", () => {
    const s = capture({ [TOOLS_FIELD.item]: ai("バッテリー"), [TOOLS_FIELD.units]: ai([2, 3]) }, [
      individualCandidate(),
    ]);
    // effective app は individual（quantity を schema から除外）
    expect(s.app.schema.some((f) => f.name === TOOLS_FIELD.quantity)).toBe(false);
    expect(s.record.fields[TOOLS_FIELD.item]?.value).toBe("item-batt");
    const units = s.record.fields[TOOLS_FIELD.units]?.value as ResolvedUnit[];
    expect(units.map((u) => u.unitNumber)).toEqual([2, 3]);
    expect(units.every((u) => typeof u.unitId === "string")).toBe(true);
    // action は default 充当 + item + units 充足 → ready
    expect(s.phase).toBe("ready");
  });

  it("1 件（individual）で番号無し → units 必須が未充足 → rally", () => {
    const s = capture({ [TOOLS_FIELD.item]: ai("バッテリー") }, [individualCandidate()]);
    expect(s.phase).toBe("rally");
    expect(pendingField(s)?.name).toBe(TOOLS_FIELD.units);
  });

  it("1 件（quantity）→ quantity 必須が未充足 → rally、回答で ready", () => {
    let s = capture({ [TOOLS_FIELD.item]: ai("軍手") }, [quantityCandidate()]);
    expect(s.app.schema.some((f) => f.name === TOOLS_FIELD.units)).toBe(false);
    expect(s.phase).toBe("rally");
    expect(pendingField(s)?.name).toBe(TOOLS_FIELD.quantity);
    s = answerField(s, TOOLS_FIELD.quantity, 5);
    expect(s.phase).toBe("ready");
  });
});

describe("units 解決 issue（missing / already_out）", () => {
  it("存在しない番号 → missing_units issue + red", () => {
    const s = capture(
      { [TOOLS_FIELD.item]: ai("バッテリー"), [TOOLS_FIELD.units]: ai([2, 9]) },
      [individualCandidate()], // 9 番は無い
    );
    const issue = s.issues.find((i) => i.kind === "missing_units");
    expect(issue?.message).toContain("9");
    expect(s.signal).toBe("red");
  });

  it("checkout で持出中番号 → already_out issue", () => {
    const s = capture(
      {
        [TOOLS_FIELD.action]: ai("checkout"),
        [TOOLS_FIELD.item]: ai("バッテリー"),
        [TOOLS_FIELD.units]: ai([2, 3]),
      },
      [
        individualCandidate({
          units: [
            unit({ unitNumber: 2, unitId: "u2", currentHolderId: "h1" }),
            unit({ unitNumber: 3, unitId: "u3" }),
          ],
        }),
      ],
    );
    expect(s.issues.some((i) => i.kind === "already_out")).toBe(true);
  });

  it("return では持出中でも already_out を立てない（返却は拒否しない）", () => {
    const s = capture(
      {
        [TOOLS_FIELD.action]: ai("return"),
        [TOOLS_FIELD.item]: ai("バッテリー"),
        [TOOLS_FIELD.units]: ai([2]),
      },
      [
        individualCandidate({
          units: [unit({ unitNumber: 2, unitId: "u2", currentHolderId: "h1" })],
        }),
      ],
    );
    expect(s.issues.some((i) => i.kind === "already_out")).toBe(false);
  });
});

describe("chooseCandidate（複数候補からの選択）", () => {
  it("選択で tracking 切替 + 解決 → ready/rally に進む", () => {
    const s = capture({ [TOOLS_FIELD.item]: ai("バ"), [TOOLS_FIELD.units]: ai([2]) }, [
      individualCandidate({ itemId: "a", name: "バッテリーA" }),
      individualCandidate({ itemId: "b", name: "バッテリーB" }),
    ]);
    const chosen = chooseCandidate(s, s.candidates[1] as ItemCandidate);
    expect(chosen.record.fields[TOOLS_FIELD.item]?.value).toBe("b");
    expect(chosen.record.fields[TOOLS_FIELD.item]?.source).toBe("user");
    expect(chosen.itemName).toBe("バッテリーB");
    expect(chosen.phase).toBe("ready");
  });
});

describe("rally answer / ready / confirm", () => {
  it("individual: 番号未指定 → rally → units 回答 → ready → confirm で status=confirmed", () => {
    let s = capture({ [TOOLS_FIELD.item]: ai("バッテリー") }, [individualCandidate()]);
    expect(s.phase).toBe("rally");
    s = answerField(s, TOOLS_FIELD.units, [unit({ unitNumber: 2, unitId: "u2" })]);
    expect(s.phase).toBe("ready");
    expect(missingRequired(s)).toEqual([]);
    const confirmed = confirmForExecute(s);
    expect(confirmed.status).toBe("confirmed");
  });

  it("ready record は item=id / units=ResolvedUnit[] の write 可能形になっている", () => {
    const s = capture({ [TOOLS_FIELD.item]: ai("バッテリー"), [TOOLS_FIELD.units]: ai([2]) }, [
      individualCandidate(),
    ]);
    expect(typeof s.record.fields[TOOLS_FIELD.item]?.value).toBe("string");
    expect(Array.isArray(s.record.fields[TOOLS_FIELD.units]?.value)).toBe(true);
    // 数量管理 field は individual record から除外済み（混在防止）
    expect(s.record.fields[TOOLS_FIELD.quantity]).toBeUndefined();
  });
});

describe("hostSignal overlay / summarize / intentPhase", () => {
  it("issue があれば red、無ければ Core recordSignal", () => {
    const s = capture(
      { [TOOLS_FIELD.item]: ai("バッテリー", 0.95), [TOOLS_FIELD.units]: ai([2]) },
      [individualCandidate()],
    );
    expect(s.issues).toHaveLength(0);
    expect(s.signal).not.toBe("red"); // 充足・高確信 → green/yellow
    const withIssue = hostSignal(s.app, s.record, [{ kind: "not_found", message: "x" }]);
    expect(withIssue).toBe("red");
  });

  it("summarize は工具名・番号・現場・操作を 1 行化", () => {
    const s = capture(
      {
        [TOOLS_FIELD.item]: ai("バッテリー"),
        [TOOLS_FIELD.units]: ai([2, 3]),
        [TOOLS_FIELD.site]: ai("池下"),
      },
      [individualCandidate()],
    );
    const line = summarize(s);
    expect(line).toContain("バッテリー");
    expect(line).toContain("#2");
    expect(line).toContain("池下");
    expect(line).toContain("持ち出し");
  });

  it("intentPhase: cancel → 初期化、out_of_scope → フェーズ遷移のみ", () => {
    const s = capture({ [TOOLS_FIELD.item]: ai("バッテリー"), [TOOLS_FIELD.units]: ai([2]) }, [
      individualCandidate(),
    ]);
    expect(intentPhase(s, "cancelled").record.fields).toEqual({});
    expect(intentPhase(s, "out_of_scope").phase).toBe("out_of_scope");
  });
});

describe("recompute は applyDefaults で action=checkout を充当", () => {
  it("action 未指定でも default で checkout", () => {
    const s = recompute(capture({ [TOOLS_FIELD.item]: ai("軍手") }, [quantityCandidate()]));
    expect(s.record.fields[TOOLS_FIELD.action]?.value).toBe("checkout");
  });
});

describe("signal の状態追従（Copilot #21: 直前 signal を残さない）", () => {
  it("applyExtractedRecord は新 record に基づき signal を再計算（古い green を残さない）", () => {
    const stale: HostState = { ...initialHostState(), signal: "green" };
    // 工具名のみ（action 未充足）→ 不完全 → red 寄り。少なくとも green のまま据え置きにしない。
    const s = applyExtractedRecord(stale, { [TOOLS_FIELD.item]: ai("バッテリー") });
    expect(s.phase).toBe("idle");
    expect(s.signal).toBe(hostSignal(s.app, s.record, []));
  });

  it("candidates 分岐も signal を record に追従させる", () => {
    const captured = applyExtractedRecord(
      { ...initialHostState(), signal: "green" },
      { [TOOLS_FIELD.item]: ai("バ") },
    );
    const s = applyItemCandidates(captured, [
      individualCandidate({ itemId: "a", name: "バッテリーA" }),
      individualCandidate({ itemId: "b", name: "バッテリーB" }),
    ]);
    expect(s.phase).toBe("candidates");
    expect(s.signal).toBe(hostSignal(s.app, s.record, []));
  });

  it("not_found: itemName が空文字でも「工具」にフォールバック（「」にしない）", () => {
    const captured = applyExtractedRecord(initialHostState(), { [TOOLS_FIELD.item]: ai("") });
    const s = applyItemCandidates(captured, []);
    expect(s.phase).toBe("not_found");
    expect(s.issues[0]?.message).toContain("工具");
    expect(s.issues[0]?.message).not.toContain("「」");
  });
});
