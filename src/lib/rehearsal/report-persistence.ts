/**
 * Convert deterministic browser-calculated preflight results to the server's
 * summary-only contract. Never submit CSV rows, mapped values, or issue text.
 */
import type { RehearsalReportV1 } from "./types";
import type { ValidationRunPayload } from "../services/schemas";

function safeCount(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

export function toValidationRunSummary(
  report: RehearsalReportV1,
): ValidationRunPayload | null {
  const { totalRows, validRows, invalidRows } = report.totals;
  const issueCount = report.issues.length;

  if (!safeCount(totalRows) || !safeCount(issueCount)) return null;

  if (report.status === "CONFIG_ERROR") {
    if (validRows !== null || invalidRows !== null || issueCount < 1) return null;
    return { status: "CONFIG_ERROR", totalRows, validRows: null, invalidRows: null, issueCount };
  }

  if (validRows === null || invalidRows === null ||
      !safeCount(validRows) || !safeCount(invalidRows) ||
      validRows + invalidRows !== totalRows) return null;

  if (report.status === "READY" && issueCount === 0) {
    return { status: "READY", totalRows, validRows, invalidRows, issueCount };
  }
  if (report.status === "READY_WITH_WARNINGS" &&
      issueCount > 0 && report.issues.every((issue) => issue.severity === "WARNING")) {
    return { status: "READY_WITH_WARNINGS", totalRows, validRows, invalidRows, issueCount };
  }
  if (report.status === "BLOCKED" && issueCount > 0) {
    return { status: "BLOCKED", totalRows, validRows, invalidRows, issueCount };
  }

  return null;
}

/** Backward compatibility for existing Phase 6 UI integration tests. */
export function toLegacyRunSummary(report: RehearsalReportV1) {
  const summary = toValidationRunSummary(report);
  if (!summary || (summary.status !== "READY" && summary.status !== "BLOCKED")) return null;
  return summary;
}
