"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { IssueDistributionEntry } from "../../lib/reports/types";
import { Table } from "../ui/primitives";

export default function ErrorDistributionChart({ distribution }: {
  distribution: readonly IssueDistributionEntry[];
}) {
  // The Phase 7 analytics module returns a stable order; don't alter its values.
  const chartData = distribution.map((entry) => ({
    label: `${entry.code} (${entry.severity})`,
    count: entry.count,
  }));

  return (
    <section aria-labelledby="issue-distribution-title" className="min-w-0 space-y-4">
      <div>
        <h3 id="issue-distribution-title" className="text-lg font-semibold text-foreground">Issue distribution</h3>
        <p className="mt-1 text-sm text-muted-foreground">Counts represent individual issue entries, not distinct invalid CSV rows.</p>
      </div>
      {distribution.length === 0 ? (
        <p role="status" className="rounded-lg border border-border bg-surface-muted p-4 text-sm text-muted-foreground">
          No validation issues were reported for this rehearsal.
        </p>
      ) : (
        <>
          <div role="img" aria-label="Bar chart of reported issue entries by code and severity" className="h-72 w-full min-w-0 text-primary" data-testid="distribution-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ top: 8, right: 20, bottom: 8, left: 12 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} domain={[0, "dataMax"]} />
                <YAxis type="category" dataKey="label" width={170} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value) => [value, "Issues"]} />
                <Bar name="Issues" dataKey="count" fill="currentColor" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <Table scrollLabel="Accessible issue distribution data">
            <caption className="sr-only">Exact issue distribution shown by the chart</caption>
            <thead><tr><th scope="col">Issue code</th><th scope="col">Category</th><th scope="col">Severity</th><th scope="col">Count</th></tr></thead>
            <tbody>
              {distribution.map((entry) => (
                <tr key={JSON.stringify([entry.code, entry.category, entry.severity])}>
                  <th scope="row" className="border-b border-border px-4 py-3 text-left font-medium">{entry.code}</th>
                  <td>{entry.category}</td>
                  <td>{entry.severity}</td>
                  <td className="tabular-nums">{entry.count}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </>
      )}
    </section>
  );
}
