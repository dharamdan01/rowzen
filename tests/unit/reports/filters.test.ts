import { describe, expect, it } from "vitest";
import { createIssue } from "../../../src/lib/rehearsal/issues";
import type { IssueCode, RehearsalIssue } from "../../../src/lib/rehearsal/types";
import { filterAndPaginateIssues } from "../../../src/lib/reports/filters";

function issue(
  code: IssueCode,
  dataset: string,
  rowNumber: number | null,
  overrides: Partial<RehearsalIssue> = {},
): RehearsalIssue {
  return createIssue({
    code,
    dataset,
    rowNumber,
    column: rowNumber === null ? null : "id",
    severity: "ERROR",
    category: "DATA",
    ruleId: `test:${code}:${dataset}:${rowNumber ?? "schema"}`,
    explanation: `${code} encountered for ${dataset}`,
    suggestedInvestigation: "Inspect constraints",
    ...overrides,
  });
}

function fixtures() {
  return [
    issue("FK_NOT_FOUND", "students", 6),
    issue("DUPLICATE_PK", "students", 3),
    issue("INVALID_TYPE", "students", 8, { severity: "WARNING" }),
    issue("BAD_SCHEMA", "departments", null, { category: "SCHEMA", explanation: "Missing target column" }),
    issue("DEPENDENCY_CYCLE", "departments", null, { category: "DEPENDENCY" }),
  ];
}

describe("Phase 7 pure issue filtering, sorting, and pagination", () => {
  it("handles an empty issue collection", () => {
    expect(filterAndPaginateIssues([])).toMatchObject({
      issues: [], totalIssues: 0, filteredIssues: 0, page: 1, totalPages: 1, from: 0, to: 0,
    });
  });
  it("returns all issues with no filters", () => {
    expect(filterAndPaginateIssues(fixtures()).filteredIssues).toBe(5);
  });
  it("searches case-insensitively with trimmed input", () => {
    const result = filterAndPaginateIssues(fixtures(), { search: "  missing TARGET  " });
    expect(result.issues.map((item) => item.code)).toEqual(["BAD_SCHEMA"]);
  });
  it("searches issue codes and rule identifiers", () => {
    expect(filterAndPaginateIssues(fixtures(), { search: "fk_not_found" }).filteredIssues).toBe(1);
    expect(filterAndPaginateIssues(fixtures(), { search: "test:duplicate_pk" }).filteredIssues).toBe(1);
  });
  it("filters by exact dataset", () => {
    expect(filterAndPaginateIssues(fixtures(), { dataset: "students" }).filteredIssues).toBe(3);
  });
  it("filters by severity", () => {
    const result = filterAndPaginateIssues(fixtures(), { severity: "WARNING" });
    expect(result.issues.map((item) => item.code)).toEqual(["INVALID_TYPE"]);
  });
  it("filters by category", () => {
    expect(filterAndPaginateIssues(fixtures(), { category: "SCHEMA" }).filteredIssues).toBe(1);
  });
  it("filters by exact error code", () => {
    expect(filterAndPaginateIssues(fixtures(), { code: "DEPENDENCY_CYCLE" }).filteredIssues).toBe(1);
  });
  it("combines search, dataset, severity, and code as AND conditions", () => {
    expect(filterAndPaginateIssues(fixtures(), {
      search: "students", dataset: "students", severity: "ERROR", code: "FK_NOT_FOUND",
    }).filteredIssues).toBe(1);
    expect(filterAndPaginateIssues(fixtures(), {
      search: "students", dataset: "departments",
    }).filteredIssues).toBe(0);
  });
  it("sorts CSV physical line numbers numerically", () => {
    expect(filterAndPaginateIssues(fixtures(), { dataset: "students", sortBy: "rowNumber" })
      .issues.map((item) => item.rowNumber)).toEqual([3, 6, 8]);
  });
  it("keeps null physical rows last when sorting in either direction", () => {
    const input = [issue("REQUIRED", "z", 20), issue("BAD_SCHEMA", "z", null, { category: "SCHEMA" }), issue("INVALID_TYPE", "z", 2)];
    expect(filterAndPaginateIssues(input, { sortBy: "rowNumber" }).issues.map((i) => i.rowNumber)).toEqual([2, 20, null]);
    expect(filterAndPaginateIssues(input, { sortBy: "rowNumber", sortDirection: "desc" }).issues.map((i) => i.rowNumber)).toEqual([20, 2, null]);
  });
  it("has stable tie breaks independently of input ordering", () => {
    const input = fixtures();
    const forward = filterAndPaginateIssues(input, { sortBy: "severity", sortDirection: "desc" });
    const backward = filterAndPaginateIssues([...input].reverse(), { sortBy: "severity", sortDirection: "desc" });
    expect(forward.issues).toEqual(backward.issues);
  });
  it("paginates issues and displays correct item ranges", () => {
    const result = filterAndPaginateIssues(fixtures(), { page: 2, pageSize: 2 });
    expect(result).toMatchObject({ page: 2, pageSize: 2, totalPages: 3, from: 3, to: 4, filteredIssues: 5 });
    expect(result.issues).toHaveLength(2);
  });
  it("clamps out-of-range pages and rejects invalid page numbers", () => {
    expect(filterAndPaginateIssues(fixtures(), { page: 99, pageSize: 2 }).page).toBe(3);
    expect(filterAndPaginateIssues(fixtures(), { page: -1 }).page).toBe(1);
  });
  it("caps maximum page size and handles invalid sizes", () => {
    expect(filterAndPaginateIssues(fixtures(), { pageSize: 100000 }).pageSize).toBe(100);
    expect(filterAndPaginateIssues(fixtures(), { pageSize: 0 }).pageSize).toBe(10);
  });
  it("never mutates input issues or their order", () => {
    const input = fixtures();
    const before = JSON.stringify(input);
    filterAndPaginateIssues(input, { sortBy: "code", sortDirection: "desc", search: "students" });
    expect(JSON.stringify(input)).toBe(before);
  });
  it("offers filter choices from all issues, not only the current page", () => {
    const result = filterAndPaginateIssues(fixtures(), { pageSize: 1, dataset: "students" });
    expect(result.availableDatasets).toEqual(["departments", "students"]);
    expect(result.availableCodes).toContain("BAD_SCHEMA");
    expect(result.availableCodes).toContain("FK_NOT_FOUND");
  });
});
