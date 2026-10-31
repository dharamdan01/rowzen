/**
 * Phase 8 S5 — canonical browser-memory revalidation of an APPROVED snapshot.
 * Caller supplies the current state + existing Phase 6 configuration. This
 * function never applies edits, mutates datasets, stores CSV, or calls APIs.
 */
import type { ParsedCsv } from "../csv/parser";
import type { RehearsalReportV1 } from "../rehearsal/types";
import { applyMapping } from "../rehearsal/mapping";
import { runPreflight } from "../rehearsal/preflight";
import { buildReportAnalytics } from "../reports/analytics";
import type { ReportAnalytics } from "../reports/types";
import type { WhatIfConfiguration } from "./what-if";

export interface VerifiedCorrectionReport {
  readonly report: RehearsalReportV1;
  readonly analytics: ReportAnalytics;
}

/** Computes real Phase 6 + Phase 7 results for the provided current snapshot. */
export function revalidateCorrectionSnapshot(
  datasets: readonly ParsedCsv[],
  config: WhatIfConfiguration,
): VerifiedCorrectionReport {
  if (datasets.length === 0) throw new Error("Upload CSV datasets before validation.");
  const mapped = datasets.map((dataset) => {
    const mapping = config.mappings[dataset.name];
    if (!mapping) throw new Error(`Missing mapping for dataset '${dataset.name}'.`);
    return applyMapping(dataset, [...mapping]);
  });
  const report = runPreflight({
    datasets: mapped,
    rules: config.rules,
    relationships: config.relationships,
    keyRules: config.keyRules,
  });
  const analytics = buildReportAnalytics(report, mapped);
  return { report, analytics };
}
