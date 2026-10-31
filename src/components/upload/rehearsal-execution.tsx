import type { RehearsalReportV1 } from "../../lib/rehearsal/types";
import { Button, Card } from "../ui/primitives";

const outcomes = {
  READY: { label: "Ready", tone: "text-success bg-success-surface", next: "Review the report and its assumptions before importing." },
  READY_WITH_WARNINGS: { label: "Ready with warnings", tone: "text-warning bg-warning-surface", next: "Review the warnings before importing." },
  BLOCKED: { label: "Blocked", tone: "text-danger bg-danger-surface", next: "Review the reported issues, correct the data or settings, then run validation again." },
  CONFIG_ERROR: { label: "Configuration error", tone: "text-danger bg-danger-surface", next: "Review the schema and relationship issues in the report. Fix the settings, then run validation again." },
};

/** Reports only completed canonical results; the synchronous engine has no progress events. */
export default function RehearsalExecution({ report, datasetCount, relationshipCount, busy, error, onRun }: {
  report: RehearsalReportV1 | null;
  datasetCount: number;
  relationshipCount: number;
  busy: boolean;
  error: string;
  onRun: () => void;
}) {
  const outcome = report ? outcomes[report.status] : null;
  return (
    <Card id="rehearsal-execution" aria-labelledby="rehearsal-title" className="scroll-mt-6 space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Configured checks / browser-local run</p>
          <h2 id="rehearsal-title" className="text-xl font-semibold tracking-tight">Run validation</h2>
          <p className="text-sm text-muted-foreground">{datasetCount} {datasetCount === 1 ? "dataset" : "datasets"} · {relationshipCount} {relationshipCount === 1 ? "relationship" : "relationships"}</p>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">Uses the applied configuration from Configure. CSV data stays in this browser; no database import is performed.</p>
        </div>
        <Button type="button" variant="primary" onClick={onRun} disabled={busy} aria-describedby="execution-status" className="w-full shrink-0 sm:w-auto">Run Validation</Button>
      </div>
      <div id="execution-status" role="status" aria-atomic="true" className="space-y-2 rounded-lg border border-border bg-surface-muted p-4 text-sm">
        {busy ? <p>Reading CSV files. Validation will be available when reading finishes.</p> : outcome ? <>
          <p className="flex flex-wrap items-center gap-2"><span className="font-medium">Run finished</span><span className={`rounded-md px-2 py-1 font-semibold ${outcome.tone}`}>{outcome.label}</span></p>
          <p>{outcome.next}</p>
          {report?.totals.validRows === null && <p className="text-muted-foreground">Row validity was not evaluated. Review the configuration issues first.</p>}
          <a href="#validation-results" className="inline-flex min-h-11 items-center rounded-md font-semibold text-primary underline underline-offset-4">Review validation report</a>
        </> : <p>No current validation result. Run validation after reviewing or changing your configuration.</p>}
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">Only configured checks are evaluated. Unconfigured types and relationships are not inferred.</p>
      {error && <div role="alert" className="space-y-2 rounded-lg border border-danger bg-danger-surface p-4 text-sm text-danger [overflow-wrap:anywhere]">
        <p className="font-semibold">Action needed</p><p>{error}</p>
        <p>Review the configuration and try Run Validation again.</p>
      </div>}
    </Card>
  );
}
