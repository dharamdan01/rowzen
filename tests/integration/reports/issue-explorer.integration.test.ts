import { describe, expect, it } from "vitest";
import { parseCsvText } from "../../../src/lib/csv/parser";
import { runPreflight } from "../../../src/lib/rehearsal/preflight";
import { filterAndPaginateIssues } from "../../../src/lib/reports/filters";

function report() {
  const datasets = [
    parseCsvText("id,name,department_id\n1,Ali,10\n2,Sara,20\n3,Ahmed,99\n3,Bilal,10\n", "students.csv"),
    parseCsvText("id,name\n10,Engineering\n20,Science\n", "departments.csv"),
  ];
  return runPreflight({
    datasets,
    rules: {
      students: { primaryKey: "id", required: ["name", "department_id"], types: {} },
      departments: { primaryKey: "id", required: ["name"], types: {} },
    },
    relationships: [{ childDataset: "students", childColumn: "department_id", parentDataset: "departments", parentColumn: "id" }],
  });
}

describe("Phase 7 issue explorer + real Phase 6 in-memory engine", () => {
  it("filters actual orphan FK and duplicate PK issues", () => {
    const result = report();
    expect(result.totals.totalRows).toBe(6);
    expect(result.issues).toHaveLength(3);
    expect(filterAndPaginateIssues(result.issues, { code: "FK_NOT_FOUND" }).filteredIssues).toBe(1);
    expect(filterAndPaginateIssues(result.issues, { code: "DUPLICATE_PK" }).filteredIssues).toBe(2);
  });
  it("produces stable paginated issues despite reversing input order", () => {
    const result = report();
    const options = { page: 1, pageSize: 2, sortBy: "rowNumber" as const, sortDirection: "desc" as const };
    expect(filterAndPaginateIssues(result.issues, options))
      .toEqual(filterAndPaginateIssues([...result.issues].reverse(), options));
  });
  it("can filter dataset-level CONFIG_ERROR issues with no row number", () => {
    const issueReport = report();
    const invalid = issueReport.issues[0]!;
    const updated = {
      ...invalid,
      id: "test-config-error",
      code: "BAD_SCHEMA" as const,
      category: "SCHEMA" as const,
      dataset: "departments",
      rowNumber: null,
      column: "missing",
    };
    const result = filterAndPaginateIssues([updated], { category: "SCHEMA", sortBy: "rowNumber" });
    expect(result.issues[0]?.rowNumber).toBeNull();
    expect(result.filteredIssues).toBe(1);
  });
});
