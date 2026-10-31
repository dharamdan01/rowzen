import type { RehearsalIssue, IssueCategory, IssueCode, IssueSeverity } from "../rehearsal/types";

export type IssueSortField = "dataset" | "rowNumber" | "code" | "severity" | "category";
export type IssueSortDirection = "asc" | "desc";

export interface IssueFilterOptions {
  search?: string;
  dataset?: string;
  code?: IssueCode | "ALL";
  category?: IssueCategory | "ALL";
  severity?: IssueSeverity | "ALL";
  sortBy?: IssueSortField;
  sortDirection?: IssueSortDirection;
  page?: number;
  pageSize?: number;
}

export interface IssuePage {
  issues: RehearsalIssue[];
  totalIssues: number;
  filteredIssues: number;
  page: number;
  pageSize: number;
  totalPages: number;
  from: number;
  to: number;
  availableDatasets: string[];
  availableCodes: IssueCode[];
}

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 10;

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Always use deterministic lexical comparison, without locale-specific collation. */
function compareField(a: RehearsalIssue, b: RehearsalIssue, field: IssueSortField): number {
  if (field === "rowNumber") {
    // Dataset-level issues have no CSV line. Show them last in both sort directions.
    if (a.rowNumber === null && b.rowNumber !== null) return 1;
    if (b.rowNumber === null && a.rowNumber !== null) return -1;
    return (a.rowNumber ?? 0) - (b.rowNumber ?? 0);
  }
  if (field === "severity") {
    return (a.severity === "ERROR" ? 0 : 1) - (b.severity === "ERROR" ? 0 : 1);
  }
  return compareText(a[field], b[field]);
}

function isPositiveSafeInt(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

export function filterAndPaginateIssues(
  issues: readonly RehearsalIssue[],
  options: Readonly<IssueFilterOptions> = {},
): IssuePage {
  const pageSize = isPositiveSafeInt(options.pageSize ?? DEFAULT_PAGE_SIZE)
    ? Math.min(options.pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE)
    : DEFAULT_PAGE_SIZE;

  const search = (options.search ?? "").trim().toLowerCase();
  const direction = options.sortDirection === "desc" ? -1 : 1;
  const sortBy: IssueSortField = options.sortBy ?? "dataset";

  const availableDatasets = [...new Set(issues.map((i) => i.dataset))].sort(compareText);
  const availableCodes = [...new Set(issues.map((i) => i.code))].sort(compareText);

  const filtered = issues.filter((issue) => {
    if (options.dataset && options.dataset !== "ALL" && issue.dataset !== options.dataset) return false;
    if (options.code && options.code !== "ALL" && issue.code !== options.code) return false;
    if (options.severity && options.severity !== "ALL" && issue.severity !== options.severity) return false;
    if (options.category && options.category !== "ALL" && issue.category !== options.category) return false;
    if (!search) return true;
    const searchFields = [
      issue.id, issue.dataset, issue.column ?? "", issue.code, issue.category,
      issue.severity, issue.explanation, issue.suggestedInvestigation, issue.ruleId,
      issue.rowNumber === null ? "" : String(issue.rowNumber),
    ];
    return searchFields.some((value) => value.toLowerCase().includes(search));
  });

  const sorted = filtered.sort((a, b) => {
    const primary = compareField(a, b, sortBy);
    // Always put null CSV rows last when sorting by row number.
    if (sortBy === "rowNumber" && (a.rowNumber === null || b.rowNumber === null) && primary !== 0) {
      return primary;
    }
    return primary * direction || compareText(a.dataset, b.dataset) ||
      (a.rowNumber ?? -1) - (b.rowNumber ?? -1) || compareText(a.code, b.code) ||
      compareText(a.id, b.id);
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const requestedPage = isPositiveSafeInt(options.page ?? 1) ? options.page ?? 1 : 1;
  const page = Math.min(requestedPage, totalPages);
  const start = (page - 1) * pageSize;
  const visible = sorted.slice(start, start + pageSize);

  return {
    issues: visible,
    totalIssues: issues.length,
    filteredIssues: sorted.length,
    page, pageSize, totalPages,
    from: sorted.length === 0 ? 0 : start + 1,
    to: start + visible.length,
    availableDatasets,
    availableCodes,
  };
}
