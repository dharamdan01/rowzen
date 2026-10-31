import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import SummaryCards from "../../src/components/reports/summary-cards";
import DatasetAnalyticsTable from "../../src/components/reports/dataset-analytics-table";
import ErrorDistributionChart from "../../src/components/reports/error-distribution-chart";
import ReportAnalyticsDashboard from "../../src/components/reports/report-analytics-dashboard";
import type { ReportAnalytics } from "../../src/lib/reports/types";

const render = renderToStaticMarkup;
const example: ReportAnalytics = {
  status: "BLOCKED",
  summary: {
    totalDatasets: 2,
    totalRecords: 6,
    validRows: 4,
    invalidRows: 2,
    blockingErrors: 3,
    warnings: 0,
    totalIssues: 3,
  },
  datasets: [
    { dataset: "departments", totalRows: 2, validRows: 2, invalidRows: 0, blockingErrors: 0, warnings: 0, issueCount: 0 },
    { dataset: "students", totalRows: 4, validRows: 2, invalidRows: 2, blockingErrors: 3, warnings: 0, issueCount: 3 },
  ],
  issueDistribution: [
    { code: "DUPLICATE_PK", severity: "ERROR", category: "DATA", count: 2 },
    { code: "FK_NOT_FOUND", severity: "ERROR", category: "DATA", count: 1 },
  ],
  unassignedIssues: 0,
  readinessExplanation: "Blocking errors detected; correct and rerun.",
};

describe("Phase 7 analytics dashboard components", () => {
  it("renders all seven real metric labels", () => {
    const html = render(createElement(SummaryCards, { summary: example.summary }));
    for (const label of ["Datasets", "Total records", "Valid rows", "Invalid rows", "Blocking errors", "Warnings", "Total issues"]) {
      expect(html).toContain(label);
    }
  });
  it("keeps invalid rows separate from error entries", () => {
    const html = render(createElement(SummaryCards, { summary: example.summary }));
    expect(html).toMatch(/Invalid rows<\/dt><dd[^>]*>2<\/dd>/);
    expect(html).toMatch(/Blocking errors<\/dt><dd[^>]*>3<\/dd>/);
  });
  it("shows unknown validity but genuine zero errors for CONFIG_ERROR", () => {
    const html = render(createElement(SummaryCards, {
      summary: { ...example.summary, validRows: null, invalidRows: null, blockingErrors: 0, totalIssues: 0 },
    }));
    expect(html.match(/Not evaluated/g)).toHaveLength(2);
    expect(html).toMatch(/Blocking errors<\/dt><dd[^>]*>0<\/dd>/);
  });
  it("renders every dataset and its exact table counts", () => {
    const html = render(createElement(DatasetAnalyticsTable, { datasets: example.datasets }));
    expect(html).toContain("Dataset-level validation analytics");
    expect(html).toMatch(/departments<\/th><td[^>]*>2<\/td>/);
    expect(html).toMatch(/students<\/th><td[^>]*>4<\/td>/);
  });
  it("escapes a CSV-derived untrusted dataset label", () => {
    const html = render(createElement(DatasetAnalyticsTable, { datasets: [{ ...example.datasets[0], dataset: "<script>alert(1)</script>" }] }));
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
  });
  it("shows an accessible no-dataset state", () => {
    const html = render(createElement(DatasetAnalyticsTable, { datasets: [] }));
    expect(html).toContain("No uploaded datasets to analyze.");
  });
  it("does not manufacture chart bars when there are no issues", () => {
    const html = render(createElement(ErrorDistributionChart, { distribution: [] }));
    expect(html).toContain("No validation issues were reported");
    expect(html).not.toContain('data-testid="distribution-chart"');
  });
  it("offers exact chart values in an accessible table", () => {
    const html = render(createElement(ErrorDistributionChart, { distribution: example.issueDistribution }));
    expect(html).toContain("Accessible issue distribution data");
    expect(html).toContain("DUPLICATE_PK");
    expect(html).toContain("FK_NOT_FOUND");
    expect(html).toContain('data-testid="distribution-chart"');
  });
  it("explains readiness without promising a successful DB migration", () => {
    const html = render(createElement(ReportAnalyticsDashboard, { analytics: example }));
    expect(html).toContain("Migration readiness: BLOCKED");
    expect(html).toContain("Blocking errors detected; correct and rerun.");
    expect(html).toContain("database import execution was not performed");
  });
  it("shows unassigned configuration issues explicitly", () => {
    const html = render(createElement(ReportAnalyticsDashboard, {
      analytics: { ...example, unassignedIssues: 2, status: "CONFIG_ERROR" },
    }));
    expect(html).toContain("Migration readiness: CONFIG ERROR");
    expect(html).toContain("2 issues are configuration/dependency findings");
  });
});
