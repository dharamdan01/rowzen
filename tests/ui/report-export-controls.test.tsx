import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ReportExportControls from "../../src/components/reports/report-export-controls";
import type { RehearsalReportV1 } from "../../src/lib/rehearsal/types";
import type { ReportAnalytics } from "../../src/lib/reports/types";

const report: RehearsalReportV1 = {
  schemaVersion: "1", mode: "STATIC_PREFLIGHT", status: "READY", datasets: ["students"],
  issues: [], totals: { totalRows: 1, validRows: 1, invalidRows: 0, errors: 0, warnings: 0 },
  importOrder: ["students"], cycleGroups: [], assumptions: [],
};
const analytics: ReportAnalytics = {
  status: "READY", summary: { totalDatasets: 1, totalRecords: 1, validRows: 1, invalidRows: 0, blockingErrors: 0, warnings: 0, totalIssues: 0 },
  datasets: [{ dataset: "students", totalRows: 1, validRows: 1, invalidRows: 0, blockingErrors: 0, warnings: 0, issueCount: 0 }],
  issueDistribution: [], unassignedIssues: 0, readinessExplanation: "Passed",
};
const html = renderToStaticMarkup(createElement(ReportExportControls, { report, analytics }));

describe("Phase 7 S5 export control accessibility", () => {
  it("shows all three labeled download buttons", () => {
    expect(html).toContain("Download privacy-safe JSON");
    expect(html).toContain("Download issues CSV");
    expect(html).toContain("Download dataset summary CSV");
    expect((html.match(/<button/g) ?? []).length).toBe(3);
  });
  it("has a semantic section heading and privacy explanation", () => {
    expect(html).toContain('aria-labelledby="report-exports-title"');
    expect(html).toContain("Export validation report");
    expect(html).toContain("No CSV source rows or cell values are included");
  });
  it("warns users that dataset labels and column names remain metadata", () => {
    expect(html).toContain("Review before sharing");
    expect(html).toContain("spreadsheet safety");
  });
});
