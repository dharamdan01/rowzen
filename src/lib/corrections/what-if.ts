/**
 * Phase 8 S4: a pure what-if impact estimate using the EXISTING Phase 6 pipeline.
 * The proposed change is not approved or persisted; original/correction history
 * and report state remain untouched. Default output remains metrics-only;
 * optional browser-local findings omit values, prose, rule IDs and peer records.
 */
import type { ColumnMapping } from "../rehearsal/mapping";
import type { PreflightInput } from "../rehearsal/preflight";
import { revalidateCorrectionSnapshot } from "./revalidation";
import type { CorrectionState, CellEditRequest } from "./types";
import { applyCellCorrection } from "./engine";
import type { RehearsalIssue, RehearsalReportV1 } from "../rehearsal/types";

export type WhatIfConfiguration = {
  readonly mappings: Readonly<Record<string, readonly ColumnMapping[]>>;
  readonly rules: PreflightInput["rules"];
  readonly relationships: PreflightInput["relationships"];
  readonly keyRules?: PreflightInput["keyRules"];
};

export type WhatIfMetrics = Readonly<{
  status: RehearsalReportV1["status"];
  totalDatasets: number;
  totalRecords: number;
  validRows: number | null;
  invalidRows: number | null;
  blockingErrors: number;
  warnings: number;
  totalIssues: number;
}>;

export type WhatIfPreview = Readonly<{
  kind: "PREDICTED_NOT_APPLIED";
  before: WhatIfMetrics;
  predicted: WhatIfMetrics;
  difference: Readonly<{
    validRows: number | null;
    invalidRows: number | null;
    blockingErrors: number;
    warnings: number;
    totalIssues: number;
  }>;
  resolvedIssueCount: number;
  introducedIssueCount: number;
}>;

/** Browser-local finding metadata only: no values, rule IDs, prose or peer-record payloads. */
export type WhatIfFinding = Readonly<Pick<RehearsalIssue,
  "id" | "code" | "category" | "severity" | "dataset" | "rowNumber" | "column">>;
export type DetailedWhatIfPreview = WhatIfPreview & Readonly<{
  remainingIssueCount: number;
  findings: Readonly<{ resolved: readonly WhatIfFinding[]; remaining: readonly WhatIfFinding[]; introduced: readonly WhatIfFinding[] }>;
}>;
type PreviewOptions = { signal?: AbortSignal };

function evaluate(
  datasets: CorrectionState["current"], config: WhatIfConfiguration,
): { report: RehearsalReportV1; metrics: WhatIfMetrics } {
  const { report, analytics } = revalidateCorrectionSnapshot(datasets, config);
  const { summary } = analytics;
  return {
    report,
    metrics: Object.freeze({
      status: report.status,
      totalDatasets: summary.totalDatasets,
      totalRecords: summary.totalRecords,
      validRows: summary.validRows,
      invalidRows: summary.invalidRows,
      blockingErrors: summary.blockingErrors,
      warnings: summary.warnings,
      totalIssues: summary.totalIssues,
    }),
  };
}

function delta(before: number | null, after: number | null): number | null {
  return before === null || after === null ? null : after - before;
}

/** Calculates before/after impact. Never calls the UI approval callback. */
export function previewCellCorrection(
  state: CorrectionState, edit: CellEditRequest, config: WhatIfConfiguration,
  options: PreviewOptions & { includeFindings: true },
): DetailedWhatIfPreview;
export function previewCellCorrection(
  state: CorrectionState, edit: CellEditRequest, config: WhatIfConfiguration,
  options?: PreviewOptions & { includeFindings?: false },
): WhatIfPreview;
export function previewCellCorrection(
  state: CorrectionState,
  edit: CellEditRequest,
  config: WhatIfConfiguration,
  options: PreviewOptions & { includeFindings?: boolean } = {},
): WhatIfPreview | DetailedWhatIfPreview {
  options.signal?.throwIfAborted();
  const candidateState = applyCellCorrection(state, edit);
  if (candidateState === state) {
    throw new Error("Change the proposed value before requesting a preview.");
  }
  options.signal?.throwIfAborted();
  const baseline = evaluate(state.current, config);
  options.signal?.throwIfAborted();
  const candidate = evaluate(candidateState.current, config);
  options.signal?.throwIfAborted();
  const currentIds = new Set(baseline.report.issues.map((issue) => issue.id));
  const candidateIds = new Set(candidate.report.issues.map((issue) => issue.id));

  const preview: WhatIfPreview = Object.freeze({
    kind: "PREDICTED_NOT_APPLIED" as const,
    before: baseline.metrics,
    predicted: candidate.metrics,
    difference: Object.freeze({
      validRows: delta(baseline.metrics.validRows, candidate.metrics.validRows),
      invalidRows: delta(baseline.metrics.invalidRows, candidate.metrics.invalidRows),
      blockingErrors: candidate.metrics.blockingErrors - baseline.metrics.blockingErrors,
      warnings: candidate.metrics.warnings - baseline.metrics.warnings,
      totalIssues: candidate.metrics.totalIssues - baseline.metrics.totalIssues,
    }),
    resolvedIssueCount: [...currentIds].filter((id) => !candidateIds.has(id)).length,
    introducedIssueCount: [...candidateIds].filter((id) => !currentIds.has(id)).length,
  });
  if (!options.includeFindings) return preview;
  const project = (issues: readonly RehearsalIssue[]) => Object.freeze(issues.map(issue => Object.freeze({
    id: issue.id, code: issue.code, category: issue.category, severity: issue.severity,
    dataset: issue.dataset, rowNumber: issue.rowNumber, column: issue.column,
  })));
  const findings = Object.freeze({
    resolved: project(baseline.report.issues.filter(issue => !candidateIds.has(issue.id))),
    remaining: project(candidate.report.issues.filter(issue => currentIds.has(issue.id))),
    introduced: project(candidate.report.issues.filter(issue => !currentIds.has(issue.id))),
  });
  options.signal?.throwIfAborted();
  return Object.freeze({ ...preview, remainingIssueCount: findings.remaining.length, findings });
}
