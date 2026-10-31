/**
 * Phase 7, subfeature 1: deterministic report analytics.
 * Uses only the canonical Phase 6 report and CSV row locations.
 * No React, I/O, timestamps, external services, or raw CSV values in the output.
 */
import type { RehearsalReportV1 } from "../rehearsal/types";
import type {
  AnalyticsDataset,
  DatasetAnalytics,
  IssueDistributionEntry,
  ReportAnalytics,
} from "./types";

const compare = (a: string, b: string): number =>
  a < b ? -1 : a > b ? 1 : 0;

const explanations: Record<RehearsalReportV1["status"], string> = {
  READY: "All configured static checks passed. This does not guarantee a database import will succeed.",
  READY_WITH_WARNINGS: "No blocking errors were reported, but review the warnings before importing.",
  BLOCKED: "Blocking errors or dependency cycles were reported. Resolve them and run preflight again.",
  CONFIG_ERROR: "The validation configuration is invalid. Row validity was not evaluated reliably; fix the configuration and retry.",
};

/** Throws on inconsistent inputs rather than presenting misleading dashboard statistics. */
export function buildReportAnalytics(
  report: RehearsalReportV1,
  datasets: readonly AnalyticsDataset[],
): ReportAnalytics {
  const byName = new Map<string, AnalyticsDataset>();
  let totalRecords = 0;

  for (const dataset of datasets) {
    if (!dataset.name.trim() || byName.has(dataset.name)) {
      throw new Error("Analytics requires distinct, nonempty dataset names");
    }
    if (dataset.rows.length !== dataset.rowNumbers.length ||
        dataset.rowNumbers.some((n) => !Number.isSafeInteger(n) || n < 1) ||
        new Set(dataset.rowNumbers).size !== dataset.rowNumbers.length) {
      throw new Error(`Invalid physical row locations for dataset '${dataset.name}'`);
    }
    byName.set(dataset.name, dataset);
    totalRecords += dataset.rows.length;
  }

  const expectedNames = [...byName.keys()].sort(compare);
  const reportedNames = [...report.datasets].sort(compare);
  if (JSON.stringify(expectedNames) !== JSON.stringify(reportedNames) ||
      totalRecords !== report.totals.totalRows) {
    throw new Error("Analytics datasets or row totals do not match the Phase 6 report");
  }

  const errorCount = report.issues.filter((issue) => issue.severity === "ERROR").length;
  const warningCount = report.issues.filter((issue) => issue.severity === "WARNING").length;
  if (errorCount !== report.totals.errors || warningCount !== report.totals.warnings) {
    throw new Error("Analytics issue severity counts do not match the Phase 6 report");
  }

  const configurationError = report.status === "CONFIG_ERROR";
  const { validRows, invalidRows } = report.totals;
  if (configurationError
    ? validRows !== null || invalidRows !== null
    : validRows === null || invalidRows === null ||
      !Number.isSafeInteger(validRows) || !Number.isSafeInteger(invalidRows) ||
      validRows < 0 || invalidRows < 0 || validRows + invalidRows !== totalRecords) {
    throw new Error("Analytics row-validity totals are inconsistent with readiness status");
  }

  const invalidLocations = new Map<string, Set<number>>(
    expectedNames.map((name) => [name, new Set<number>()]),
  );
  const metrics = new Map<string, DatasetAnalytics>(
    expectedNames.map((name) => [name, {
      dataset: name,
      totalRows: byName.get(name)!.rows.length,
      validRows: null,
      invalidRows: null,
      blockingErrors: 0,
      warnings: 0,
      issueCount: 0,
    }]),
  );
  const distribution = new Map<string, IssueDistributionEntry>();
  const seenIssueIds = new Set<string>();
  let unassignedIssues = 0;

  for (const issue of report.issues) {
    if (seenIssueIds.has(issue.id)) {
      throw new Error(`Duplicate report issue ID '${issue.id}'`);
    }
    seenIssueIds.add(issue.id);
    const metric = metrics.get(issue.dataset);
    if (metric) {
      metric.issueCount++;
      if (issue.severity === "ERROR") metric.blockingErrors++;
      else metric.warnings++;
    } else {
      unassignedIssues++;
    }

    if (issue.category === "DATA" && issue.rowNumber !== null) {
      const locationSet = invalidLocations.get(issue.dataset);
      if (!locationSet || !byName.get(issue.dataset)!.rowNumbers.includes(issue.rowNumber)) {
        throw new Error(`Data issue '${issue.id}' points outside the supplied CSV row locations`);
      }
      if (issue.severity === "ERROR" && !configurationError) {
        locationSet.add(issue.rowNumber);
      }
    }

    const key = JSON.stringify([issue.code, issue.category, issue.severity]);
    const entry = distribution.get(key);
    if (entry) entry.count++;
    else distribution.set(key, {
      code: issue.code,
      category: issue.category,
      severity: issue.severity,
      count: 1,
    });
  }

  const datasetAnalytics = expectedNames.map((name) => {
    const metric = metrics.get(name)!;
    const invalid = invalidLocations.get(name)!.size;
    if (!configurationError) {
      metric.invalidRows = invalid;
      metric.validRows = metric.totalRows - invalid;
    }
    return metric;
  });
  if (!configurationError &&
      datasetAnalytics.reduce((sum, ds) => sum + (ds.invalidRows ?? 0), 0) !== invalidRows) {
    throw new Error("Analytics invalid-row totals do not match the Phase 6 report");
  }

  return {
    status: report.status,
    summary: {
      totalDatasets: expectedNames.length,
      totalRecords,
      validRows,
      invalidRows,
      blockingErrors: errorCount,
      warnings: warningCount,
      totalIssues: report.issues.length,
    },
    datasets: datasetAnalytics,
    issueDistribution: [...distribution.values()].sort((a, b) =>
      b.count - a.count || compare(a.code, b.code) ||
      compare(a.category, b.category) || compare(a.severity, b.severity)),
    unassignedIssues,
    readinessExplanation: explanations[report.status],
  };
}
