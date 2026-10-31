import type { DetailedWhatIfPreview, WhatIfPreview } from "../../lib/corrections/what-if";

const text = (count: number | null) => count === null ? "Not evaluated" : String(count);

/** Presentational only: predicted numbers are NEVER described as verified. */
export default function WhatIfPanel({ preview, findings, titleId = "what-if-title", canApply = true, compact = false }: {
  preview: WhatIfPreview; findings?: DetailedWhatIfPreview["findings"]; titleId?: string; canApply?: boolean; compact?: boolean;
}) {
  const items = [
    { name: "Readiness", before: preview.before.status.replaceAll("_", " "), after: preview.predicted.status.replaceAll("_", " ") },
    { name: "Datasets", before: text(preview.before.totalDatasets), after: text(preview.predicted.totalDatasets) },
    { name: "Total rows", before: text(preview.before.totalRecords), after: text(preview.predicted.totalRecords) },
    { name: "Valid rows", before: text(preview.before.validRows), after: text(preview.predicted.validRows) },
    { name: "Invalid rows", before: text(preview.before.invalidRows), after: text(preview.predicted.invalidRows) },
    { name: "Blocking errors", before: text(preview.before.blockingErrors), after: text(preview.predicted.blockingErrors) },
    { name: "Warnings", before: text(preview.before.warnings), after: text(preview.predicted.warnings) },
    { name: "Total issues", before: text(preview.before.totalIssues), after: text(preview.predicted.totalIssues) },
  ];
  const displayed = compact ? items.filter(item => item.before !== item.after) : items;
  return (
    <section aria-labelledby={titleId} data-testid="what-if-preview" className="min-w-0 space-y-3 rounded-lg border border-info bg-surface p-3 sm:p-4">
      <h3 id={titleId} className="text-base font-semibold text-foreground">What-if preview — predicted, not applied</h3>
      <p className="text-sm text-muted-foreground">
        This preview uses a temporary copy. Your data and correction history are unchanged. Deterministic preflight results do not establish business correctness.
      </p>
      <div className="overflow-x-auto rounded-md border border-border" role="region" aria-label="What-if before and predicted metrics" tabIndex={0}>
        <table className={compact ? "w-full min-w-88 text-left text-sm" : "w-full text-left text-sm"}>
          <caption className="sr-only">Current versus predicted validation metrics</caption>
          <thead className="bg-surface-muted"><tr className="border-b border-border">
            <th scope="col" className="p-2">Metric</th>
            <th scope="col" className="p-2">Current</th>
            <th scope="col" className="p-2">Predicted</th>
          </tr></thead>
          <tbody>{displayed.map((item) => <tr key={item.name} className="border-b border-border/50">
            <th scope="row" className="p-2 font-medium">{item.name}</th>
            <td className="p-2 tabular-nums">{item.before}</td>
            <td className={compact && item.before !== item.after ? "p-2 tabular-nums bg-info-surface font-medium" : "p-2 tabular-nums"}>{item.after}</td>
          </tr>)}</tbody>
        </table>
      </div>
      {compact && <p className="text-xs text-muted-foreground sm:hidden">Scroll the table to compare current and predicted metrics.</p>}
      {compact && <p className="text-xs text-muted-foreground">{displayed.length ? "Only changed metrics are shown. Other metrics are unchanged." : "No validation metrics change in this preview."}</p>}
      <p className="text-sm text-muted-foreground" role="status">
        Predicted resolved findings: {preview.resolvedIssueCount}; newly introduced findings: {preview.introducedIssueCount}.
        These counts describe issue identities, not distinct invalid CSV rows.
      </p>
      {findings && <div className="space-y-2 border-t border-border pt-3 text-sm" aria-label="Simulated findings">
        {(["resolved", "introduced", "remaining"] as const).map(kind => {
          const list = findings[kind], label = `${kind[0].toUpperCase()}${kind.slice(1)} findings: ${list.length}`;
          return list.length ? <details key={kind} className={kind === "introduced" ? "text-danger" : "text-foreground"}>
            <summary className="min-h-11 cursor-pointer content-center rounded-md font-medium">{label}</summary>
            <ul className="space-y-1 pl-4 [overflow-wrap:anywhere]">{list.slice(0, 10).map(item => <li key={item.id}>{item.code} · {item.dataset}{item.rowNumber === null ? " · Configuration" : ` · CSV line ${item.rowNumber}`}{item.column ? ` · ${item.column}` : ""}</li>)}</ul>
            {list.length > 10 && <p className="text-xs">Showing 10 of {list.length} findings.</p>}
          </details> : <p key={kind}>{label}</p>;
        })}
      </div>}
      <p className="text-sm font-medium text-foreground">{canApply ? "Apply correction to approve this edit and rerun validation." : "Review the findings. This preview does not qualify for Apply."}</p>
    </section>
  );
}
