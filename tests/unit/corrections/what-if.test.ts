import { describe, expect, it } from "vitest";
import { parseCsvText } from "../../../src/lib/csv/parser";
import { applyCellCorrection, createCorrectionState, undoCorrection } from "../../../src/lib/corrections/engine";
import { previewCellCorrection } from "../../../src/lib/corrections/what-if";
import type { WhatIfConfiguration } from "../../../src/lib/corrections/what-if";

function fixture() {
  return createCorrectionState([
    parseCsvText("id,name,department_id\n1,Ali,10\n2,Sara,20\n3,Ahmed,99\n3,Bilal,10", "students.csv"),
    parseCsvText("id,name\n10,Engineering\n20,Science", "departments.csv"),
  ]);
}
const mappings = {
  students: ["id", "name", "department_id"].map((source) => ({ source, target: source })),
  departments: ["id", "name"].map((source) => ({ source, target: source })),
};
const config: WhatIfConfiguration = {
  mappings,
  rules: {
    students: { primaryKey: "id", required: ["name", "department_id"], types: {} },
    departments: { primaryKey: "id", required: ["name"], types: {} },
  },
  relationships: [{ childDataset: "students", childColumn: "department_id", parentDataset: "departments", parentColumn: "id" }],
};
const fk = { dataset: "students", rowNumber: 4, column: "department_id", expectedValue: "99", value: "20" };

// Unit contract tests exercise the public pure boundary with the real validators.
describe("Phase 8 S4 deterministic what-if preview", () => {
  it("reuses real findings: 3→2 errors but 2 invalid rows remain", () => {
    const p = previewCellCorrection(fixture(), fk, config);
    expect(p.kind).toBe("PREDICTED_NOT_APPLIED");
    expect(p.before).toMatchObject({ status: "BLOCKED", totalRecords: 6, validRows: 4, invalidRows: 2, blockingErrors: 3, totalIssues: 3 });
    expect(p.predicted).toMatchObject({ status: "BLOCKED", totalRecords: 6, validRows: 4, invalidRows: 2, blockingErrors: 2, totalIssues: 2 });
    expect(p.difference).toMatchObject({ invalidRows: 0, blockingErrors: -1, totalIssues: -1 });
  });
  it("does not modify source rows, arrays or undo stack", () => {
    const state = fixture();
    const original = JSON.stringify(state);
    previewCellCorrection(state, fk, config);
    expect(JSON.stringify(state)).toBe(original);
    expect(state.current[0].rows[2].department_id).toBe("99");
    expect(state.undoStack).toHaveLength(0);
    expect(state.redoStack).toHaveLength(0);
    expect(state.nextSequence).toBe(1);
  });
  it("never approves proposed correction implicitly", () => {
    const state = fixture();
    previewCellCorrection(state, fk, config);
    expect(state.current).toBe(state.original);
  });
  it("is byte-for-byte deterministic on same state, edit and config", () => {
    const state = fixture();
    expect(JSON.stringify(previewCellCorrection(state, fk, config))).toBe(JSON.stringify(previewCellCorrection(state, fk, config)));
  });
  it("predicts READY after actual earlier correction and a second proposed fix", () => {
    const state = applyCellCorrection(fixture(), fk);
    const p = previewCellCorrection(state, { dataset: "students", rowNumber: 5, column: "id", expectedValue: "3", value: "4" }, config);
    expect(p.predicted).toMatchObject({ status: "READY", totalRecords: 6, validRows: 6, invalidRows: 0, totalIssues: 0 });
    expect(p.resolvedIssueCount).toBe(2);
    expect(state.undoStack).toHaveLength(1);
  });
  it("predicts new problems (worse state) without changing current", () => {
    const state = fixture();
    const p = previewCellCorrection(state, { dataset: "students", rowNumber: 2, column: "department_id", expectedValue: "10", value: "999" }, config);
    expect(p.predicted.totalIssues).toBe(4);
    expect(p.introducedIssueCount).toBe(1);
    expect(state.current[0].rows[0].department_id).toBe("10");
  });
  it("rejects stale expected values rather than previewing a different edit", () => {
    expect(() => previewCellCorrection(fixture(), { ...fk, expectedValue: "old" }, config)).toThrow(/changed since editing began/i);
  });
  it("rejects no-op preview rather than showing invented deltas", () => {
    expect(() => previewCellCorrection(fixture(), { ...fk, value: "99" }, config)).toThrow(/Change the proposed value/i);
  });
  it("rejects an unknown physical CSV row", () => {
    expect(() => previewCellCorrection(fixture(), { ...fk, rowNumber: 300 }, config)).toThrow(/physical CSV line/i);
  });
  it("rejects an unknown source column", () => {
    expect(() => previewCellCorrection(fixture(), { ...fk, column: "missing" }, config)).toThrow(/Column/i);
  });
  it("rejects an unknown dataset", () => {
    expect(() => previewCellCorrection(fixture(), { ...fk, dataset: "elsewhere" }, config)).toThrow(/Dataset/i);
  });
  it("fails closed on invalid mapping", () => {
    expect(() => previewCellCorrection(fixture(), fk, { ...config, mappings: { ...mappings, students: [{ source: "missing", target: "x" }] } })).toThrow(/mapping/i);
  });
  it("fails closed on missing mapping", () => {
    expect(() => previewCellCorrection(fixture(), fk, { ...config, mappings: { students: mappings.students } })).toThrow(/Missing mapping/);
  });
  it("keeps CONFIG_ERROR validity unknown without inventing zeros", () => {
    const bad: WhatIfConfiguration = { ...config, relationships: [{ childDataset: "students", childColumn: "department_id", parentDataset: "departments", parentColumn: "does_not_exist" }] };
    const p = previewCellCorrection(fixture(), fk, bad);
    expect(p.before.status).toBe("CONFIG_ERROR");
    expect(p.predicted.status).toBe("CONFIG_ERROR");
    expect(p.predicted.validRows).toBeNull();
    expect(p.predicted.invalidRows).toBeNull();
    expect(p.difference.validRows).toBeNull();
    expect(p.difference.invalidRows).toBeNull();
  });
  it("does not serialize arbitrary source cell values", () => {
    const state = createCorrectionState([parseCsvText("id,name\n1,PRIVATE_CLIENT_SECRET_XYZ\n1,Changed", "secret.csv")]);
    const single: WhatIfConfiguration = {
      mappings: { secret: [{ source: "id", target: "id" }, { source: "name", target: "name" }] },
      rules: { secret: { primaryKey: "id", required: [], types: {} } }, relationships: [],
    };
    const result = previewCellCorrection(state, { dataset: "secret", rowNumber: 3, column: "id", value: "2" }, single);
    expect(JSON.stringify(result)).not.toContain("PRIVATE_CLIENT_SECRET_XYZ");
    expect(JSON.stringify(result)).not.toContain("Changed");
    expect(JSON.stringify(result)).not.toContain("secret.csv");
  });
  it("does not modify earlier corrections or redo after undo", () => {
    const applied = applyCellCorrection(fixture(), fk);
    const state = undoCorrection(applied);
    const before = JSON.stringify(state);
    const result = previewCellCorrection(state, fk, config);
    expect(result.predicted.totalIssues).toBe(2);
    expect(JSON.stringify(state)).toBe(before);
    expect(state.redoStack).toHaveLength(1);
  });
});
