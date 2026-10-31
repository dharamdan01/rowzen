import { describe, expect, it } from "vitest";
import { parseCsvText } from "../../../src/lib/csv/parser";
import { createCorrectionState, applyCellCorrection, undoCorrection } from "../../../src/lib/corrections/engine";
import { revalidateCorrectionSnapshot } from "../../../src/lib/corrections/revalidation";
import { buildVerifiedCorrectionComparison } from "../../../src/lib/corrections/report-integration";
import type { WhatIfConfiguration } from "../../../src/lib/corrections/what-if";

const config: WhatIfConfiguration = {
  mappings: {
    students: ["id", "name", "department_id"].map((source) => ({ source, target: source })),
    departments: ["id", "name"].map((source) => ({ source, target: source })),
  },
  rules: { students: { primaryKey: "id", required: ["name", "department_id"], types: {} }, departments: { primaryKey: "id", required: ["name"], types: {} } },
  relationships: [{ childDataset: "students", childColumn: "department_id", parentDataset: "departments", parentColumn: "id" }],
};
function original() {
  return createCorrectionState([
    parseCsvText("id,name,department_id\n1,Ali,10\n2,Sara,20\n3,Ahmed,99\n3,Bilal,10", "students.csv"),
    parseCsvText("id,name\n10,Engineering\n20,Science", "departments.csv"),
  ]);
}
const editFK = { dataset: "students", rowNumber: 4, column: "department_id", value: "20" };
const editPK = { dataset: "students", rowNumber: 5, column: "id", value: "4" };
function compare(state: ReturnType<typeof original>) {
  return buildVerifiedCorrectionComparison(state, revalidateCorrectionSnapshot(state.current, config).report, config);
}

describe("Phase 8 S8 verified report integration", () => {
  it("shows no comparison when there are no net approved corrections", () => {
    expect(compare(original())).toBeNull();
  });
  it("compares original 3 issues and corrected 2 issues with identical rules", () => {
    const outcome = compare(applyCellCorrection(original(), editFK));
    expect(outcome).toMatchObject({ kind: "VERIFIED_APPROVED_CORRECTIONS", changedCells: 1, affectedRecords: 1, issueDelta: -1, original: { issueCount: 3 }, current: { issueCount: 2 } });
  });
  it("shows READY and 6 valid rows after both user approvals", () => {
    const state = applyCellCorrection(applyCellCorrection(original(), editFK), editPK);
    expect(compare(state)).toMatchObject({ changedCells: 2, affectedRecords: 2, current: { status: "READY", validRows: 6, invalidRows: 0, issueCount: 0 }, validRowDelta: 2 });
  });
  it("after undo only actual net edits appear", () => {
    const state = undoCorrection(applyCellCorrection(original(), editFK));
    expect(compare(state)).toBeNull();
  });
  it("does not reveal raw CSV values, issue messages or CSV line identifiers", () => {
    const compared = compare(applyCellCorrection(original(), editFK));
    expect(JSON.stringify(compared)).not.toMatch(/Ahmed|Engineering|99|department_id|rowNumber|originalValue|correctedValue|issues\s*:/);
  });
  it("returns distinct metrics when applying two edits to one physical row", () => {
    const one = applyCellCorrection(original(), editFK);
    const two = applyCellCorrection(one, { dataset: "students", rowNumber: 4, column: "name", value: "Ahmed updated" });
    expect(compare(two)).toMatchObject({ changedCells: 2, affectedRecords: 1 });
  });
  it("uses physical rows across datasets without merging affected records", () => {
    const one = applyCellCorrection(original(), editFK);
    const two = applyCellCorrection(one, { dataset: "departments", rowNumber: 2, column: "name", value: "Tech" });
    expect(compare(two)).toMatchObject({ changedCells: 2, affectedRecords: 2 });
  });
  it("propagates CONFIG_ERROR null validity instead of fabricating zero", () => {
    const broken = { ...config, relationships: [{ ...config.relationships[0], parentColumn: "missing" }] };
    const state = applyCellCorrection(original(), editFK);
    const verified = revalidateCorrectionSnapshot(state.current, broken).report;
    const result = buildVerifiedCorrectionComparison(state, verified, broken);
    expect(result).toMatchObject({ original: { status: "CONFIG_ERROR", validRows: null, invalidRows: null }, current: { validRows: null, invalidRows: null }, validRowDelta: null });
  });
});
