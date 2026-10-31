import SeverityBadge from "./report-status";
import type { ForeignKeyDeclaration } from "../../lib/rehearsal/foreign-keys";
import type { RehearsalReportV1 } from "../../lib/rehearsal/types";
import { buildReadinessInsights } from "../../lib/reports/readiness-insights";

export default function ReadinessInsightsPanel({
  report, relationships,
}: {
  report: RehearsalReportV1;
  relationships: readonly ForeignKeyDeclaration[];
}) {
  const insights = buildReadinessInsights(report, relationships);
  return (
    <section aria-labelledby="action-plan-heading" className="min-w-0 space-y-4 border-t border-border pt-6" data-testid="readiness-insights">
      <div>
        <h3 id="action-plan-heading" className="text-lg font-semibold text-foreground">Readiness action plan</h3>
        <p className="mt-1 text-sm text-muted-foreground">Start with configuration and dependency errors, then data errors and warnings.</p>
      </div>
      <p className="text-sm text-foreground">
        <strong>{insights.blockingErrors}</strong> blocking {insights.blockingErrors === 1 ? "issue" : "issues"} and <strong>{insights.warnings}</strong> {insights.warnings === 1 ? "warning" : "warnings"}.
      </p>
      {insights.actions.length === 0 ? (
        <p role="status" className="rounded-md bg-surface-muted p-3 text-sm text-muted-foreground">No validation findings to investigate for this run.</p>
      ) : (
        <ol className="grid gap-x-6 gap-y-4 lg:grid-cols-2" aria-label="Prioritized validation actions">
          {insights.actions.map((action, index) => (
            <li key={JSON.stringify([action.category, action.severity, action.code])} className="min-w-0 border-l-2 border-border py-1 pl-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-foreground">{index + 1}. {action.code.replaceAll("_", " ")}</span>
                <SeverityBadge severity={action.severity} /><span className="text-xs text-muted-foreground">{action.category}</span>
              </div>
              <p className="mt-1 text-sm text-foreground">{action.count} {action.count === 1 ? "finding" : "findings"}{action.affectedRows ? ` across ${action.affectedRows} distinct CSV ${action.affectedRows === 1 ? "row" : "rows"}` : ""}.</p>
              {action.datasets.length > 0 && <p className="mt-1 text-sm text-muted-foreground [overflow-wrap:anywhere]">Datasets: {action.datasets.join(", ")}</p>}
              {action.investigations.length > 0 && (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-foreground">
                  {action.investigations.map((investigation) => <li key={investigation} className="[overflow-wrap:anywhere]">{investigation}</li>)}
                </ul>
              )}
            </li>
          ))}
        </ol>
      )}
      <p className="text-sm leading-relaxed text-muted-foreground">All recommendations are based on configured CSV preflight checks. Target database constraints, triggers, external records and actual execution remain unverified.</p>
    </section>
  );
}
