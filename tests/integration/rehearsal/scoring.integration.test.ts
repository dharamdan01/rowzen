import { describe, expect, it } from "vitest";
import { parseCsvText } from "../../../src/lib/csv/parser";
import { validateKeyConstraints } from "../../../src/lib/rehearsal/keys";
import { validateForeignKeys } from "../../../src/lib/rehearsal/foreign-keys";
import { analyzeDependencyGraph } from "../../../src/lib/rehearsal/graph";
import { assessMigrationReadiness } from "../../../src/lib/rehearsal/scoring";
import type { ForeignKeyDeclaration } from "../../../src/lib/rehearsal/foreign-keys";

const relationships: ForeignKeyDeclaration[] = [{
  childDataset: "students", childColumn: "department_id",
  parentDataset: "departments", parentColumn: "id",
}];
const keys = {
  departments: { primaryKey: ["id"] },
  students: { primaryKey: ["id"] },
};

function preflight(studentsText: string, departmentsText: string, reverse = false) {
  const students = parseCsvText(studentsText, "students.csv");
  const departments = parseCsvText(departmentsText, "departments.csv");
  const datasets = reverse ? [departments, students] : [students, departments];
  const issues = [
    ...validateKeyConstraints(datasets, keys),
    ...validateForeignKeys(datasets, relationships, keys),
  ];
  const graph = analyzeDependencyGraph(datasets.map((dataset) => dataset.name), relationships);
  return assessMigrationReadiness({ datasets, issues, graph });
}

describe("Phase 6 readiness + parsed CSV + keys/FK/graph integration", () => {
  it("returns a deterministic READY report for valid related datasets", () => {
    const students = "id,department_id\n1,10\n2,20\n";
    const departments = "id,name\n10,Engineering\n20,Science\n";
    const a = preflight(students, departments);
    const b = preflight(students, departments, true);
    expect(a.status).toBe("READY");
    expect(a.totals).toEqual({ totalRows: 4, validRows: 4, invalidRows: 0, errors: 0, warnings: 0 });
    expect(a.importOrder).toEqual(["departments", "students"]);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("counts multiple FK and PK errors on the same physical row only once", () => {
    // Both duplicate student PK rows are orphans; row 3 produces two errors.
    const students = "id,department_id\n7,99\n7,99\n";
    const departments = "id,name\n10,Engineering\n";
    const report = preflight(students, departments);
    expect(report.status).toBe("BLOCKED");
    expect(report.totals).toEqual({ totalRows: 3, validRows: 1, invalidRows: 2, errors: 4, warnings: 0 });
    expect(report.issues.filter((issue) => issue.dataset === "students" && issue.rowNumber === 2)).toHaveLength(2);
    expect(report.issues.every((issue) => !issue.explanation.includes("99"))).toBe(true);
  });

  it("preserves physical row numbers after blank lines and remains repeatable", () => {
    const students = "id,department_id\n1,10\n\n2,999\n";
    const departments = "id,name\n10,Engineering\n";
    const a = preflight(students, departments);
    const b = preflight(students, departments);
    expect(a.status).toBe("BLOCKED");
    expect(a.totals).toMatchObject({ totalRows: 3, validRows: 2, invalidRows: 1, errors: 1 });
    expect(a.issues.find((issue) => issue.code === "FK_NOT_FOUND")?.rowNumber).toBe(4);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
