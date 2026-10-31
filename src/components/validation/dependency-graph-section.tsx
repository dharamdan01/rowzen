import DependencyGraph from "./dependency-graph";
import type { ForeignKeyDeclaration } from "../../lib/rehearsal/foreign-keys";
import type { RehearsalReportV1 } from "../../lib/rehearsal/types";

/** Keep the graph discoverable after validation while retaining manual collapse. */
export default function DependencyGraphSection({ report, relationships }: {
  report: RehearsalReportV1;
  relationships: readonly ForeignKeyDeclaration[];
}) {
  return (
    <details open className="min-w-0 rounded-lg border border-border bg-surface p-4 sm:p-5">
      <summary className="min-h-11 cursor-pointer content-center rounded-md font-semibold">Import order and dependencies</summary>
      <div className="min-w-0 pt-4"><DependencyGraph report={report} relationships={relationships} /></div>
    </details>
  );
}
