import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { parseCsvText } from "../../src/lib/csv/parser";
import { createCorrectionState, applyCellCorrection, undoCorrection } from "../../src/lib/corrections/engine";
import { revalidateCorrectionSnapshot } from "../../src/lib/corrections/revalidation";
import type { WhatIfConfiguration } from "../../src/lib/corrections/what-if";
import ReportComparisonPanel from "../../src/components/corrections/report-comparison-panel";
import HistoryResults from "../../src/components/reports/history-results";
import { parseHistoryFilters } from "../../src/lib/reports/history-filters";
import type { PaginatedValidationHistory } from "../../src/lib/services/paginated-results-history";

const config: WhatIfConfiguration = {
  mappings: { test: ["id", "name"].map((source) => ({ source, target: source })) },
  rules: { test: { primaryKey: "id", required: ["name"], types: {} } }, relationships: [],
};
function view(undo = false) {
  const start = createCorrectionState([parseCsvText("id,name\n1,Ali\n1,Sara", "test.csv")]);
  const changed = applyCellCorrection(start, { dataset: "test", rowNumber: 3, column: "id", value: "2" });
  const state = undo ? undoCorrection(changed) : changed;
  return renderToStaticMarkup(createElement(ReportComparisonPanel, { state, verifiedReport: revalidateCorrectionSnapshot(state.current, config).report, config }));
}

describe("Phase 8 S8 report comparison UI", () => {
  it("shows correct verified labels and accessible table", () => {
    const markup = view();
    expect(markup).toContain('aria-label="Verified correction impact"');
    expect(markup).toContain('aria-label="Original and corrected summary"');
    expect(markup).toContain("Original vs corrected validation");
    expect(markup).toContain("Verified corrected");
    expect(markup).toContain("BLOCKED");
    expect(markup).toContain("READY");
  });
  it("shows only verified totals and never cell values", () => {
    const markup = view();
    expect(markup).toContain("1 changed cells across 1 affected records");
    expect(markup).not.toContain("Ali");
    expect(markup).not.toContain("Sara");
  });
  it("disappears after undo with no net differences", () => {
    expect(view(true)).toBe("");
  });
  it("provides saved summary links without exposing CSV content", () => {
    const example: PaginatedValidationHistory = {
      total: 1, page: 1, totalPages: 1, pageSize: 10,
      items: [{ id: "report-1", projectId: "proj-1", projectName: "Test", status: "READY", totalRows: 2, validRows: 2, invalidRows: 0, issueCount: 0, createdAt: new Date("2026-10-20T02:00:00Z") }],
    };
    const markup = renderToStaticMarkup(createElement(HistoryResults, { history: example, filters: parseHistoryFilters({}) }));
    expect(markup).toContain('href="/results/report-1"');
    expect(markup).toContain("View summary");
    expect(markup).not.toContain("rawCsv");
  });
});
