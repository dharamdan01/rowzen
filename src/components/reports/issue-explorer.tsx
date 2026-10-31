"use client";

import { useMemo, useState } from "react";
import type { RehearsalIssue, IssueCategory, IssueCode, IssueSeverity } from "../../lib/rehearsal/types";
import {
  filterAndPaginateIssues,
  type IssueSortField,
  type IssueSortDirection,
} from "../../lib/reports/filters";
import { Button, Input, Select, Table } from "../ui/primitives";

import SeverityBadge from "./report-status";

type FilterValue<T extends string> = T | "ALL";

type LocationActions = { onLocate?: (issue: RehearsalIssue) => void; canLocate?: (issue: RehearsalIssue) => boolean; onExplain?: (issue: RehearsalIssue) => void };

function IssueDescription({ issue, onLocate, canLocate, onExplain }: { issue: RehearsalIssue } & LocationActions) {
  return (
    <>
      <p className="leading-relaxed">{issue.explanation}</p>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground"><strong className="font-medium text-foreground">Next step:</strong> {issue.suggestedInvestigation}</p>
      {onLocate && canLocate?.(issue) && <Button type="button" className="mt-2" aria-label={`Locate ${issue.dataset} CSV line ${issue.rowNumber}${issue.column ? ` column ${issue.column}` : ""}`} onClick={() => onLocate(issue)}>Locate {issue.column ? "cell" : "record"}</Button>}
      {onExplain && <Button type="button" className="mt-2 sm:ml-2" aria-label={`Explain ${issue.code} in ${issue.dataset}${issue.rowNumber === null ? " configuration" : ` CSV line ${issue.rowNumber}`} with AI`} onClick={() => onExplain(issue)}>Explain this issue with AI</Button>}
      <details className="mt-2">
        <summary className="min-h-11 cursor-pointer content-center rounded-md text-sm font-medium text-primary">Technical details</summary>
        <div className="mt-2 space-y-1 text-sm text-muted-foreground [overflow-wrap:anywhere]">
          <p><strong>Category:</strong> {issue.category}</p>
          <p><strong>Issue ID:</strong> <code>{issue.id}</code></p>
          <p><strong>Rule:</strong> <code>{issue.ruleId}</code></p>
          {issue.referencedRecords.length > 0 && <p>
            <strong>Referenced rows:</strong> {issue.referencedRecords.map((r) => `${r.dataset}:${r.rowNumber}`).join(", ")}
          </p>}
          {issue.relatedIssueIds.length > 0 && <p>
            <strong>Related issue IDs:</strong> {issue.relatedIssueIds.join(", ")}
          </p>}
        </div>
      </details>
    </>
  );
}

/** Present Phase 6 structured issues without changing source data or validation algorithms. */
export default function IssueExplorer({ issues, onLocate, canLocate, onExplain, focusIssueIds, onClearFocus }: {
  issues: readonly RehearsalIssue[]; focusIssueIds?: readonly string[]; onClearFocus?: () => void;
} & LocationActions) {
  const [search, setSearch] = useState("");
  const [dataset, setDataset] = useState("ALL");
  const [severity, setSeverity] = useState<FilterValue<IssueSeverity>>("ALL");
  const [category, setCategory] = useState<FilterValue<IssueCategory>>("ALL");
  const [code, setCode] = useState<FilterValue<IssueCode>>("ALL");
  const [sortBy, setSortBy] = useState<IssueSortField>("dataset");
  const [sortDirection, setSortDirection] = useState<IssueSortDirection>("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const scopedIssues = useMemo(() => focusIssueIds ? issues.filter(issue => focusIssueIds.includes(issue.id)) : issues, [issues, focusIssueIds]);
  const view = useMemo(
    () => filterAndPaginateIssues(scopedIssues, {
      search, dataset, severity, category, code,
      sortBy, sortDirection, page, pageSize,
    }),
    [scopedIssues, search, dataset, severity, category, code, sortBy, sortDirection, page, pageSize],
  );

  const changeFilter = (setter: (value: string) => void, value: string) => {
    setter(value);
    setPage(1);
  };

  const reset = () => {
    setSearch(""); setDataset("ALL"); setSeverity("ALL"); setCategory("ALL");
    setCode("ALL"); setSortBy("dataset"); setSortDirection("asc"); setPage(1); setPageSize(10);
  };

  return (
    <section aria-labelledby="issue-explorer-title" className="min-w-0 space-y-4 border-t border-border pt-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 max-w-2xl">
          <h3 id="issue-explorer-title" tabIndex={-1} className="text-xl font-semibold tracking-tight text-foreground">
            Issue explorer
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Errors block readiness; warnings need review. Locate findings by CSV line and target column.
          </p>
        </div>
        <Button type="button" onClick={reset}>Reset filters</Button>
      </div>

      {focusIssueIds && <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-surface-muted p-3 text-sm">
        <p>AI evidence scope: {scopedIssues.length} of {issues.length} report findings. Filters below still apply.</p>
        {onClearFocus && <Button type="button" onClick={onClearFocus}>Show all report issues</Button>}
      </div>}

      <div role="group" aria-label="Issue filters" className="grid gap-3 rounded-lg border border-border bg-surface p-3 sm:grid-cols-2 sm:p-4 xl:grid-cols-3">
        <label className="block text-sm font-medium text-foreground xl:col-span-2">
          Search issues
          <Input className="mt-1" value={search} type="search" placeholder="Dataset, column, code or explanation" aria-controls="issue-results" aria-describedby="issue-filter-count"
            onChange={(e) => changeFilter(setSearch, e.target.value)} />
        </label>
        <label className="block text-sm font-medium text-foreground">
          Dataset
          <Select className="mt-1" value={dataset} onChange={(e) => changeFilter(setDataset, e.target.value)}>
            <option value="ALL">All datasets</option>
            {view.availableDatasets.map((name) => <option key={name} value={name}>{name}</option>)}
          </Select>
        </label>
        <label className="block text-sm font-medium text-foreground">
          Severity
          <Select className="mt-1" value={severity} onChange={(e) => changeFilter((value) => setSeverity(value as FilterValue<IssueSeverity>), e.target.value)}>
            <option value="ALL">All severities</option>
            <option value="ERROR">Error</option>
            <option value="WARNING">Warning</option>
          </Select>
        </label>
        <label className="block text-sm font-medium text-foreground">
          Category
          <Select className="mt-1" value={category} onChange={(e) => changeFilter((value) => setCategory(value as FilterValue<IssueCategory>), e.target.value)}>
            <option value="ALL">All categories</option>
            <option value="DATA">Data</option>
            <option value="SCHEMA">Schema</option>
            <option value="DEPENDENCY">Dependency</option>
          </Select>
        </label>
        <label className="block text-sm font-medium text-foreground">
          Error code
          <Select className="mt-1" value={code} onChange={(e) => changeFilter((value) => setCode(value as FilterValue<IssueCode>), e.target.value)}>
            <option value="ALL">All codes</option>
            {view.availableCodes.map((value) => <option key={value} value={value}>{value}</option>)}
          </Select>
        </label>
      </div>
      <details className="rounded-lg border border-border bg-surface px-4">
        <summary className="min-h-11 cursor-pointer content-center rounded-md text-sm font-semibold">Sorting and page size</summary>
        <div className="grid gap-3 pb-4 sm:grid-cols-3">
          <label className="block text-sm font-medium text-foreground">
            Sort by
            <Select className="mt-1" value={sortBy} onChange={(e) => { setSortBy(e.target.value as IssueSortField); setPage(1); }}>
              <option value="dataset">Dataset</option>
              <option value="rowNumber">CSV line</option>
              <option value="code">Error code</option>
              <option value="severity">Severity</option>
              <option value="category">Category</option>
            </Select>
          </label>
          <label className="block text-sm font-medium text-foreground">
            Sort direction
            <Select className="mt-1" value={sortDirection} onChange={(e) => { setSortDirection(e.target.value as IssueSortDirection); setPage(1); }}>
              <option value="asc">Ascending</option>
              <option value="desc">Descending</option>
            </Select>
          </label>
          <label className="block text-sm font-medium text-foreground">
            Issues per page
            <Select className="mt-1" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
              {[10, 25, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}
            </Select>
          </label>
        </div>
      </details>

      <p id="issue-filter-count" role="status" aria-live="polite" aria-atomic="true" className="rounded-md bg-surface-muted px-3 py-2 text-sm tabular-nums text-muted-foreground">
        Showing {view.from}–{view.to} of {view.filteredIssues} matching {view.filteredIssues === 1 ? "issue" : "issues"} ({view.totalIssues} total)
      </p>

      <div id="issue-results">
      {view.filteredIssues === 0 ? (
        <p className="rounded-lg border border-border bg-surface-muted p-4 text-sm text-muted-foreground" role="status">
          {issues.length === 0 ? "No validation issues in this report." : "No issues match the selected filters."}
        </p>
      ) : (
        <>
        <ul aria-label="Filtered validation issues" className="divide-y divide-border border-y border-border sm:hidden">
          {view.issues.map(issue => <li key={issue.id} className="space-y-2 py-3 [overflow-wrap:anywhere]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <strong className="min-w-0 text-sm font-semibold">{issue.dataset}</strong>
              <SeverityBadge severity={issue.severity} />
            </div>
            <p className="text-sm text-muted-foreground">{issue.rowNumber === null ? "Dataset-level finding" : `CSV line ${issue.rowNumber}`}{issue.column && <> / <code className="text-foreground">{issue.column}</code></>}</p>
            <p className="font-mono text-xs text-muted-foreground">{issue.code}</p>
            <IssueDescription issue={issue} onLocate={onLocate} canLocate={canLocate} onExplain={onExplain} />
          </li>)}
        </ul>
        <div className="hidden min-w-0 sm:block [&_[role=region]]:max-h-[38rem]">
        <Table id="issue-table" scrollLabel="Filtered validation issues">
          <caption className="sr-only">Filtered and paginated validation findings</caption>
          <thead><tr>
            {"Dataset,CSV line,Column,Severity,Code,Explanation".split(",").map((name) => <th key={name} scope="col">{name}</th>)}
          </tr></thead>
          <tbody>
            {view.issues.map((issue) => (
              <tr key={issue.id}>
                <th scope="row" className="min-w-32 max-w-48 text-left align-top font-medium [overflow-wrap:anywhere]">{issue.dataset}</th>
                <td className="whitespace-nowrap tabular-nums">{issue.rowNumber ?? "Dataset-level"}</td>
                <td className="min-w-40 max-w-56 font-mono text-xs">{issue.column ?? "—"}</td>
                <td><SeverityBadge severity={issue.severity} /></td>
                <td className="min-w-32 max-w-48 font-mono text-xs">{issue.code}</td>
                <td className="min-w-72 max-w-xl">
                  <IssueDescription issue={issue} onLocate={onLocate} canLocate={canLocate} onExplain={onExplain} />
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
        </div>
        </>
      )}

      </div>

      <nav aria-label="Issue pages" className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
        <p className="text-sm text-muted-foreground" aria-live="polite">Page {view.page} of {view.totalPages}</p>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" disabled={view.page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</Button>
          <Button type="button" disabled={view.page >= view.totalPages} onClick={() => setPage((current) => Math.min(view.totalPages, current + 1))}>Next</Button>
        </div>
      </nav>
    </section>
  );
}
