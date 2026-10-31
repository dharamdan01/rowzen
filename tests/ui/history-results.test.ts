import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import HistoryResults from "../../src/components/reports/history-results";
import { parseHistoryFilters } from "../../src/lib/reports/history-filters";
import type { PaginatedValidationHistory } from "../../src/lib/services/paginated-results-history";

const example: PaginatedValidationHistory = {
  total: 11, page: 1, totalPages: 2, pageSize: 10,
  items: [{
    id: "r1", projectId: "p1", projectName: "CSV Project",
    status: "CONFIG_ERROR", totalRows: 6,
    validRows: null, invalidRows: null, issueCount: 1,
    createdAt: new Date("2026-10-19T02:00:00Z"),
  }],
};
const filters = parseHistoryFilters({ status: "CONFIG_ERROR", q: "CSV", pageSize: "10" });
function html(history = example, suppliedFilters = filters) {
  return renderToStaticMarkup(createElement(HistoryResults, { history, filters: suppliedFilters }));
}

describe("Phase 7 S6 saved history UI", () => {
  it("renders accessible project search and filters", () => {
    const output = html();
    expect(output).toContain('role="search"');
    expect(output).toContain('name="q"');
    expect(output).toContain('name="status"');
    expect(output).toContain('name="order"');
    expect(output).toContain('name="pageSize"');
    expect(output).toContain("Apply filters");
  });
  it("preserves unknown row counts and does not conflate issues", () => {
    const output = html();
    expect(output.match(/Not evaluated/g)).toHaveLength(2);
    expect(output).toContain("CONFIG ERROR");
    expect(output).toMatch(/<td class="[^"]*tabular-nums[^"]*">1<\/td>/);
  });
  it("has pagination and preserves chosen filters", () => {
    const output = html();
    expect(output).toContain("Page 1 of 2");
    expect(output).toContain("Next");
    expect(output).toContain("status=CONFIG_ERROR");
  });
  it("distinguishes no matches from no saved reports", () => {
    const empty = { ...example, total: 0, items: [], page: 1, totalPages: 1 };
    expect(html(empty, filters)).toContain("No matching validation results");
    expect(html(empty, parseHistoryFilters({}))).toContain("No validation results yet");
  });
  it("escapes untrusted project display names", () => {
    const unsafe = { ...example, items: [{ ...example.items[0], projectName: "<script>bad()</script>" }] };
    const output = html(unsafe);
    expect(output).toContain("&lt;script&gt;bad()&lt;/script&gt;");
    expect(output).not.toContain("<script>");
  });
  it("renders dates in PKT and states metadata-only limitations", () => {
    const output = html();
    expect(output).toContain("Saved at (PKT)");
    expect(output).toContain("Original CSV rows and detailed issue lists are not stored");
  });
});
