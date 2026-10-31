import { describe, it, expect } from "vitest";
import {
  parseHistoryFilters,
  historyPageHref,
  escapeHistorySearch,
  historyDetailHref,
  historyReturnHref,
} from "../../../src/lib/reports/history-filters";

describe("Phase 7 S6 history URL filters", () => {
  it("defaults to unfiltered newest-first results", () => {
    expect(parseHistoryFilters({})).toEqual({
      search: "", status: "ALL", order: "newest", page: 1, pageSize: 10,
    });
  });
  it("accepts all four persisted statuses", () => {
    for (const status of ["READY", "BLOCKED", "READY_WITH_WARNINGS", "CONFIG_ERROR"]) {
      expect(parseHistoryFilters({ status }).status).toBe(status);
    }
  });
  it("does not accept unknown status", () => {
    expect(parseHistoryFilters({ status: "DELETED" }).status).toBe("ALL");
  });
  it("supports oldest first", () => {
    expect(parseHistoryFilters({ order: "oldest" }).order).toBe("oldest");
  });
  it("rejects unknown sort modes", () => {
    expect(parseHistoryFilters({ order: "random" }).order).toBe("newest");
  });
  it("accepts 10, 25 and 50 rows per page only", () => {
    expect(parseHistoryFilters({ pageSize: "10" }).pageSize).toBe(10);
    expect(parseHistoryFilters({ pageSize: "25" }).pageSize).toBe(25);
    expect(parseHistoryFilters({ pageSize: "50" }).pageSize).toBe(50);
    expect(parseHistoryFilters({ pageSize: "1000000" }).pageSize).toBe(10);
  });
  it("rejects zero, negative, decimal and excessive page input", () => {
    for (const value of ["0", "-1", "1.2", "1000000", "1e4", "Infinity"]) {
      expect(parseHistoryFilters({ page: value }).page).toBe(1);
    }
  });
  it("accepts ordinary pages", () => {
    expect(parseHistoryFilters({ page: "42" }).page).toBe(42);
  });
  it("trims project search and bounds its length", () => {
    expect(parseHistoryFilters({ q: "  Project One  " }).search).toBe("Project One");
    expect(parseHistoryFilters({ q: "a".repeat(1000) }).search).toHaveLength(80);
  });
  it("uses first value for multi-valued query parameters", () => {
    expect(parseHistoryFilters({ status: ["BLOCKED", "READY"] }).status).toBe("BLOCKED");
  });
  it("creates links with stable preserved filters", () => {
    const filters = parseHistoryFilters({ q: "My project", status: "CONFIG_ERROR", order: "oldest", pageSize: "25" });
    expect(historyPageHref(filters, 2)).toBe("/results?q=My+project&status=CONFIG_ERROR&order=oldest&pageSize=25&page=2");
  });
  it("omits redundant defaults and invalid page references", () => {
    expect(historyPageHref(parseHistoryFilters({}), 1)).toBe("/results");
    expect(historyPageHref(parseHistoryFilters({}), -10)).toBe("/results");
  });
  it("escapes SQL LIKE wildcard characters in project names", () => {
    expect(escapeHistorySearch("50%_\\done")).toBe("50\\%\\_\\\\done");
  });
  it("bounds project scope and preserves it in navigation", () => {
    const filters = parseHistoryFilters({ projectId: `  ${"a".repeat(250)}  ` });
    expect(filters.projectId).toHaveLength(200);
    expect(historyPageHref(parseHistoryFilters({ projectId: " project-one " }), 2))
      .toBe("/results?projectId=project-one&page=2");
  });
  it("encodes report IDs and restores normalized list state", () => {
    const detail = historyDetailHref("report/one?x=1", parseHistoryFilters({ q: "Sample", status: "BLOCKED" }), 3);
    const url = new URL(detail, "https://rowzen.invalid");
    expect(url.pathname).toBe("/results/report%2Fone%3Fx%3D1");
    expect(historyReturnHref(url.searchParams.get("returnTo")))
      .toBe("/results?q=Sample&status=BLOCKED&page=3");
  });
  it("rejects foreign, malformed and unrelated return destinations", () => {
    for (const value of [undefined, {}, "https://evil.invalid/results", "//evil.invalid/results", "/results/secret", "/results-evil", "/results\\evil", "/login"]) {
      expect(historyReturnHref(value)).toBe("/results");
    }
    expect(historyReturnHref("/results?q=Sample&next=https://evil.invalid&status=BAD&page=-1#private"))
      .toBe("/results?q=Sample");
  });
});
