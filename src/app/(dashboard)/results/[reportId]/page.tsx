import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "../../../../components/ui/primitives";
import { requireUser } from "../../../../lib/security/authorization";
import { getOwnedSummaryDetail } from "../../../../lib/services/owned-summary-detail";

export const instant = false;

const timeFormatter = new Intl.DateTimeFormat("en-PK", {
  dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Karachi",
});

export default async function SavedSummaryPage({ params }: {
  params: Promise<{ reportId: string }>;
}) {
  const user = await requireUser();
  const { reportId } = await params;
  const summary = await getOwnedSummaryDetail(user.id, reportId);
  if (!summary) notFound();

  const metric = (value: number | null) => value === null ? "Not evaluated" : String(value);
  return (
    <section aria-labelledby="saved-summary-title" className="space-y-6 sm:space-y-8">
      <header className="border-b border-border pb-6">
        <h1 id="saved-summary-title" className="text-2xl font-semibold sm:text-3xl">Saved validation summary</h1>
        <p className="mt-2 text-sm text-muted-foreground">Project: {summary.project.name}</p>
      </header>
      <Card aria-label="Saved report metadata" className="space-y-5">
        <h2 className="text-xl font-semibold">Recorded preflight outcome</h2>
        <dl className="grid gap-4 sm:grid-cols-2">
          {([
            ["Readiness", summary.status.replaceAll("_", " ")],
            ["Total records", String(summary.totalRows)],
            ["Valid rows", metric(summary.validRows)],
            ["Invalid rows", metric(summary.invalidRows)],
            ["Total issues", String(summary.issueCount)],
            ["Saved at (PKT)", timeFormatter.format(summary.createdAt)],
          ] as const).map(([label, value]) => (
            <div key={label} className="rounded-lg border border-border bg-surface-muted/50 p-4">
              <dt className="text-sm text-muted-foreground">{label}</dt>
              <dd className="mt-1 font-semibold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="text-sm text-muted-foreground">
          These counts were submitted by the authenticated browser. The server did not independently
          revalidate the CSV. This is saved summary metadata, not an import audit or stored corrected dataset.
          CSV values, correction activity and individual issues were not saved.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/results" className="inline-flex min-h-11 items-center rounded-lg border border-border px-4 py-2 text-sm font-semibold">All saved reports</Link>
          <Link href={`/upload?projectId=${encodeURIComponent(summary.projectId)}`} className="inline-flex min-h-11 items-center rounded-lg border border-border px-4 py-2 text-sm font-semibold">Open project in upload workspace</Link>
        </div>
      </Card>
    </section>
  );
}
