import { readinessStyles } from "./report-status";
import Link from "next/link";
import Form from "next/form";
import { FileCheck2, Search } from "lucide-react";
import { Button, Card, Input, Select, Table } from "../ui/primitives";
import {
  historyPageHref, historyDetailHref,
  type HistoryFilters,
  type HistoryStatus,
} from "../../lib/reports/history-filters";
import type { PaginatedValidationHistory } from "../../lib/services/paginated-results-history";

const dateFormatter = new Intl.DateTimeFormat("en-PK", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Karachi",
});

const statusOptions: readonly { value: HistoryStatus; text: string }[] = [
  { value: "ALL", text: "All statuses" },
  { value: "READY", text: "Ready" },
  { value: "READY_WITH_WARNINGS", text: "Ready with warnings" },
  { value: "BLOCKED", text: "Blocked" },
  { value: "CONFIG_ERROR", text: "Configuration error" },
];

const linkClass = "inline-flex min-h-11 items-center justify-center rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

export default function HistoryResults({
  filters,
  history,
}: {
  filters: HistoryFilters;
  history: PaginatedValidationHistory;
}) {
  const hasFilters = Boolean(filters.search || filters.projectId) || filters.status !== "ALL";
  const resetHref = filters.projectId ? historyPageHref({ ...filters, search: "", status: "ALL", order: "newest", pageSize: 10 }, 1) : "/results";
  const start = history.total === 0 ? 0 : (history.page - 1) * history.pageSize + 1;
  const end = Math.min(history.total, history.page * history.pageSize);

  return (
    <div className="space-y-6">
      <Card aria-labelledby="history-filter-title" className="space-y-5">
        <div>
          <h2 id="history-filter-title" className="text-xl font-semibold text-foreground">
            Find saved reports
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Search saved summaries by project name and readiness status. Each entry records a past browser-local run.
          </p>
        </div>
        {filters.projectId && <p className="text-sm text-muted-foreground">Reports are limited to the selected project. <Link href="/results" className="inline-flex min-h-11 items-center rounded-md font-semibold text-primary underline">Show all projects</Link></p>}
        <Form action="/results" role="search" className="grid gap-4 border-t border-border pt-4 sm:grid-cols-2 lg:grid-cols-4">
          {filters.projectId && <input type="hidden" name="projectId" value={filters.projectId} />}
          <div className="space-y-1">
            <label htmlFor="report-project-search" className="block text-sm font-medium text-foreground">Project name</label>
            <Input id="report-project-search" name="q" type="search" maxLength={80}
              defaultValue={filters.search} placeholder="Search projects" />
          </div>
          <div className="space-y-1">
            <label htmlFor="report-status" className="block text-sm font-medium text-foreground">Readiness status</label>
            <Select id="report-status" name="status" defaultValue={filters.status}>
              {statusOptions.map(option => <option value={option.value} key={option.value}>{option.text}</option>)}
            </Select>
          </div>
          <div className="space-y-1">
            <label htmlFor="report-order" className="block text-sm font-medium text-foreground">Sort by date</label>
            <Select id="report-order" name="order" defaultValue={filters.order}>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </Select>
          </div>
          <div className="space-y-1">
            <label htmlFor="report-page-size" className="block text-sm font-medium text-foreground">Rows per page</label>
            <Select id="report-page-size" name="pageSize" defaultValue={String(filters.pageSize)}>
              <option value="10">10</option><option value="25">25</option><option value="50">50</option>
            </Select>
          </div>
          <div className="flex flex-wrap items-center gap-3 sm:col-span-2 lg:col-span-4">
            <Button type="submit" variant="primary">
              <Search className="size-4" aria-hidden="true" /> Apply filters
            </Button>
            <Link href={resetHref} className={linkClass}>Reset filters</Link>
          </div>
        </Form>
      </Card>

      {history.total === 0 ? (
        <Card aria-labelledby="results-empty-title" className="text-center">
          <div className="mx-auto max-w-lg py-8 sm:py-12">
            <FileCheck2 aria-hidden="true" className="mx-auto mb-5 size-12 text-muted-foreground" />
            <h2 id="results-empty-title" className="text-xl font-semibold text-foreground">
              {hasFilters ? "No matching validation results" : "No validation results yet"}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {hasFilters
                ? "No reports match the selected project or filters. Only your own reports are searchable."
                : "Saved validation summaries will appear here after you save a rehearsal to a project."}
            </p>
            <Link href={hasFilters ? resetHref : "/upload"} className={`mt-6 ${linkClass}`}>
              {hasFilters ? "Clear search and filters" : "Open CSV workspace"}
            </Link>
          </div>
        </Card>
      ) : (
        <Card aria-labelledby="saved-results-title" className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 id="saved-results-title" className="text-xl font-semibold text-foreground">Saved validation history</h2>
              <p role="status" className="mt-1 text-sm text-muted-foreground">
                Showing {start}–{end} of {history.total} saved reports. Dates in Pakistan Standard Time (PKT).
              </p>
            </div>
            <Link href="/upload" className={linkClass}>Run another validation</Link>
          </div>

          <p id="history-scroll-help" className="text-sm text-muted-foreground">Scroll horizontally to see all columns. Focus the table and use the arrow keys.</p>
          <div className="min-w-0 [&_[role=region]]:max-h-[34rem]">
          <Table scrollLabel="Saved validation reports" aria-describedby="history-scroll-help" className="min-w-[52rem] table-fixed [&_tr>th]:px-3 [&_tr>td]:px-3 [&_tr>td]:align-middle [&_thead_th:nth-child(n+3):nth-child(-n+6)]:text-right">
            <colgroup>{[17, 14, 8, 11, 11, 7, 17, 15].map((width, index) => <col key={index} style={{ width: `${width}%` }} />)}</colgroup>
            <caption className="sr-only">Saved summary metadata for reports on projects you own</caption>
            <thead><tr>
              <th scope="col">Project</th><th scope="col">Status</th><th scope="col">Records</th>
              <th scope="col">Valid</th><th scope="col">Invalid</th><th scope="col">Issues</th><th scope="col">Saved at (PKT)</th><th scope="col">Details</th>
            </tr></thead>
            <tbody>{history.items.map(run => (
              <tr key={run.id}>
                <th scope="row" className="font-medium [overflow-wrap:anywhere]">{run.projectName}</th>
                <td><span className={`inline-block max-w-full rounded-md border px-2.5 py-1 text-xs font-semibold ${readinessStyles[run.status] ?? "border-border bg-surface-muted text-foreground"}`}>
                  {run.status.replaceAll("_", " ")}
                </span></td>
                <td className="whitespace-nowrap text-right tabular-nums">{run.totalRows}</td>
                <td className="text-right tabular-nums [overflow-wrap:normal]">{run.validRows === null ? "Not evaluated" : run.validRows}</td>
                <td className="text-right tabular-nums [overflow-wrap:normal]">{run.invalidRows === null ? "Not evaluated" : run.invalidRows}</td>
                <td className="whitespace-nowrap text-right tabular-nums">{run.issueCount}</td>
                <td className="text-xs leading-relaxed"><time dateTime={run.createdAt.toISOString()}>{dateFormatter.format(run.createdAt)}</time></td>
                <td><Link href={historyDetailHref(run.id, filters, history.page)} aria-label={`View summary for ${run.projectName}, ${dateFormatter.format(run.createdAt)} PKT`} className="inline-flex min-h-11 max-w-full items-center rounded-md font-semibold text-primary underline-offset-4 hover:underline">View summary</Link></td>
              </tr>
            ))}</tbody>
          </Table>
          </div>

          <nav aria-label="Report history pages" className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">Page {history.page} of {history.totalPages}</p>
            <div className="flex gap-2">
              {history.page > 1 ? (
                <Link className={linkClass} href={historyPageHref(filters, history.page - 1)}>Previous</Link>
              ) : <span aria-disabled="true" className="inline-flex min-h-11 items-center rounded-lg border border-border px-4 py-2.5 text-sm text-muted-foreground opacity-60">Previous</span>}
              {history.page < history.totalPages ? (
                <Link className={linkClass} href={historyPageHref(filters, history.page + 1)}>Next</Link>
              ) : <span aria-disabled="true" className="inline-flex min-h-11 items-center rounded-lg border border-border px-4 py-2.5 text-sm text-muted-foreground opacity-60">Next</span>}
            </div>
          </nav>
          <p className="text-sm text-muted-foreground">
            History includes summary metadata only. Original CSV rows and detailed issue lists are not stored. Open a summary for recorded counts, or run validation again to inspect individual issues.
            Multiple saved runs may belong to the same project; counts are not combined across runs.
          </p>
        </Card>
      )}
    </div>
  );
}
