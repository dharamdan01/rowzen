/**
 * Phase 7 S5: deterministic, allowlisted preflight exports.
 *
 * Deliberately OMIT raw CSV rows, cell values, free-form issue explanations,
 * ruleId, investigation text and caller-supplied assumptions. They may contain
 * sensitive text. Dataset/column labels and physical CSV line numbers ARE metadata
 * and remain visible: advise the user to review the file before sharing.
 * No network, clock, mutable globals, React, or database calls.
 */
import type { RehearsalIssue, RehearsalReportV1, IssueCode, ReadinessStatus } from "../rehearsal/types";
import type { ReportAnalytics } from "./types";

export type ReportExportKind = "json" | "issues-csv" | "datasets-csv";
export interface PreparedReportExport {
  filename: string;
  contentType: string;
  content: string;
}

const compare = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;

/** Static advice; intentionally never copies free-form issue text or CSV cell values. */
const investigationByCode: Record<IssueCode, string> = {
  REQUIRED: "Provide the required field and repeat validation.",
  INVALID_TYPE: "Review declared field type and input format; no conversion is performed.",
  DUPLICATE_PK: "Inspect primary-key duplicates and resolve before importing.",
  DUPLICATE_UNIQUE: "Inspect unique-key duplicates and resolve before importing.",
  FK_NOT_FOUND: "Verify referenced parent keys, mappings, and parent-first load order.",
  MISSING_REFERENCE_DATASET: "Supply the referenced dataset or correct the relationship.",
  BAD_SCHEMA: "Correct the schema, column mapping, or constraint declaration.",
  INCOMPATIBLE_COLUMN_TYPE: "Align declared parent/child types; inspect target-DB behavior separately.",
  FK_TARGET_NOT_UNIQUE: "Declare an appropriate parent primary or unique key and validate it.",
  UNSUPPORTED_CONSTRAINT: "Review the unsupported constraint; static preflight cannot verify it.",
  DEPENDENCY_CYCLE: "Review cyclic relationships; static preflight cannot determine a full load order.",
};

/** Reuse reviewed corrective advice without copying caller-supplied issue prose. */
export function reportInvestigationForCode(code: IssueCode): string {
  return investigationByCode[code];
}

const readinessByStatus: Record<ReadinessStatus, string> = {
  READY: "All configured static preflight checks passed; actual database execution was not verified.",
  READY_WITH_WARNINGS: "No blocking errors were found; review warnings before an import attempt.",
  BLOCKED: "Blocking findings or dependency cycles require investigation before an import attempt.",
  CONFIG_ERROR: "Configuration errors prevent reliable row validity assessment; correct them and rerun.",
};

function ensureConsistent(report: RehearsalReportV1, analytics: ReportAnalytics): void {
  const summary = analytics.summary;
  if (report.schemaVersion !== "1" || report.mode !== "STATIC_PREFLIGHT" ||
      !Object.hasOwn(readinessByStatus, report.status) ||
      report.status !== analytics.status ||
      report.totals.totalRows !== summary.totalRecords ||
      report.totals.validRows !== summary.validRows ||
      report.totals.invalidRows !== summary.invalidRows ||
      report.totals.errors !== summary.blockingErrors ||
      report.totals.warnings !== summary.warnings ||
      report.issues.length !== summary.totalIssues ||
      report.datasets.length !== summary.totalDatasets) {
    throw new Error("Report and analytics do not match; rerun validation before export.");
  }
  const reported = [...report.datasets].sort(compare);
  const datasets = analytics.datasets.map((d) => d.dataset).sort(compare);
  if (JSON.stringify(reported) !== JSON.stringify(datasets) ||
      new Set(reported).size !== reported.length ||
      analytics.datasets.reduce((total, ds) => total + ds.totalRows, 0) !== summary.totalRecords ||
      analytics.datasets.reduce((total, ds) => total + ds.blockingErrors, 0) > summary.blockingErrors ||
      analytics.datasets.reduce((total, ds) => total + ds.warnings, 0) > summary.warnings) {
    throw new Error("Dataset metadata does not match the report; rerun validation before export.");
  }
  if (report.status === "CONFIG_ERROR"
    ? summary.validRows !== null || summary.invalidRows !== null
    : summary.validRows === null || summary.invalidRows === null ||
      summary.validRows + summary.invalidRows !== summary.totalRecords) {
    throw new Error("Invalid row-validity totals; export refused.");
  }
  if (report.issues.filter((i) => i.severity === "ERROR").length !== summary.blockingErrors ||
      report.issues.filter((i) => i.severity === "WARNING").length !== summary.warnings) {
    throw new Error("Issue severity totals do not match; export refused.");
  }
  const identities = new Set<string>();
  for (const issue of report.issues) {
    if (identities.has(issue.id) || !/^issue_[0-9a-f]{16}$/.test(issue.id) ||
        !Object.hasOwn(investigationByCode, issue.code)) {
      throw new Error("Invalid or duplicated issue identity/code; export refused.");
    }
    identities.add(issue.id);
  }
}

function sortedIssues(issues: readonly RehearsalIssue[]): RehearsalIssue[] {
  return [...issues].sort((a, b) =>
    compare(a.dataset, b.dataset) ||
    (a.rowNumber ?? -1) - (b.rowNumber ?? -1) ||
    compare(a.column ?? "", b.column ?? "") ||
    compare(a.code, b.code) ||
    compare(a.id, b.id),
  );
}

/** CSV cell encoding: always quote and double embedded quotes (RFC 4180 convention).
 * Spreadsheet software can interpret leading = + - @ as formulas even after
 * invisible/whitespace/control prefixes. Prefix an apostrophe to those cells.
 * Excel behavior varies by import application; always treat exported files as
 * untrusted when opening and never re-import as raw data without review.
 */
export function encodeCsvCell(value: string | number | null): string {
  const text = value === null ? "Not evaluated" : String(value);
  const vulnerable = /^[\s\u0000-\u001f\u007f-\u009f\uFEFF\u200B-\u200D\u2060]*[=+\-@\uFF1D\uFF0B\uFF0D\uFF20]/u.test(text);
  return `"${(vulnerable ? "'" + text : text).replaceAll('"', '""')}"`;
}

function csv(rows: readonly (readonly (string | number | null)[])[]): string {
  // Excel-friendly UTF-8 BOM. CRLF line endings and a final CRLF are stable.
  return "\uFEFF" + rows.map((row) => row.map(encodeCsvCell).join(",")).join("\r\n") + "\r\n";
}

export function prepareReportExport(
  report: RehearsalReportV1,
  analytics: ReportAnalytics,
  kind: ReportExportKind,
): PreparedReportExport {
  ensureConsistent(report, analytics);

  const issues = sortedIssues(report.issues);
  const datasets = [...analytics.datasets].sort((a, b) => compare(a.dataset, b.dataset));

  if (kind === "issues-csv") {
    const rows: (string | number | null)[][] = [[
      "Issue ID", "Severity", "Category", "Code", "Dataset", "CSV line", "Column", "Recommended action",
    ]];
    for (const issue of issues) rows.push([
      issue.id, issue.severity, issue.category, issue.code,
      issue.dataset, issue.rowNumber === null ? "" : issue.rowNumber,
      issue.column ?? "", investigationByCode[issue.code],
    ]);
    return {
      filename: "data-rehearsal-issues.csv",
      contentType: "text/csv;charset=utf-8",
      content: csv(rows),
    };
  }

  if (kind === "datasets-csv") {
    const rows: (string | number | null)[][] = [[
      "Dataset", "Total rows", "Valid rows", "Invalid rows", "Blocking errors", "Warnings", "Total issues",
    ]];
    for (const dataset of datasets) rows.push([
      dataset.dataset, dataset.totalRows, dataset.validRows, dataset.invalidRows,
      dataset.blockingErrors, dataset.warnings, dataset.issueCount,
    ]);
    return {
      filename: "data-rehearsal-datasets.csv",
      contentType: "text/csv;charset=utf-8",
      content: csv(rows),
    };
  }

  if (kind !== "json") throw new Error("Unsupported report export format.");

  // Explicit allowlist. Do not spread report/issue objects: future fields
  // could unintentionally carry raw CSV or other sensitive content.
  const snapshot = {
    exportVersion: 1,
    schemaVersion: "1",
    mode: "STATIC_PREFLIGHT",
    status: report.status,
    readinessExplanation: readinessByStatus[report.status],
    summary: {
      totalDatasets: analytics.summary.totalDatasets,
      totalRecords: analytics.summary.totalRecords,
      validRows: analytics.summary.validRows,
      invalidRows: analytics.summary.invalidRows,
      blockingErrors: analytics.summary.blockingErrors,
      warnings: analytics.summary.warnings,
      totalIssues: analytics.summary.totalIssues,
    },
    datasets: datasets.map((dataset) => ({
      dataset: dataset.dataset,
      totalRows: dataset.totalRows,
      validRows: dataset.validRows,
      invalidRows: dataset.invalidRows,
      blockingErrors: dataset.blockingErrors,
      warnings: dataset.warnings,
      issueCount: dataset.issueCount,
    })),
    issues: issues.map((issue) => ({
      id: issue.id,
      code: issue.code,
      severity: issue.severity,
      category: issue.category,
      dataset: issue.dataset,
      rowNumber: issue.rowNumber,
      column: issue.column,
      recommendedAction: investigationByCode[issue.code],
      // Do not copy issue.explanation, ruleId or free-form investigation strings.
    })),
    dependency: {
      recommendedImportOrder: report.status === "CONFIG_ERROR" ? [] : [...report.importOrder],
      cycleGroups: report.cycleGroups.map((group) => [...group].sort(compare))
        .sort((a, b) => compare(JSON.stringify(a), JSON.stringify(b))),
    },
    privacyNotice: "Export contains dataset/column labels, issue locations, and derived counts. Raw CSV rows and cell values are excluded. Review labels before sharing.",
    scopeNotice: "Static preflight only; no database import was executed or guaranteed.",
  };
  return {
    filename: "data-rehearsal-report-safe.json",
    contentType: "application/json;charset=utf-8",
    content: JSON.stringify(snapshot, null, 2) + "\n",
  };
}
