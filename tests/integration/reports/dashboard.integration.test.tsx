import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { parseCsvText } from "../../../src/lib/csv/parser";
import { runPreflight } from "../../../src/lib/rehearsal/preflight";
import { buildReportAnalytics } from "../../../src/lib/reports/analytics";
import SummaryCards from "../../../src/components/reports/summary-cards";
import DatasetAnalyticsTable from "../../../src/components/reports/dataset-analytics-table";
import ReportAnalyticsDashboard from "../../../src/components/reports/report-analytics-dashboard";

function fixture(configError = false) {
  const datasets = [
    parseCsvText("id,name,department_id\n1,Ali,10\n2,Sara,20\n3,Ahmed,99\n3,Bilal,10", "students.csv"),
    parseCsvText("id,name\n10,Engineering\n20,Science", "departments.csv"),
  ];
  const rules = {
    students: { primaryKey: "id", required: ["name", "department_id"], types: {} },
    departments: { primaryKey: "id", required: ["name"], types: {} },
  };
  const relationships = [{ childDataset: "students", childColumn: "department_id", parentDataset: "departments", parentColumn: configError ? "missing_column" : "id" }];
  return { datasets, rules, relationships };
}

describe("Phase 7 dashboard integration with actual Phase 6 preflight", () => {
  it("renders correct 6/4/2 versus three findings", () => {
    const input = fixture();
    const analytics = buildReportAnalytics(runPreflight(input), input.datasets);
    const html = renderToStaticMarkup(createElement(SummaryCards, { summary: analytics.summary }));
    expect(analytics.summary).toMatchObject({ totalDatasets: 2, totalRecords: 6, validRows: 4, invalidRows: 2, blockingErrors: 3, totalIssues: 3 });
    expect(html).toMatch(/Invalid rows<\/dt><dd[^>]*>2<\/dd>/);
    expect(html).toMatch(/Total issues<\/dt><dd[^>]*>3<\/dd>/);
  });
  it("uses exact per-dataset rows without leaking CSV cell values", () => {
    const input = fixture();
    const analytics = buildReportAnalytics(runPreflight(input), input.datasets);
    const html = renderToStaticMarkup(createElement(DatasetAnalyticsTable, { datasets: analytics.datasets }));
    expect(html).toContain("departments");
    expect(html).toContain("students");
    expect(html).not.toContain("Ali");
    expect(html).not.toContain("Science");
    expect(html).not.toContain(">99<");
  });
  it("renders CONFIG_ERROR without inventing row validity", () => {
    const input = fixture(true);
    const analytics = buildReportAnalytics(runPreflight(input), input.datasets);
    const html = renderToStaticMarkup(createElement(ReportAnalyticsDashboard, { analytics }));
    expect(analytics.status).toBe("CONFIG_ERROR");
    expect(analytics.summary.invalidRows).toBeNull();
    expect(html).toContain("CONFIG ERROR");
    expect(html).toContain("Not evaluated");
  });
});
