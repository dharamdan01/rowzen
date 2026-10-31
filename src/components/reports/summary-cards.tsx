import type { ReportAnalytics } from "../../lib/reports/types";

type Summary = ReportAnalytics["summary"];

export default function SummaryCards({ summary }: { summary: Summary }) {
  const cards = [
    { title: "Blocking errors", value: summary.blockingErrors, subtitle: "Must be resolved", tone: summary.blockingErrors > 0 ? "text-danger" : "text-foreground" },
    { title: "Warnings", value: summary.warnings, subtitle: "Review before importing", tone: summary.warnings > 0 ? "text-warning" : "text-foreground" },
    { title: "Invalid rows", value: summary.invalidRows, subtitle: "Distinct rows with blocking data errors", tone: "text-foreground" },
    { title: "Valid rows", value: summary.validRows, subtitle: "Distinct evaluated rows", tone: "text-foreground" },
    { title: "Total records", value: summary.totalRecords, subtitle: "Parsed data rows", tone: "text-foreground" },
    { title: "Datasets", value: summary.totalDatasets, subtitle: "CSV datasets included", tone: "text-foreground" },
    { title: "Total issues", value: summary.totalIssues, subtitle: "Errors plus warnings", tone: "text-foreground" },
  ];
  return (
    <section aria-labelledby="report-summary-title" className="space-y-3">
      <h3 id="report-summary-title" className="text-lg font-semibold text-foreground">Validation overview</h3>
      <dl className="grid grid-cols-2 gap-x-5 gap-y-5 rounded-lg border border-border bg-surface p-4 sm:grid-cols-3 sm:p-5 xl:grid-cols-4">
        {cards.map(({ title, value, subtitle, tone }, index) => (
          <div key={title} className="min-w-0 border-l-2 border-border pl-3">
            <dt className="text-sm font-medium text-muted-foreground">{title}</dt>
            <dd className={`mt-1 font-semibold tabular-nums ${index < 2 ? "text-3xl" : "text-2xl"} ${tone}`}>
              {value === null ? <span className="text-base">Not evaluated</span> : value.toLocaleString("en-US")}
            </dd>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{subtitle}</p>
          </div>
        ))}
      </dl>
      <p className="text-sm leading-relaxed text-muted-foreground">A single row can produce multiple issues. Invalid rows and total issues are different metrics.</p>
    </section>
  );
}
