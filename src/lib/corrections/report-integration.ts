/**
 * Phase 8 S8: deterministic report comparison using the same CURRENT mapping,
 * constraints and Phase 6 engine for original vs approved browser-memory rows.
 * Result intentionally contains no CSV values, row identifiers or issue details.
 */
import type { RehearsalReportV1 } from "../rehearsal/types";
import { getEffectiveCorrections } from "./engine";
import type { CorrectionState } from "./types";
import { revalidateCorrectionSnapshot } from "./revalidation";
import type { WhatIfConfiguration } from "./what-if";

export type SafeVerifiedMetrics = Readonly<{
  status: RehearsalReportV1["status"];
  totalRows: number;
  validRows: number | null;
  invalidRows: number | null;
  issueCount: number;
}>;

export type VerifiedCorrectionComparison = Readonly<{
  kind: "VERIFIED_APPROVED_CORRECTIONS";
  changedCells: number;
  affectedRecords: number;
  original: SafeVerifiedMetrics;
  current: SafeVerifiedMetrics;
  issueDelta: number;
  /** null means one or both reports did not evaluate row validity. */
  validRowDelta: number | null;
}>;

function safeMetrics(report: RehearsalReportV1): SafeVerifiedMetrics {
  return Object.freeze({
    status: report.status,
    totalRows: report.totals.totalRows,
    validRows: report.totals.validRows,
    invalidRows: report.totals.invalidRows,
    issueCount: report.issues.length,
  });
}

/** Run only against a verified CURRENT report. Never use a predicted what-if report. */
export function buildVerifiedCorrectionComparison(
  state: CorrectionState,
  verifiedCurrentReport: RehearsalReportV1,
  config: WhatIfConfiguration,
): VerifiedCorrectionComparison | null {
  const changes = getEffectiveCorrections(state);
  if (!changes.length) return null;
  const originalReport = revalidateCorrectionSnapshot(state.original, config).report;
  const original = safeMetrics(originalReport);
  const current = safeMetrics(verifiedCurrentReport);
  const recordIds = new Set(changes.map(({ dataset, rowNumber }) => JSON.stringify([dataset, rowNumber])));
  return Object.freeze({
    kind: "VERIFIED_APPROVED_CORRECTIONS",
    changedCells: changes.length,
    affectedRecords: recordIds.size,
    original,
    current,
    issueDelta: current.issueCount - original.issueCount,
    validRowDelta: original.validRows === null || current.validRows === null
      ? null : current.validRows - original.validRows,
  });
}
