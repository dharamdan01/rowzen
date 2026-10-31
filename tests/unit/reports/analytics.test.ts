import { describe, expect, it } from "vitest";
import { buildReportAnalytics } from "../../../src/lib/reports/analytics";
import { createIssue } from "../../../src/lib/rehearsal/issues";
import type { RehearsalReportV1 } from "../../../src/lib/rehearsal/types";
import type { AnalyticsDataset } from "../../../src/lib/reports/types";

const datasets = (): AnalyticsDataset[] => [
  { name: "students", rows: [{ id: "1" }, { id: "2" }], rowNumbers: [2, 4] },
  { name: "departments", rows: [{ id: "10" }], rowNumbers: [2] },
];

function issue(row: number, code: "FK_NOT_FOUND" | "DUPLICATE_PK", severity: "ERROR" | "WARNING" = "ERROR") {
  return createIssue({
    code, severity, category: "DATA", dataset: "students", rowNumber: row,
    column: "id", ruleId: `${code}:${row}:${severity}`,
    explanation: "Synthetic test issue", suggestedInvestigation: "Check the referenced key",
  });
}

function report(): RehearsalReportV1 {
  const issues = [issue(4, "FK_NOT_FOUND"), issue(4, "DUPLICATE_PK")];
  return {
    schemaVersion: "1", mode: "STATIC_PREFLIGHT", status: "BLOCKED",
    datasets: ["departments", "students"], issues,
    totals: { totalRows: 3, validRows: 2, invalidRows: 1, errors: 2, warnings: 0 },
    importOrder: ["departments", "students"], cycleGroups: [], assumptions: [],
  };
}

describe("Phase 7 deterministic analytics", () => {
  it("separates issue count from invalid physical rows", () => {
    const a = buildReportAnalytics(report(), datasets());
    expect(a.summary).toEqual({ totalDatasets: 2, totalRecords: 3, validRows: 2, invalidRows: 1, blockingErrors: 2, warnings: 0, totalIssues: 2 });
    expect(a.datasets.find((x) => x.dataset === "students")).toMatchObject({ totalRows: 2, validRows: 1, invalidRows: 1, blockingErrors: 2, issueCount: 2 });
  });

  it("counts same physical row numbers in different datasets separately", () => {
    const r = report();
    r.issues.push(createIssue({ code: "REQUIRED", severity: "ERROR", category: "DATA", dataset: "departments", rowNumber: 2, column: "id", ruleId: "dept:id", explanation: "Missing", suggestedInvestigation: "Check column" }));
    r.totals.errors = 3;
    r.totals.invalidRows = 2;
    r.totals.validRows = 1;
    expect(buildReportAnalytics(r, datasets()).datasets.find((d) => d.dataset === "departments")?.invalidRows).toBe(1);
  });

  it("is byte-for-byte deterministic regardless of dataset and issue ordering", () => {
    const first = JSON.stringify(buildReportAnalytics(report(), datasets()));
    const r = report();
    r.issues.reverse();
    r.datasets.reverse();
    expect(JSON.stringify(buildReportAnalytics(r, datasets().reverse()))).toBe(first);
  });

  it("returns unknown valid/invalid rows on CONFIG_ERROR", () => {
    const r = report();
    r.status = "CONFIG_ERROR";
    r.issues = [createIssue({ code: "BAD_SCHEMA", severity: "ERROR", category: "SCHEMA", dataset: "students", rowNumber: null, column: "id", ruleId: "broken:id", explanation: "Unknown column", suggestedInvestigation: "Fix mapping" })];
    r.totals = { totalRows: 3, validRows: null, invalidRows: null, errors: 1, warnings: 0 };
    const a = buildReportAnalytics(r, datasets());
    expect(a.datasets.every((d) => d.validRows === null && d.invalidRows === null)).toBe(true);
    expect(a.summary.validRows).toBeNull();
  });

  it("records warning-only results without marking rows invalid", () => {
    const r = report();
    r.status = "READY_WITH_WARNINGS";
    r.issues = [issue(4, "FK_NOT_FOUND", "WARNING")];
    r.totals = { totalRows: 3, validRows: 3, invalidRows: 0, errors: 0, warnings: 1 };
    const a = buildReportAnalytics(r, datasets());
    expect(a.summary.warnings).toBe(1);
    expect(a.datasets.find((d) => d.dataset === "students")?.invalidRows).toBe(0);
  });

  it("counts orphan cycle/config issues without assigning a fake dataset", () => {
    const r = report();
    r.issues.push(createIssue({ code: "DEPENDENCY_CYCLE", category: "DEPENDENCY", severity: "ERROR", dataset: "(dependencies)", rowNumber: null, column: null, ruleId: "cycle:a", explanation: "Cycle", suggestedInvestigation: "Break cycle" }));
    r.totals.errors = 3;
    const a = buildReportAnalytics(r, datasets());
    expect(a.unassignedIssues).toBe(1);
    expect(a.summary.blockingErrors).toBe(3);
    expect(a.datasets.reduce((sum, x) => sum + x.issueCount, 0)).toBe(2);
  });

  it("fails closed on mismatched dataset totals", () => {
    const r = report(); r.totals.totalRows = 10;
    expect(() => buildReportAnalytics(r, datasets())).toThrow(/datasets or row totals/);
  });

  it("fails closed on duplicated dataset names", () => {
    expect(() => buildReportAnalytics(report(), [...datasets(), datasets()[0]!])).toThrow(/distinct/);
  });

  it("fails closed on duplicate or invalid physical row locations", () => {
    const d = datasets(); d[0]!.rowNumbers = [2, 2];
    expect(() => buildReportAnalytics(report(), d)).toThrow(/physical row/);
  });

  it("fails closed when a DATA issue refers to an absent physical row", () => {
    const r = report(); r.issues = [issue(999, "FK_NOT_FOUND")];
    r.totals = { totalRows: 3, validRows: 2, invalidRows: 1, errors: 1, warnings: 0 };
    expect(() => buildReportAnalytics(r, datasets())).toThrow(/outside/);
  });

  it("fails closed on inconsistent invalid-row counts", () => {
    const r = report(); r.totals.validRows = 1; r.totals.invalidRows = 2;
    expect(() => buildReportAnalytics(r, datasets())).toThrow(/invalid-row totals/);
  });

  it("fails closed on duplicate stable issue IDs", () => {
    const r = report(); r.issues.push(r.issues[0]!); r.totals.errors = 3;
    expect(() => buildReportAnalytics(r, datasets())).toThrow(/Duplicate report issue ID/);
  });

  it("never returns the raw CSV cell data in analytics", () => {
    const d = datasets(); d[0]!.rows[0]!.email = "private@example.com";
    expect(JSON.stringify(buildReportAnalytics(report(), d))).not.toContain("private@example.com");
  });
});
