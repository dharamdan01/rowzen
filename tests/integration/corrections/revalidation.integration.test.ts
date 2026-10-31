import { describe, it, expect } from "vitest";
import { parseCsvText } from "../../../src/lib/csv/parser";
import { applyCellCorrection, createCorrectionState, undoCorrection, redoCorrection, discardAllCorrections } from "../../../src/lib/corrections/engine";
import { revalidateCorrectionSnapshot } from "../../../src/lib/corrections/revalidation";
import { previewCellCorrection } from "../../../src/lib/corrections/what-if";
import type { WhatIfConfiguration } from "../../../src/lib/corrections/what-if";

const make = () => createCorrectionState([
  parseCsvText("id,name,department_id\n1,Ali,10\n2,Sara,20\n3,Ahmed,99\n3,Bilal,10", "students.csv"),
  parseCsvText("id,name\n10,Engineering\n20,Science", "departments.csv"),
]);
const config: WhatIfConfiguration = {
  mappings: {
    students: ["id", "name", "department_id"].map((source) => ({ source, target: source })),
    departments: ["id", "name"].map((source) => ({ source, target: source })),
  },
  rules: { students: { primaryKey: "id", required: ["name", "department_id"], types: {} }, departments: { primaryKey: "id", required: ["name"], types: {} } },
  relationships: [{ childDataset: "students", childColumn: "department_id", parentDataset: "departments", parentColumn: "id" }],
};
const fk = { dataset: "students", rowNumber: 4, column: "department_id", expectedValue: "99", value: "20" };
const pk = { dataset: "students", rowNumber: 5, column: "id", expectedValue: "3", value: "4" };
const verify = (state: ReturnType<typeof make>) => revalidateCorrectionSnapshot(state.current, config);

describe("Phase 8 S5 corrections -> real validation/analytics integration", () => {
  it("approved edit matches the earlier what-if predicted metrics", () => {
    const state = make();
    const predicted = previewCellCorrection(state, fk, config);
    const approved = applyCellCorrection(state, fk);
    const verified = verify(approved);
    expect(verified.report.status).toBe(predicted.predicted.status);
    expect(verified.analytics.summary.blockingErrors).toBe(predicted.predicted.blockingErrors);
    expect(verified.analytics.summary.invalidRows).toBe(predicted.predicted.invalidRows);
    expect(state.undoStack).toHaveLength(0);
  });
  it("immediately recomputed scores follow apply, undo and redo snapshots", () => {
    const baseline = make();
    const changed = applyCellCorrection(baseline, fk);
    const undone = undoCorrection(changed);
    const redone = redoCorrection(undone);
    expect([verify(baseline), verify(changed), verify(undone), verify(redone)].map((item) => item.report.totals.errors)).toEqual([3,2,3,2]);
  });
  it("second change transitions from BLOCKED to READY using the real data", () => {
    const state = applyCellCorrection(applyCellCorrection(make(), fk), pk);
    expect(verify(state).analytics.summary).toMatchObject({ totalRecords: 6, validRows: 6, invalidRows: 0, totalIssues: 0 });
  });
  it("restore original revalidation matches the first original report", () => {
    const state = make();
    const changed = applyCellCorrection(state, fk);
    expect(JSON.stringify(verify(discardAllCorrections(changed)))).toBe(JSON.stringify(verify(state)));
  });
  it("embedded CSV newlines preserve physical row identities across automatic revalidation", () => {
    const d = parseCsvText('id,name\n1,"Ali\nKhan"\n1,Sara', 'multiline.csv');
    const state = createCorrectionState([d]);
    const singleConfig: WhatIfConfiguration = { mappings: { multiline: [{ source: 'id', target: 'id' }, { source: 'name', target: 'name' }] }, rules: { multiline: { primaryKey: 'id', required: [], types: {} } }, relationships: [] };
    const after = applyCellCorrection(state, { dataset: 'multiline', rowNumber: 4, column: 'id', value: '2' });
    expect(revalidateCorrectionSnapshot(after.current, singleConfig).report.status).toBe('READY');
    expect(after.current[0].rowNumbers).toEqual([2,4]);
  });
});
