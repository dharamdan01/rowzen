"use client";

import { useMemo } from "react";
import type { CorrectionState } from "../../lib/corrections/types";
import type { RehearsalReportV1 } from "../../lib/rehearsal/types";
import type { WhatIfConfiguration } from "../../lib/corrections/what-if";
import { buildVerifiedCorrectionComparison } from "../../lib/corrections/report-integration";
import { Card } from "../ui/primitives";

export default function ReportComparisonPanel({ state, verifiedReport, config }: {
  state: CorrectionState;
  verifiedReport: RehearsalReportV1;
  config: WhatIfConfiguration;
}) {
  const comparison = useMemo(() => {
    try {
      return buildVerifiedCorrectionComparison(state, verifiedReport, config);
    } catch {
      // Do not display misleading comparisons when configuration cannot be re-evaluated.
      return null;
    }
  }, [state, verifiedReport, config]);
  if (!comparison) return null;

  const { original, current } = comparison;
  const value = (count: number | null) => count === null ? "Not evaluated" : String(count);
  return (
    <Card aria-label="Verified correction impact" className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Original vs corrected validation</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Verified using the same current mapping and rules for original and approved corrected rows.
          This is not a what-if prediction or a database import.
        </p>
      </div>
      <p role="status" className="text-sm text-foreground">
        {comparison.changedCells} changed cells across {comparison.affectedRecords} affected records.
        Corrections and original CSV values remain in browser memory.
      </p>
      <div role="region" aria-label="Original and corrected summary" tabIndex={0} className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-96 text-left text-sm">
          <thead className="bg-surface-muted">
            <tr><th scope="col" className="p-3">Metric</th><th scope="col" className="p-3">Original</th><th scope="col" className="p-3">Verified corrected</th></tr>
          </thead>
          <tbody className="[&_td]:border-t [&_td]:border-border [&_td]:p-3">
            <tr><th scope="row" className="p-3">Readiness</th><td>{original.status.replaceAll("_", " ")}</td><td>{current.status.replaceAll("_", " ")}</td></tr>
            <tr><th scope="row" className="p-3">Records</th><td>{original.totalRows}</td><td>{current.totalRows}</td></tr>
            <tr><th scope="row" className="p-3">Valid rows</th><td>{value(original.validRows)}</td><td>{value(current.validRows)}</td></tr>
            <tr><th scope="row" className="p-3">Invalid rows</th><td>{value(original.invalidRows)}</td><td>{value(current.invalidRows)}</td></tr>
            <tr><th scope="row" className="p-3">Issues</th><td>{original.issueCount}</td><td>{current.issueCount}</td></tr>
          </tbody>
        </table>
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">
        Issue change: {comparison.issueDelta > 0 ? "+" : ""}{comparison.issueDelta}.
        Saved project reports store only the verified corrected summary at the time you explicitly click Save validation summary.
        Earlier saved reports are not overwritten.
      </p>
    </Card>
  );
}
