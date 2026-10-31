import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { parseCsvText } from "../../../src/lib/csv/parser";
import { applyCellCorrection, createCorrectionState, getEffectiveCorrections, undoCorrection, redoCorrection } from "../../../src/lib/corrections/engine";
import { applyMapping, identityMapping } from "../../../src/lib/rehearsal/mapping";
import { runPreflight } from "../../../src/lib/rehearsal/preflight";
import { buildReportAnalytics } from "../../../src/lib/reports/analytics";
import CorrectionWorkspace from "../../../src/components/corrections/correction-workspace";

const students = parseCsvText("id,name,department_id\n1,Ali,10\n2,Sara,20\n3,Ahmed,99\n3,Bilal,10", "students.csv");
const departments = parseCsvText("id,name\n10,Engineering\n20,Science", "departments.csv");
const mappings = Object.fromEntries([students, departments].map((item) => [item.name, identityMapping(item.headers)]));
const rules = {
  students: { primaryKey: "id", required: ["name", "department_id"], types: {} },
  departments: { primaryKey: "id", required: ["name"], types: {} },
};
const relationships = [{ childDataset: "students", childColumn: "department_id", parentDataset: "departments", parentColumn: "id" }];
function validate(data: readonly typeof students[]) {
  const mapped = data.map((ds) => applyMapping(ds, mappings[ds.name]));
  const report = runPreflight({ datasets: mapped, rules, relationships });
  return { report, analytics: buildReportAnalytics(report, mapped) };
}
function markup(state: ReturnType<typeof createCorrectionState>, issues: ReturnType<typeof validate>["report"]["issues"]) {
  return renderToStaticMarkup(createElement(CorrectionWorkspace, {
    state, issues, mappings,
    onApprove: () => {}, onUndo: () => {}, onRedo: () => {}, onDiscard: () => {},
  }));
}

describe("Phase 8 S2 corrected source => existing Phase 6/7 pipeline", () => {
  it("starts with genuine issues in the editable row table", () => {
    const state = createCorrectionState([students, departments]);
    const baseline = validate(state.current);
    expect(baseline.analytics.summary).toMatchObject({ totalRecords: 6, validRows: 4, invalidRows: 2, blockingErrors: 3 });
    const view = markup(state, baseline.report.issues);
    expect(view).toContain("FK_NOT_FOUND");
    expect(view).toContain("DUPLICATE_PK");
    expect(view).toContain("line 4 column department_id");
  });
  it("keeps approved edits local until explicitly revalidated and then derives actual results", () => {
    const original = createCorrectionState([students, departments]);
    const before = validate(original.current);
    const corrected = applyCellCorrection(original, { dataset: "students", rowNumber: 4, column: "department_id", expectedValue: "99", value: "20" });
    expect(before.analytics.summary.blockingErrors).toBe(3);
    expect(getEffectiveCorrections(corrected)).toHaveLength(1);
    const after = validate(corrected.current);
    expect(after.analytics.summary.blockingErrors).toBe(2);
    expect(after.analytics.summary.invalidRows).toBe(2);
    expect(original.current[0].rows[2].department_id).toBe("99");
  });
  it("remapping corrected source values follows the same pre-existing Phase 6 rules", () => {
    const state = applyCellCorrection(createCorrectionState([students]), { dataset: "students", rowNumber: 4, column: "name", value: "Ahmed Revised" });
    const mapping = identityMapping(students.headers).map((col) => col.source === "name" ? { ...col, target: "full_name" } : col);
    const mapped = applyMapping(state.current[0], mapping);
    expect(mapped.rows[2].full_name).toBe("Ahmed Revised");
    expect(state.original[0].headers).toEqual(["id", "name", "department_id"]);
  });
  it("undo and redo preserve the original report and real issue counts", () => {
    const initial = createCorrectionState([students, departments]);
    const changed = applyCellCorrection(initial, { dataset: "students", rowNumber: 4, column: "department_id", value: "20" });
    const undone = undoCorrection(changed);
    const redone = redoCorrection(undone);
    expect(validate(undone.current).report.totals.errors).toBe(3);
    expect(validate(redone.current).report.totals.errors).toBe(2);
    expect(validate(initial.current).report.totals.errors).toBe(3);
  });
});
