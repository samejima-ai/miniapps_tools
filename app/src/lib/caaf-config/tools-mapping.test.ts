import type { CaaFRecord } from "@caaf/core";
import { describe, expect, it } from "vitest";
import {
  type ResolvedUnit,
  type ToolsMovementInput,
  buildMovementRows,
  recordToMovementInput,
  resolveRequestedUnits,
} from "./tools-mapping";

function input(over: Partial<ToolsMovementInput> = {}): ToolsMovementInput {
  return {
    action: "checkout",
    itemId: "item-1",
    itemName: "バッテリー",
    units: [],
    quantity: null,
    projectId: null,
    holderId: null,
    movedBy: "user-A",
    confidence: 0.9,
    siteNote: null,
    ...over,
  };
}

const unit = (over: Partial<ResolvedUnit> = {}): ResolvedUnit => ({
  unitNumber: 1,
  unitId: "unit-1",
  currentHolderId: null,
  ...over,
});

describe("resolveRequestedUnits — 要求番号のマスタ突き合わせ（純）", () => {
  const avail: ResolvedUnit[] = [
    unit({ unitNumber: 1, unitId: "u1" }),
    unit({ unitNumber: 2, unitId: "u2", currentHolderId: "h1" }), // 持出中
    unit({ unitNumber: 3, unitId: "u3" }),
  ];

  it("存在する番号は resolved、無い番号は missing に分かれる", () => {
    const r = resolveRequestedUnits([1, 3, 9], avail);
    expect(r.resolved.map((u) => u.unitNumber)).toEqual([1, 3]);
    expect(r.missing).toEqual([9]);
    expect(r.alreadyOut).toEqual([]);
  });

  it("持出中（currentHolderId あり）は alreadyOut にも入る（resolved には残す）", () => {
    const r = resolveRequestedUnits([2, 3], avail);
    expect(r.resolved.map((u) => u.unitNumber)).toEqual([2, 3]);
    expect(r.alreadyOut.map((u) => u.unitNumber)).toEqual([2]);
  });

  it("空要求は全て空", () => {
    expect(resolveRequestedUnits([], avail)).toEqual({ resolved: [], missing: [], alreadyOut: [] });
  });

  it("重複番号は 1 度だけ解決する（重複 INSERT 防止）", () => {
    const r = resolveRequestedUnits([1, 1, 3, 3, 3], avail);
    expect(r.resolved.map((u) => u.unitNumber)).toEqual([1, 3]);
    expect(r.missing).toEqual([]);
  });
});

describe("buildMovementRows — FW Don't 担保", () => {
  it("D-1/罠A: 個体は 1 個体 1 行の INSERT、movement_type=action（状態書き換えなし）", () => {
    const { rows, errors } = buildMovementRows(
      input({
        units: [unit({ unitNumber: 2, unitId: "u2" }), unit({ unitNumber: 3, unitId: "u3" })],
      }),
    );
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.movementType === "checkout")).toBe(true);
    expect(rows.map((r) => r.unitId)).toEqual(["u2", "u3"]);
  });

  it("D-7: checkout は holder_id=保持者、moved_by=入力者（別カラム）。holder 明示時はそれを使う", () => {
    const { rows } = buildMovementRows(input({ holderId: "holder-X", units: [unit()] }));
    expect(rows[0]?.holderId).toBe("holder-X");
    expect(rows[0]?.movedBy).toBe("user-A");
  });

  it("D-7: holder 未指定の checkout は holder_id=movedBy にフォール（入力者本人が保持）", () => {
    const { rows } = buildMovementRows(input({ holderId: null, units: [unit()] }));
    expect(rows[0]?.holderId).toBe("user-A");
    expect(rows[0]?.movedBy).toBe("user-A");
  });

  it("D-7: return は holder_id=null（保持者から離れる）", () => {
    const { rows } = buildMovementRows(input({ action: "return", units: [unit()] }));
    expect(rows[0]?.holderId).toBeNull();
    expect(rows[0]?.movementType).toBe("return");
  });

  it("D-11: checkout で持出中（currentHolderId あり）の unit は二重持出として拒否（行を作らない）", () => {
    const { rows, errors } = buildMovementRows(
      input({
        units: [
          unit({
            unitNumber: 1,
            unitId: "u1",
            currentHolderId: "someone",
            currentHolderName: "大内",
          }),
          unit({ unitNumber: 2, unitId: "u2" }),
        ],
      }),
    );
    expect(rows.map((r) => r.unitId)).toEqual(["u2"]); // u1 は拒否
    expect(errors.join()).toContain("二重持出");
    expect(errors.join()).toContain("大内");
  });

  it("D-11: return は持出中でも拒否しない（返却は持出中の unit に対して行う）", () => {
    const { rows, errors } = buildMovementRows(
      input({ action: "return", units: [unit({ currentHolderId: "someone" })] }),
    );
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(1);
  });

  it("D-3: confidence は log 列にのみ載る（行生成の採否には影響しない）", () => {
    const low = buildMovementRows(input({ confidence: 0.01, units: [unit()] }));
    expect(low.rows).toHaveLength(1); // 低 confidence でも採否は変わらない
    expect(low.rows[0]?.confidence).toBe(0.01);
  });

  it("数量管理: 1 行（unitId=null, quantity 設定）", () => {
    const { rows, errors } = buildMovementRows(input({ quantity: 3 }));
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.unitId).toBeNull();
    expect(rows[0]?.quantity).toBe(3);
  });

  it("存在しない番号（unitId=null）はエラーにして行を作らない", () => {
    const { rows, errors } = buildMovementRows(input({ units: [unit({ unitId: null })] }));
    expect(rows).toEqual([]);
    expect(errors.join()).toContain("存在しません");
  });

  it("個体も数量も無ければエラー", () => {
    const { rows, errors } = buildMovementRows(input());
    expect(rows).toEqual([]);
    expect(errors.join()).toContain("番号または数量");
  });

  it("site があれば notes に現場名を載せる", () => {
    const { rows } = buildMovementRows(input({ siteNote: "池下現場", units: [unit()] }));
    expect(rows[0]?.notes).toBe("現場: 池下現場");
  });
});

describe("recordToMovementInput", () => {
  const record = (fields: CaaFRecord["fields"]): CaaFRecord => ({
    app: "tools",
    fields,
    status: "confirmed",
  });
  const fv = (value: unknown, confidence = 1) => ({ value, confidence, source: "user" as const });

  it("解決済み record を入力へ写像する（confidence は item field から log 用に拾う）", () => {
    const r = record({
      action: fv("checkout"),
      item: fv("item-9", 0.8),
      units: fv([{ unitNumber: 5, unitId: "u5", currentHolderId: null }]),
      site: fv("proj-1"),
      holder: fv("emp-2"),
    });
    const out = recordToMovementInput(r, { movedBy: "user-A", itemName: "丸ノコ" });
    expect(out.action).toBe("checkout");
    expect(out.itemId).toBe("item-9");
    expect(out.units).toHaveLength(1);
    expect(out.projectId).toBe("proj-1");
    expect(out.holderId).toBe("emp-2");
    expect(out.movedBy).toBe("user-A");
    expect(out.confidence).toBe(0.8);
  });

  it("action 未指定は checkout 既定、空 site/holder は null", () => {
    const out = recordToMovementInput(record({ item: fv("item-1"), quantity: fv(2) }), {
      movedBy: "u",
    });
    expect(out.action).toBe("checkout");
    expect(out.projectId).toBeNull();
    expect(out.holderId).toBeNull();
    expect(out.quantity).toBe(2);
  });

  it("非 string の item 値は itemId='' (未解決) として扱う（String 強制で write をすり抜けない）", () => {
    expect(recordToMovementInput(record({ item: fv({ id: "x" }) }), { movedBy: "u" }).itemId).toBe(
      "",
    );
    expect(recordToMovementInput(record({ item: fv(123) }), { movedBy: "u" }).itemId).toBe("");
  });
});
