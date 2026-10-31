import { describe, expect, it } from "vitest";
import { parseCsvText } from "../../../src/lib/csv/parser";
import { createCorrectionState, applyCellCorrection, undoCorrection, redoCorrection, discardAllCorrections } from "../../../src/lib/corrections/engine";
import { revalidateCorrectionSnapshot } from "../../../src/lib/corrections/revalidation";
import type { WhatIfConfiguration } from "../../../src/lib/corrections/what-if";

const rows = () => createCorrectionState([
  parseCsvText("id,name,department_id\n1,Ali,10\n2,Sara,20\n3,Ahmed,99\n3,Bilal,10", "students.csv"),
  parseCsvText("id,name\n10,Engineering\n20,Science", "departments.csv"),
]);
const id = (columns: string[]) => columns.map((source) => ({ source, target: source }));
const settings: WhatIfConfiguration = {
  mappings: { students: id(["id", "name", "department_id"]), departments: id(["id", "name"]) },
  rules: {
    students: { primaryKey: "id", required: ["name", "department_id"], types: {} },
    departments: { primaryKey: "id", required: ["name"], types: {} },
  },
  relationships: [{ childDataset: "students", childColumn: "department_id", parentDataset: "departments", parentColumn: "id" }],
};
const fixFk = { dataset: "students", rowNumber: 4, column: "department_id", expectedValue: "99", value: "20" };
const fixPk = { dataset: "students", rowNumber: 5, column: "id", expectedValue: "3", value: "4" };
const evaluate = (state: ReturnType<typeof rows>, config: WhatIfConfiguration = settings) => revalidateCorrectionSnapshot(state.current, config);

describe("Phase 8 S5 automatic snapshot verification", () => {
  it("uses the actual Phase 6 preflight and Phase 7 analytics", () => {
    const result = evaluate(rows());
    expect(result.report).toMatchObject({ status: "BLOCKED" });
    expect(result.analytics.summary).toMatchObject({ totalDatasets: 2, totalRecords: 6, validRows: 4, invalidRows: 2, blockingErrors: 3, totalIssues: 3 });
  });
  it("validates an approved FK edit as 2 errors but still 2 invalid rows", () => {
    const changed = applyCellCorrection(rows(), fixFk);
    expect(evaluate(changed).analytics.summary).toMatchObject({ blockingErrors: 2, invalidRows: 2, totalIssues: 2 });
  });
  it("validates two approved edits as READY rather than manufacturing a success", () => {
    const changed = applyCellCorrection(applyCellCorrection(rows(), fixFk), fixPk);
    expect(evaluate(changed).report.status).toBe("READY");
    expect(evaluate(changed).analytics.summary).toMatchObject({ totalRecords: 6, validRows: 6, invalidRows: 0, totalIssues: 0 });
  });
  it("undo revalidation restores actual error counts", () => {
    const changed = applyCellCorrection(rows(), fixFk);
    expect(evaluate(undoCorrection(changed)).report.totals.errors).toBe(3);
  });
  it("redo revalidation restores corrected counts", () => {
    const changed = applyCellCorrection(rows(), fixFk);
    expect(evaluate(redoCorrection(undoCorrection(changed))).report.totals.errors).toBe(2);
  });
  it("discard revalidation returns original results", () => {
    expect(evaluate(discardAllCorrections(applyCellCorrection(rows(), fixFk))).report.totals.errors).toBe(3);
  });
  it("does not mutate any original or corrected snapshot", () => {
    const state = applyCellCorrection(rows(), fixFk);
    const prev = JSON.stringify(state);
    evaluate(state);
    expect(JSON.stringify(state)).toBe(prev);
    expect(state.original[0].rows[2].department_id).toBe("99");
  });
  it("same state and config yields byte-identical report and analytics", () => {
    const state = rows();
    expect(JSON.stringify(evaluate(state))).toBe(JSON.stringify(evaluate(state)));
  });
  it("propagates CONFIG_ERROR without inventing valid/invalid row counts", () => {
    const invalid: WhatIfConfiguration = { ...settings, relationships: [{ childDataset: "students", childColumn: "department_id", parentDataset: "departments", parentColumn: "missing" }] };
    const result = evaluate(rows(), invalid);
    expect(result.report.status).toBe("CONFIG_ERROR");
    expect(result.analytics.summary.validRows).toBeNull();
    expect(result.analytics.summary.invalidRows).toBeNull();
  });
  it("fails closed on missing mappings", () => {
    expect(() => evaluate(rows(), { ...settings, mappings: { students: settings.mappings.students } })).toThrow(/Missing mapping/);
  });
  it("fails closed on malformed mappings rather than validating stale target columns", () => {
    expect(() => evaluate(rows(), { ...settings, mappings: { ...settings.mappings, students: [{ source: "missing", target: "x" }] } })).toThrow(/mapping/i);
  });
  it("does not change original row values when applying column mapping", () => {
    const state = rows();
    const custom: WhatIfConfiguration = {
      ...settings,
      mappings: { ...settings.mappings, students: id(["id", "name", "department_id"]).map((entry) => entry.source === "name" ? { ...entry, target: "full_name" } : entry) },
    };
    const changedRules: WhatIfConfiguration = { ...custom, rules: { ...settings.rules, students: { primaryKey: "id", required: ["full_name", "department_id"], types: {} } } };
    const result = evaluate(state, changedRules);
    expect(result.analytics.summary.totalRecords).toBe(6);
    expect(state.current[0].headers).toEqual(["id", "name", "department_id"]);
  });
  it("does not expose arbitrary raw CSV cell values in computed outputs", () => {
    const state = createCorrectionState([parseCsvText("id,name\n1,SECRET_PRIVATE_VALUE_XYZ\n1,Public", "private.csv")]);
    const result = revalidateCorrectionSnapshot(state.current, {
      mappings: { private: id(["id", "name"]) },
      rules: { private: { primaryKey: "id", required: [], types: {} } },
      relationships: [],
    });
    expect(JSON.stringify(result)).not.toContain("SECRET_PRIVATE_VALUE_XYZ");
  });
  it("refuses empty datasets instead of returning invented zero metrics", () => {
    expect(() => revalidateCorrectionSnapshot([], settings)).toThrow(/Upload CSV/);
  });
});
