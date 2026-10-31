import Link from "next/link";
import { historyReturnHref } from "../../lib/reports/history-filters";
import PageHeader from "../layout/page-header";
import { Card } from "../ui/primitives";
import { readinessStyles } from "./report-status";
import type { getOwnedSummaryDetail } from "../../lib/services/owned-summary-detail";

type Summary = NonNullable<Awaited<ReturnType<typeof getOwnedSummaryDetail>>>;
const timeFormatter = new Intl.DateTimeFormat("en-PK", {
  dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Karachi",
});
const metric = (value: number | null) => value === null ? "Not evaluated" : value.toLocaleString("en-US");

export default function SavedSummary({ summary, returnTo }: { summary: Summary; returnTo?: string }) {
  return (
    <section aria-labelledby="saved-summary-title" className="min-w-0 space-y-6 sm:space-y-8">
      <PageHeader id="saved-summary-title" title="Saved validation summary" description={<>Project: {summary.project.name}</>} />
      <Card aria-label="Saved report metadata" className="space-y-5">
        <p className="text-sm font-medium text-muted-foreground">Historical snapshot / summary metadata only</p>
        <div className={`space-y-2 rounded-lg border p-4 ${readinessStyles[summary.status] ?? "border-border bg-surface-muted text-foreground"}`}>
          <h2 className="text-lg font-semibold">Recorded preflight outcome: {summary.status.replaceAll("_", " ")}</h2>
          <p className="text-sm">Saved browser checks only. No database import was performed or independently verified by the server.</p>
        </div>
        <p className="rounded-md bg-surface-muted px-3 py-2 text-sm text-muted-foreground">Saved at (PKT): <time dateTime={summary.createdAt.toISOString()}>{timeFormatter.format(summary.createdAt)}</time></p>
        <dl className="grid grid-cols-2 gap-5 rounded-lg border border-border bg-surface-muted p-4 sm:grid-cols-4">
          {([
            ["Total records", metric(summary.totalRows)],
            ["Valid rows", metric(summary.validRows)],
            ["Invalid rows", metric(summary.invalidRows)],
            ["Total issues", metric(summary.issueCount)],
          ] as const).map(([label, value]) => <div key={label} className="min-w-0">
            <dt className="text-sm text-muted-foreground">{label}</dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums [overflow-wrap:anywhere]">{value}</dd>
          </div>)}
        </dl>
        <div className="space-y-3 border-t border-border pt-5">
          <h3 className="font-semibold">Inspect individual issues</h3>
          <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">This summary has no dataset breakdown, error/warning split or individual findings. To investigate, open the workspace, select your CSV files and run validation again. CSV values and correction activity were not saved.</p>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link href={`/upload?projectId=${encodeURIComponent(summary.projectId)}`} className="inline-flex min-h-11 items-center justify-center rounded-lg border border-primary bg-primary px-4 py-2 text-center text-sm font-semibold text-primary-foreground hover:bg-primary-hover">Open project in upload workspace</Link>
            <Link href={historyReturnHref(returnTo)} className="inline-flex min-h-11 items-center justify-center rounded-lg border border-control-border px-4 py-2 text-sm font-semibold hover:bg-surface-muted">All saved reports</Link>
          </div>
        </div>
      </Card>
    </section>
  );
}
