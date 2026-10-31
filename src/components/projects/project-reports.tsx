"use client";
import Link from "next/link";
import { Button, LoadingState, StatusMessage } from "../ui/primitives";
import { readinessStyles } from "../reports/report-status";
import { projectDate, projectReportHref, projectReportsHref, runsResource } from "../../lib/projects/presentation";
import { useProjectResource } from "./use-project-resource";

const statusLabels = { READY: "Ready", READY_WITH_WARNINGS: "Ready with warnings", BLOCKED: "Blocked", CONFIG_ERROR: "Configuration error" };
export default function ProjectReports({ projectId, limit = 3 }: { projectId: string; limit?: number }) {
  const { state, retry } = useProjectResource(projectId, runsResource);
  if (state.phase === "loading") return <LoadingState className="p-3">Loading saved reports...</LoadingState>;
  if (state.phase === "error") return <div className="space-y-3"><StatusMessage tone="error">{state.message}</StatusMessage><Button type="button" onClick={retry}>Retry saved reports</Button></div>;
  const runs = state.value.runs;
  return <div className="space-y-4">
    <p className="text-sm text-muted-foreground"><span className="font-medium tabular-nums text-foreground">{runs.length}</span> recent saved {runs.length === 1 ? "summary" : "summaries"} (up to 50).</p>
    {runs.length === 0 ? <div className="rounded-lg bg-surface-muted p-4 text-sm"><p className="font-medium">No saved reports yet</p><p className="mt-1 text-muted-foreground">Run a validation in this project&apos;s workspace and save its summary.</p></div> :
      <ul aria-label="Recent saved summaries" className="divide-y divide-border">{runs.slice(0, limit).map(run => <li key={run.id} className="min-w-0 py-4 first:pt-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link href={projectReportHref(projectId, run.id)} className="inline-flex min-h-11 items-center rounded-md text-sm font-medium text-primary hover:underline" aria-label={"View saved summary " + run.id}>View summary</Link>
          <span className={"rounded-md border px-2 py-1 text-xs font-medium " + readinessStyles[run.status]}>{statusLabels[run.status]}</span>
        </div>
        <p className="text-sm text-muted-foreground">{run.totalRows.toLocaleString("en-PK")} rows · {run.issueCount.toLocaleString("en-PK")} findings</p>
        <time dateTime={run.createdAt} className="mt-1 block text-xs text-muted-foreground">{projectDate(run.createdAt)}</time>
      </li>)}</ul>}
    {runs.length > limit && <p className="text-xs text-muted-foreground">Showing the {limit} most recent of {runs.length} loaded summaries.</p>}
    <Link href={projectReportsHref(projectId)} className="inline-flex min-h-11 items-center rounded-md text-sm font-medium text-primary hover:underline">All project reports</Link>
    <p className="text-xs text-muted-foreground">Saved summaries contain metadata. Their status reflects configured preflight checks, not a completed database import.</p>
  </div>;
}
