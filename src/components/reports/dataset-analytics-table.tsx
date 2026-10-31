import { Table } from "../ui/primitives";
import type { DatasetAnalytics } from "../../lib/reports/types";

const formatCount = (value: number | null): string =>
  value === null ? "Not evaluated" : value.toLocaleString("en-US");

export default function DatasetAnalyticsTable({ datasets }: { datasets: readonly DatasetAnalytics[] }) {
  return (
    <section aria-labelledby="dataset-analytics-title" className="min-w-0 space-y-3">
      <div>
        <h3 id="dataset-analytics-title" tabIndex={-1} className="text-lg font-semibold text-foreground">Dataset breakdown</h3>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">Compare errors and warnings by dataset. Row validity stays unevaluated when configuration prevents checks.</p>
      </div>
      {datasets.length === 0 ? (
        <p role="status" className="rounded-lg border border-border bg-surface-muted p-4 text-sm text-muted-foreground">No uploaded datasets to analyze.</p>
      ) : (
        <Table scrollLabel="Dataset-level validation analytics" className="[&_thead_th:not(:first-child)]:text-right [&_tbody_td]:align-middle">
          <caption className="sr-only">Validation totals for each uploaded dataset</caption>
          <thead>
            <tr>
              {(["Dataset", "Records", "Valid rows", "Invalid rows", "Blocking errors", "Warnings", "All issues"] as const).map((label) => (
                <th key={label} scope="col">{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {datasets.map((item) => (
              <tr key={item.dataset}>
                <th scope="row" className="border-b border-border px-4 py-3 min-w-40 max-w-64 text-left font-medium [overflow-wrap:anywhere]">{item.dataset}</th>
                <td className="whitespace-nowrap text-right tabular-nums">{formatCount(item.totalRows)}</td>
                <td className="whitespace-nowrap text-right tabular-nums">{formatCount(item.validRows)}</td>
                <td className="whitespace-nowrap text-right tabular-nums">{formatCount(item.invalidRows)}</td>
                <td className="whitespace-nowrap text-right tabular-nums">{formatCount(item.blockingErrors)}</td>
                <td className="whitespace-nowrap text-right tabular-nums">{formatCount(item.warnings)}</td>
                <td className="whitespace-nowrap text-right tabular-nums">{formatCount(item.issueCount)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </section>
  );
}
