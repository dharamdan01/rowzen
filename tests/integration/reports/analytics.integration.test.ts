import { describe, expect, it } from "vitest";
import { parseCsvText } from "../../../src/lib/csv/parser";
import { runPreflight } from "../../../src/lib/rehearsal/preflight";
import { buildReportAnalytics } from "../../../src/lib/reports/analytics";

function fixture() {
  const datasets = [
    parseCsvText("id,name,department_id\n1,Ali,10\n2,Sara,20\n3,Ahmed,99\n3,Bilal,10\n", "students.csv"),
    parseCsvText("id,name\n10,Engineering\n20,Science\n", "departments.csv"),
  ];
  const rules = {
    students: { primaryKey: "id", required: ["name", "department_id"], types: {} },
    departments: { primaryKey: "id", required: ["name"], types: {} },
  };
  const relationships = [{ childDataset: "students", childColumn: "department_id", parentDataset: "departments", parentColumn: "id" }];
  return { datasets, rules, relationships };
}

describe("Phase 7 analytics + real Phase 6 engine", () => {
  it("derives true 6/4/2 row counts and 3 errors from CSV inputs", () => {
    const input = fixture();
    const result = buildReportAnalytics(runPreflight(input), input.datasets);
    expect(result.summary).toEqual({ totalDatasets: 2, totalRecords: 6, validRows: 4, invalidRows: 2, blockingErrors: 3, warnings: 0, totalIssues: 3 });
    expect(result.datasets).toEqual([
      { dataset: "departments", totalRows: 2, validRows: 2, invalidRows: 0, blockingErrors: 0, warnings: 0, issueCount: 0 },
      { dataset: "students", totalRows: 4, validRows: 2, invalidRows: 2, blockingErrors: 3, warnings: 0, issueCount: 3 },
    ]);
  });

  it("remains byte-for-byte deterministic after dataset order reversal", () => {
    const a = fixture(); const b = fixture();
    b.datasets.reverse();
    b.relationships.reverse();
    expect(JSON.stringify(buildReportAnalytics(runPreflight(a), a.datasets)))
      .toBe(JSON.stringify(buildReportAnalytics(runPreflight(b), b.datasets)));
  });

  it("marks row validity as unknown after a schema configuration error", () => {
    const input = fixture();
    input.relationships[0]!.parentColumn = "missing_column";
    const analytics = buildReportAnalytics(runPreflight(input), input.datasets);
    expect(analytics.status).toBe("CONFIG_ERROR");
    expect(analytics.summary.invalidRows).toBeNull();
    expect(analytics.datasets.every((d) => d.invalidRows === null)).toBe(true);
  });
});
