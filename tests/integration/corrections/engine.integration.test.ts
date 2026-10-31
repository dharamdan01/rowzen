import { describe, expect, it } from "vitest";
import { parseCsvText } from "../../../src/lib/csv/parser";
import { applyMapping, identityMapping } from "../../../src/lib/rehearsal/mapping";
import { runPreflight } from "../../../src/lib/rehearsal/preflight";
import { buildReportAnalytics } from "../../../src/lib/reports/analytics";
import type { PreflightInput } from "../../../src/lib/rehearsal/preflight";
import {
  applyCellCorrection, createCorrectionState, getOriginalCellValue,
  getEffectiveCorrections, redoCorrection, undoCorrection,
} from "../../../src/lib/corrections/engine";

function sample() {
  const students = parseCsvText(
    "id,name,department_id\n1,Ali,10\n2,Sara,20\n3,Ahmed,99\n3,Bilal,10\n",
    "students.csv",
  );
  const departments = parseCsvText(
    "id,name\n10,Software Engineering\n20,Computer Science\n",
    "departments.csv",
  );
  return [students, departments];
}

const rules: PreflightInput["rules"] = {
  students: { primaryKey: "id", required: ["name", "department_id"], types: {} },
  departments: { primaryKey: "id", required: ["name"], types: {} },
};
const relationships: PreflightInput["relationships"] = [
  { childDataset: "students", childColumn: "department_id", parentDataset: "departments", parentColumn: "id" },
];

function validate(datasets: PreflightInput["datasets"]) {
  return runPreflight({ datasets, rules, relationships });
}

describe("Phase 8 corrections + real Phase 6/7 pipeline", () => {
  it("corrects two problems, revalidates to READY, preserves original 6/4/2/3 snapshot", () => {
    const state = createCorrectionState(sample());
    const baseline = validate(state.original);
    expect(baseline.totals).toEqual({ totalRows: 6, validRows: 4, invalidRows: 2, errors: 3, warnings: 0 });
    let corrected = applyCellCorrection(state, {
      dataset: "students", rowNumber: 4, column: "department_id", value: "20", expectedValue: "99",
    });
    corrected = applyCellCorrection(corrected, {
      dataset: "students", rowNumber: 5, column: "id", value: "4", expectedValue: "3",
    });
    const report = validate(corrected.current);
    expect(report.status).toBe("READY");
    expect(report.totals).toEqual({ totalRows: 6, validRows: 6, invalidRows: 0, errors: 0, warnings: 0 });
    expect(validate(state.original)).toEqual(baseline);
    expect(getOriginalCellValue(corrected, { dataset: "students", rowNumber: 4, column: "department_id" })).toBe("99");
    expect(buildReportAnalytics(report, corrected.current).summary).toMatchObject({ totalRecords: 6, validRows: 6, invalidRows: 0 });
  });

  it("undo/redo revalidation reflects actual findings rather than cached report metrics", () => {
    let state = createCorrectionState(sample());
    state = applyCellCorrection(state, { dataset: "students", rowNumber: 4, column: "department_id", value: "20" });
    expect(validate(state.current).totals.errors).toBe(2);
    state = undoCorrection(state);
    expect(validate(state.current).totals.errors).toBe(3);
    state = redoCorrection(state);
    expect(validate(state.current).totals.errors).toBe(2);
  });

  it("keeps physical CSV line numbers stable for embedded newlines", () => {
    const multi = parseCsvText('id,name\n1,"Ali\nKhan"\n2,Sara\n', "students.csv");
    expect(multi.rowNumbers).toEqual([2, 4]);
    let state = createCorrectionState([multi]);
    state = applyCellCorrection(state, { dataset: "students", rowNumber: 4, column: "name", value: "Sana" });
    expect(state.current[0].rowNumbers).toEqual([2, 4]);
    expect(state.current[0].rows[1].name).toBe("Sana");
    expect(state.original[0].rows[0].name).toBe("Ali\nKhan");
  });

  it("applies existing column mappings after correction, without modifying source headers", () => {
    const [students] = sample();
    let state = createCorrectionState([students]);
    state = applyCellCorrection(state, { dataset: "students", rowNumber: 4, column: "name", value: "Ahmed corrected" });
    const mapping = identityMapping(students.headers).map((entry) =>
      entry.source === "name" ? { ...entry, target: "full_name" } : entry,
    );
    const mapped = applyMapping(state.current[0], mapping);
    expect(mapped.rows[2].full_name).toBe("Ahmed corrected");
    expect(state.original[0].headers).toEqual(["id", "name", "department_id"]);
    expect(state.current[0].headers).toEqual(["id", "name", "department_id"]);
  });

  it("net correction locations never reveal unrelated raw records", () => {
    const data = parseCsvText("id,name\n1,PRIVATE_UNCHANGED_ALPHA\n2,Sara\n", "students.csv");
    const state = applyCellCorrection(createCorrectionState([data]), {
      dataset: "students", rowNumber: 3, column: "name", value: "Sana",
    });
    expect(JSON.stringify(getEffectiveCorrections(state))).not.toContain("PRIVATE_UNCHANGED_ALPHA");
    expect(getEffectiveCorrections(state)).toEqual([{
      dataset: "students", rowNumber: 3, column: "name", originalValue: "Sara", correctedValue: "Sana",
    }]);
  });
});
