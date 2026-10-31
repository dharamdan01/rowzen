import { AlertCircle, ArrowRight, FileSpreadsheet } from "lucide-react";
import type { ParsedCsv } from "../../lib/csv/parser";
import { LoadingState, Table } from "../ui/primitives";

export function UploadFeedback({ busy, error, hasCurrentData = false }: { busy: boolean; error: string; hasCurrentData?: boolean }) {
  return (
    <>
      {busy && <LoadingState>Reading CSV files...</LoadingState>}
      {error && <div role="alert" className="flex min-w-0 items-start gap-3 rounded-lg border border-danger bg-danger-surface p-4 text-danger">
        <AlertCircle aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold">Action needed</p>
          <p className="text-sm leading-relaxed [overflow-wrap:anywhere]">{error}</p>
          {hasCurrentData && <p className="text-sm leading-relaxed">Your previous selection, settings and corrections are still available. Choose corrected files to try again.</p>}
        </div>
      </div>}
    </>
  );
}

export function DatasetList({ datasets }: { datasets: readonly ParsedCsv[] }) {
  if (!datasets.length) return null;
  // Target IDs contain encoded filenames; escape the fragment separately for spaces and percent signs.
  return (
    <section aria-labelledby="uploaded-datasets-title" className="min-w-0 space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="uploaded-datasets-title" className="text-lg font-semibold text-foreground">Selected datasets</h2>
        <p role="status" className="text-sm text-muted-foreground">{datasets.length} {datasets.length === 1 ? "dataset" : "datasets"} parsed</p>
      </div>
      <ul role="list" className="divide-y divide-border rounded-lg border border-border bg-surface">
        {datasets.map((dataset) => <li key={dataset.name} className="min-w-0">
          <a href={`#${encodeURIComponent(`dataset-${encodeURIComponent(dataset.name)}`)}`} className="flex min-h-control min-w-0 items-center gap-3 rounded-lg px-4 py-3 hover:bg-surface-hover sm:gap-4">
            <FileSpreadsheet aria-hidden="true" className="size-5 shrink-0 text-primary" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-foreground [overflow-wrap:anywhere]">{dataset.filename}</span>
              <span className="mt-0.5 block text-sm text-muted-foreground">{dataset.rows.length.toLocaleString("en-US")} rows · {dataset.headers.length.toLocaleString("en-US")} columns</span>
            </span>
            <span className="shrink-0 text-sm font-medium text-primary">Configure<span className="sr-only"> {dataset.filename}</span></span>
            <ArrowRight aria-hidden="true" className="hidden size-4 shrink-0 text-primary sm:block" />
          </a>
        </li>)}
      </ul>
      <p className="text-sm text-muted-foreground">Choosing files again replaces this selection after every file parses successfully.</p>
    </section>
  );
}

export function CsvPreview({ dataset }: { dataset: ParsedCsv }) {
  return (
    <div className="min-w-0 space-y-3">
      <div>
        <h3 className="text-base font-semibold text-foreground">Original CSV preview (first 5 rows)</h3>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">Original values; approved edits appear in the correction workspace.</p>
      </div>
      <div className="min-w-0 [&_[role=region]]:max-h-80">
      <Table scrollLabel={`Preview of ${dataset.filename}`}>
        <caption className="sr-only">First {Math.min(5, dataset.rows.length)} data rows from {dataset.filename}, with physical CSV line numbers</caption>
        <thead><tr>
          <th scope="col" className="w-20 whitespace-nowrap">CSV line</th>
          {dataset.headers.map((header) => <th scope="col" className="min-w-28" key={header}>{header}</th>)}
        </tr></thead>
        <tbody>{dataset.rows.slice(0, 5).map((row, index) => <tr key={`${dataset.name}-${index}`}>
          <th scope="row" className="font-mono text-xs font-normal tabular-nums text-muted-foreground">{dataset.rowNumbers[index]}</th>
          {dataset.headers.map((header) => <td key={header} className="min-w-28 whitespace-pre-wrap">{row[header]}</td>)}
        </tr>)}</tbody>
      </Table>
      </div>
      <p className="text-sm text-muted-foreground">Showing {Math.min(5, dataset.rows.length)} of {dataset.rows.length.toLocaleString("en-US")} rows.</p>
    </div>
  );
}
