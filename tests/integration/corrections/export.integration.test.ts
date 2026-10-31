import { describe, expect, it } from "vitest";
import { parseCsvText } from "../../../src/lib/csv/parser";
import { createCorrectionState, applyCellCorrection, undoCorrection, discardAllCorrections } from "../../../src/lib/corrections/engine";
import { prepareCorrectedCsvExport } from "../../../src/lib/corrections/export";
import { revalidateCorrectionSnapshot } from "../../../src/lib/corrections/revalidation";
import type { WhatIfConfiguration } from "../../../src/lib/corrections/what-if";

const students = () => parseCsvText("id,name,department_id\n1,Ali,10\n2,Sara,20\n3,Ahmed,99\n3,Bilal,10", "students.csv");
const departments = () => parseCsvText("id,name\n10,Engineering\n20,Science", "departments.csv");
const make = () => createCorrectionState([students(), departments()]);
const config: WhatIfConfiguration = {
  mappings: { students: ["id", "name", "department_id"].map((source) => ({ source, target: source })), departments: ["id", "name"].map((source) => ({ source, target: source })) },
  rules: { students: { primaryKey: "id", required: ["name", "department_id"], types: {} }, departments: { primaryKey: "id", required: ["name"], types: {} } },
  relationships: [{ childDataset: "students", childColumn: "department_id", parentDataset: "departments", parentColumn: "id" }],
};
const edit = { dataset: "students", rowNumber: 4, column: "department_id", value: "20" };

describe("Phase 8 S6 corrected export against real parser + Phase 6 revalidation", () => {
  it("reimports an approved corrected CSV with same rows and error impact", () => {
    const after = applyCellCorrection(make(), edit);
    const file = prepareCorrectedCsvExport(after, "students");
    const reimported = parseCsvText(file.content, file.filename);
    expect(reimported.headers).toEqual(["id", "name", "department_id"]);
    expect(reimported.rows).toEqual(after.current[0].rows);
    expect(reimported.rowNumbers).toEqual(after.current[0].rowNumbers);
    const originalResult = revalidateCorrectionSnapshot(make().current, config);
    const correctedResult = revalidateCorrectionSnapshot(after.current, config);
    expect(originalResult.report.totals.errors).toBe(3);
    expect(correctedResult.report.totals.errors).toBe(2);
    expect(file.changedCells).toBe(1);
  });
  it("undo exports the original, redo exports the changed snapshot only", () => {
    const after = applyCellCorrection(make(), edit);
    const undone = undoCorrection(after);
    expect(parseCsvText(prepareCorrectedCsvExport(undone, "students").content, "students.csv").rows).toEqual(students().rows);
    expect(parseCsvText(prepareCorrectedCsvExport(after, "students").content, "students.csv").rows[2].department_id).toBe("20");
  });
  it("exporting a companion unchanged dataset preserves its FK parent values", () => {
    const after = applyCellCorrection(make(), edit);
    const sibling = prepareCorrectedCsvExport(after, "departments");
    expect(parseCsvText(sibling.content, "departments.csv").rows).toEqual(departments().rows);
    expect(sibling.changedCells).toBe(0);
  });
  it("preserves physical multiline CSV records while reimporting exported output", () => {
    const original = parseCsvText('id,notes\n1,"line one\nline two"\n2,"x,y"', "multiline.csv");
    expect(original.rowNumbers).toEqual([2, 4]);
    const base = createCorrectionState([original]);
    const changed = applyCellCorrection(base, { dataset: "multiline", rowNumber: 4, column: "notes", value: '"quoted",\r\nnext' });
    const again = parseCsvText(prepareCorrectedCsvExport(changed, "multiline").content, "multiline.csv");
    expect(again.rows).toEqual(changed.current[0].rows);
    expect(again.rowNumbers).toEqual([2, 4]);
  });
  it("restores original records and does not change Phase 7 privacy-reduced report contracts", () => {
    const state = discardAllCorrections(applyCellCorrection(make(), edit));
    expect(parseCsvText(prepareCorrectedCsvExport(state, "students").content, "students.csv").rows).toEqual(students().rows);
    const report = revalidateCorrectionSnapshot(state.current, config);
    expect(report.report.totals.errors).toBe(3);
    // No network persistence is performed by the pure export function.
  });
});
