import { describe, expect, it, vi } from "vitest";
import type { CaaFAdapter } from "../src/adapter.js";
import { CaaFExecuteBlockedError, confirmRecord, executeRecord } from "../src/execute.js";
import type { CaaFFieldValue, CaaFRecord } from "../src/types.js";
import { sampleApp } from "./fixtures.js";

const fv = (value: unknown): CaaFFieldValue => ({ value, confidence: 1, source: "user" });

function completeRecord(status: CaaFRecord["status"]): CaaFRecord {
  return {
    app: "sample",
    fields: { date: fv("2026-06-07"), amount: fv(1200), category: fv("a") },
    status,
  };
}

function fakeAdapter(): CaaFAdapter {
  return {
    id: "fake",
    getSchema: vi.fn(async () => sampleApp.schema),
    write: vi.fn(async () => ({ success: true, id: 42 })),
    read: vi.fn(async () => []),
  };
}

describe("executeRecord (FW §10.1 code-enforced guards)", () => {
  it("writes a confirmed, complete record and marks it executed", async () => {
    const adapter = fakeAdapter();
    const { result, record } = await executeRecord(sampleApp, completeRecord("confirmed"), adapter);
    expect(result.success).toBe(true);
    expect(record.status).toBe("executed");
    expect(adapter.write).toHaveBeenCalledOnce();
  });

  it("never calls write() when not confirmed (Don't #2/#3)", async () => {
    const adapter = fakeAdapter();
    await expect(executeRecord(sampleApp, completeRecord("mapped"), adapter)).rejects.toBeInstanceOf(
      CaaFExecuteBlockedError,
    );
    expect(adapter.write).not.toHaveBeenCalled();
  });

  it("strips schema-foreign fields before writing (Don't #1)", async () => {
    const adapter = fakeAdapter();
    const r = completeRecord("confirmed");
    r.fields.injected = fv("evil");
    await executeRecord(sampleApp, r, adapter);
    const writtenRecord = (adapter.write as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as
      | CaaFRecord
      | undefined;
    expect(writtenRecord && Object.keys(writtenRecord.fields)).not.toContain("injected");
  });

  it("confirmRecord flips status to confirmed", () => {
    expect(confirmRecord(completeRecord("mapped")).status).toBe("confirmed");
  });
});
