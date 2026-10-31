import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { parseCsvText } from "../../../src/lib/csv/parser";
import { runPreflight } from "../../../src/lib/rehearsal/preflight";
import type { DatasetRules } from "../../../src/lib/rehearsal/rules";
import { toLegacyRunSummary } from "../../../src/lib/rehearsal/report-persistence";
import IssueTable from "../../../src/components/validation/issue-table";
import DependencyGraph from "../../../src/components/validation/dependency-graph";

const parent = parseCsvText("id,name\n1,Ops\n2,Eng", "departments.csv");
const child = parseCsvText("id,name,department_id\n1,A,1\n2,B,999", "students.csv");
const rules: Record<string, DatasetRules> = {
  departments: { primaryKey: "id", required: ["name"], types: {} },
  students: { primaryKey: "id", required: ["name", "department_id"], types: {} },
};
const relationships = [{ childDataset: "students", childColumn: "department_id", parentDataset: "departments", parentColumn: "id" }];

describe("Phase 6 browser-facing reports from parsed CSVs", () => {
  it("renders stable row-level FK details without raw referenced values", () => {
    const report = runPreflight({ datasets: [parent, child], rules, relationships });
    expect(report.status).toBe("BLOCKED");
    const html = renderToStaticMarkup(createElement(IssueTable, { issues: report.issues }));
    expect(html).toContain("FK_NOT_FOUND");
    expect(html).toContain("Investigation and issue metadata");
    expect(html).toContain("issue_");
    expect(html).not.toContain(">999<");
    expect(report.totals.invalidRows).toBe(1);
  });
  it("shows the graph parent-first order based on the canonical report", () => {
    const report = runPreflight({ datasets: [child, parent], rules, relationships });
    const html = renderToStaticMarkup(createElement(DependencyGraph, { report, relationships }));
    expect(html).toContain("departments");
    expect(html).toContain("students");
    expect(html).toContain("Suggested import order:");
  });
  it("uses old API summary format without sending raw CSV or issue details", () => {
    const report = runPreflight({ datasets: [child, parent], rules, relationships });
    const summary = toLegacyRunSummary(report);
    expect(summary).toEqual({ status: "BLOCKED", totalRows: 4, validRows: 3, invalidRows: 1, issueCount: 1 });
    expect(JSON.stringify(summary)).not.toContain("department_id");
  });
});
