import { describe, expect, it } from "vitest";
import { validationRunSchema } from "../../src/lib/services/schemas";

const base = { totalRows: 6, validRows: 4, invalidRows: 2, issueCount: 3 };
const accept = (payload: unknown) => validationRunSchema.safeParse(payload).success;

describe("validation run API schema (summary only)", () => {
  it("accepts READY without findings", () => {
    expect(accept({ ...base, status: "READY", validRows: 6, invalidRows: 0, issueCount: 0 })).toBe(true);
  });
  it("accepts BLOCKED with reported issues", () => {
    expect(accept({ ...base, status: "BLOCKED" })).toBe(true);
  });
  it("accepts READY_WITH_WARNINGS with at least one warning", () => {
    expect(accept({ ...base, status: "READY_WITH_WARNINGS", validRows: 6, invalidRows: 0, issueCount: 1 })).toBe(true);
  });
  it("accepts CONFIG_ERROR only with unknown row validity", () => {
    expect(accept({ status: "CONFIG_ERROR", totalRows: 6, validRows: null, invalidRows: null, issueCount: 1 })).toBe(true);
  });
  it("rejects fabricated zeros for a configuration error", () => {
    expect(accept({ status: "CONFIG_ERROR", totalRows: 6, validRows: 0, invalidRows: 0, issueCount: 1 })).toBe(false);
  });
  it("rejects null counts for evaluated statuses", () => {
    expect(accept({ status: "BLOCKED", totalRows: 6, validRows: null, invalidRows: null, issueCount: 1 })).toBe(false);
  });
  it("rejects totals inconsistent with row counts", () => {
    expect(accept({ ...base, status: "BLOCKED", totalRows: 7 })).toBe(false);
  });
  it("rejects inconsistent readiness status and issue count", () => {
    expect(accept({ ...base, status: "READY" })).toBe(false);
    expect(accept({ ...base, status: "READY_WITH_WARNINGS", issueCount: 0 })).toBe(false);
    expect(accept({ ...base, status: "BLOCKED", issueCount: 0 })).toBe(false);
  });
  it("rejects missing findings for CONFIG_ERROR", () => {
    expect(accept({ status: "CONFIG_ERROR", totalRows: 6, validRows: null, invalidRows: null, issueCount: 0 })).toBe(false);
  });
  it("rejects unexpected CSV content in POST body", () => {
    expect(accept({ ...base, status: "BLOCKED", rawCsv: "1,Ada,999" })).toBe(false);
    expect(accept({ ...base, status: "BLOCKED", issues: [] })).toBe(false);
  });
  it("rejects negative and fractional counts", () => {
    expect(accept({ ...base, status: "BLOCKED", totalRows: -1 })).toBe(false);
    expect(accept({ ...base, status: "BLOCKED", issueCount: 1.5 })).toBe(false);
  });
});
