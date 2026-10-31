import { describe, expect, it } from "vitest";
import { parseCsvText } from "../../../src/lib/csv/parser";
import { applyCellCorrection, createCorrectionState } from "../../../src/lib/corrections/engine";
import { previewCellCorrection } from "../../../src/lib/corrections/what-if";
import { identityMapping, applyMapping } from "../../../src/lib/rehearsal/mapping";
import { runPreflight } from "../../../src/lib/rehearsal/preflight";

const input = [
  parseCsvText("id,name,department_id\n1,Ali,10\n2,Sara,20\n3,Ahmed,99\n3,Bilal,10", "students.csv"),
  parseCsvText("id,name\n10,Engineering\n20,Science", "departments.csv"),
];
const cfg = {
  mappings: Object.fromEntries(input.map((d) => [d.name, identityMapping(d.headers)])),
  rules: {
    students: { primaryKey: "id", required: ["name", "department_id"], types: {} },
    departments: { primaryKey: "id", required: ["name"], types: {} },
  },
  relationships: [{ childDataset: "students", childColumn: "department_id", parentDataset: "departments", parentColumn: "id" }],
};
const edit = { dataset: "students", rowNumber: 4, column: "department_id", expectedValue: "99", value: "20" };

describe("Phase 8 S4 what-if matches real Phase 6/7 validation", () => {
  it("preview predicted totals equal actual Phase 6 report only after explicit Apply", () => {
    const state = createCorrectionState(input);
    const p = previewCellCorrection(state, edit, cfg);
    const confirmed = applyCellCorrection(state, edit);
    const mapped = confirmed.current.map((d) => applyMapping(d, cfg.mappings[d.name]));
    const real = runPreflight({ datasets: mapped, rules: cfg.rules, relationships: cfg.relationships });
    expect(p.predicted.totalIssues).toBe(real.issues.length);
    expect(p.predicted.invalidRows).toBe(real.totals.invalidRows);
    expect(p.predicted.validRows).toBe(real.totals.validRows);
    expect(state.current[0].rows[2].department_id).toBe("99");
  });
  it("works with source-to-target mapping without editing original column names", () => {
    const state = createCorrectionState(input);
    const config = {
      mappings: { ...cfg.mappings, students: cfg.mappings.students.map((m) => m.source === "name" ? { source: "name", target: "full_name" } : m) },
      rules: { ...cfg.rules, students: { primaryKey: "id", required: ["full_name", "department_id"], types: {} } },
      relationships: cfg.relationships,
    };
    const p = previewCellCorrection(state, edit, config);
    expect(p.predicted.totalIssues).toBe(2);
    expect(state.current[0].headers).toContain("name");
    expect(state.current[0].headers).not.toContain("full_name");
  });
  it("reports unknown counts on invalid relationship settings", () => {
    const p = previewCellCorrection(createCorrectionState(input), edit, {
      ...cfg, relationships: [{ ...cfg.relationships[0], parentColumn: "unknown" }],
    });
    expect(p.predicted.status).toBe("CONFIG_ERROR");
    expect(p.predicted.validRows).toBeNull();
  });
  it("physical lines after multiline CSV cells remain stable during preview", () => {
    const multi = parseCsvText('id,name\n1,"Ali\nKhan"\n1,Sara', "multi.csv");
    const original = createCorrectionState([multi]);
    const p = previewCellCorrection(original, { dataset: "multi", rowNumber: 4, column: "id", expectedValue: "1", value: "2" }, {
      mappings: { multi: identityMapping(multi.headers) },
      rules: { multi: { primaryKey: "id", required: ["name"], types: {} } },
      relationships: [],
    });
    expect(p.predicted.status).toBe("READY");
    expect(original.current[0].rowNumbers).toEqual([2, 4]);
  });
});
