import type { ReactNode } from "react";
import { readinessStyles } from "./report-status";
import type { ReportAnalytics } from "../../lib/reports/types";
import DatasetAnalyticsTable from "./dataset-analytics-table";
import ErrorDistributionChart from "./error-distribution-chart";
import SummaryCards from "./summary-cards";

export default function ReportAnalyticsDashboard({ analytics, children, view = "all" }: { analytics: ReportAnalytics; children?: ReactNode; view?: "all" | "summary" | "issues" | "dependencies" | "analytics" | "schema" }) {
  return (
    <div className="min-w-0 space-y-5" data-testid="report-analytics-dashboard">
      <div hidden={view !== "all" && view !== "summary"} className="space-y-5">
      <section aria-labelledby="readiness-heading" className={`rounded-lg border p-4 sm:p-5 ${readinessStyles[analytics.status]}`}>
        <p className="mb-2 text-xs font-medium">Current configured preflight</p>
        <h3 id="readiness-heading" className="text-lg font-semibold">Migration readiness: {analytics.status.replaceAll("_", " ")}</h3>
        <p className="mt-2 text-sm leading-relaxed">{analytics.readinessExplanation}</p>
        <p className="mt-3 border-t border-current/20 pt-3 text-sm">Static preflight only; database import execution was not performed.</p>
      </section>
      <SummaryCards summary={analytics.summary} />
      </div>
      <nav hidden={view !== "all"} aria-label="Report sections" className="flex flex-wrap gap-x-5 gap-y-1 text-sm font-semibold text-primary">
        {children && <a href="#issue-explorer-title" className="inline-flex min-h-11 items-center rounded-md underline-offset-4 hover:underline">Review issues</a>}
        <a href="#dataset-analytics-title" className="inline-flex min-h-11 items-center rounded-md underline-offset-4 hover:underline">Dataset breakdown</a>
        <a href="#issue-distribution-toggle" className="inline-flex min-h-11 items-center rounded-md underline-offset-4 hover:underline">Issue distribution</a>
      </nav>
      {children}
      <div data-review-view="analytics" hidden={view !== "all" && view !== "analytics"} className="space-y-5">
      <DatasetAnalyticsTable datasets={analytics.datasets} />
      <details className="rounded-lg border border-border bg-surface p-4">
        <summary id="issue-distribution-toggle" className="min-h-11 cursor-pointer content-center rounded-md font-semibold">Issue counts by code</summary>
        <ErrorDistributionChart distribution={analytics.issueDistribution} />
      </details>
      {analytics.unassignedIssues > 0 && (
        <p role="status" className="rounded-lg border border-border bg-surface-muted p-3 text-sm text-muted-foreground">
          {analytics.unassignedIssues} {analytics.unassignedIssues === 1 ? "issue is" : "issues are"} configuration/dependency findings not assigned to an uploaded dataset. They are included in the summary and issue distribution.
        </p>
      )}
      </div>
      <p className="border-t border-border pt-3 text-sm leading-relaxed text-muted-foreground">Dashboard metrics are calculated locally from this validation run. Saved project history contains summary metadata only.</p>
    </div>
  );
}
