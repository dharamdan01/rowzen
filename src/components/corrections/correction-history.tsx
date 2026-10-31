"use client";

import { useState } from "react";
import { Button, Select } from "../ui/primitives";
import type { CorrectionActivityEntry, CorrectionActivityKind, CorrectionActivityState } from "../../lib/corrections/history";
import { MAX_RECENT_CORRECTION_EVENTS } from "../../lib/corrections/history";

const PAGE_SIZE = 10;
const activityTime = new Intl.DateTimeFormat("en-PK", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Karachi" });
type ActivityFilter = CorrectionActivityKind | "ALL";

export interface CorrectionHistoryProps {
  history: CorrectionActivityState;
}

function formatValue(value: string): string {
  return value === "" ? "(empty)" : value;
}

function ActivityItem({ entry }: { entry: CorrectionActivityEntry }) {
  return <li className="border-b border-border py-3 last:border-b-0">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="font-medium text-foreground">{`${entry.kind === "APPLY" ? "Applied" : entry.kind === "UNDO" ? "Undone" : "Redone"} · Change #${entry.operationSequence}`}</span>
      <time dateTime={entry.occurredAt} className="text-xs text-muted-foreground">
        {activityTime.format(new Date(entry.occurredAt))} PKT
      </time>
    </div>
    <p className="mt-2 text-sm text-foreground break-all">
      {`${entry.dataset} · CSV line ${entry.rowNumber} · column ${entry.column}`}
    </p>
    <div className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
      <div className="min-w-0"><span className="text-xs text-muted-foreground">Before</span><p className="rounded-md bg-surface-muted p-2 font-mono text-xs whitespace-pre-wrap [overflow-wrap:anywhere]">{formatValue(entry.beforeValue)}</p></div>
      <div className="min-w-0"><span className="text-xs text-muted-foreground">After</span><p className="rounded-md bg-surface-muted p-2 font-mono text-xs whitespace-pre-wrap [overflow-wrap:anywhere]">{formatValue(entry.afterValue)}</p></div>
    </div>
  </li>;
}

/** Actual successful actions only; never use this local timeline as a server audit record. */
export default function CorrectionHistory({ history }: CorrectionHistoryProps) {
  const [filter, setFilter] = useState<ActivityFilter>("ALL");
  const [page, setPage] = useState(1);
  const matching = history.entries.filter((entry) => filter === "ALL" || entry.kind === filter).slice().reverse();
  const totalPages = Math.max(1, Math.ceil(matching.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visible = matching.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return <section aria-labelledby="correction-history-title" className="min-w-0 space-y-4 pt-4">
    <div className="space-y-1">
      <h3 id="correction-history-title" className="text-lg font-semibold text-foreground">Correction activity history</h3>
      <p className="text-sm text-muted-foreground">
        Apply, Undo and Redo actions in this browser session. Times use your device clock and display in PKT. This history is not saved to the server.
      </p>
      <p className="text-xs text-muted-foreground">Shows up to the latest {MAX_RECENT_CORRECTION_EVENTS} events. Replacing CSV files or discarding all corrections clears this private history.</p>
    </div>
    <div className="flex flex-wrap items-end justify-between gap-3 rounded-lg border border-border bg-surface-muted p-3">
      <label className="block text-sm font-medium text-foreground">
        Activity type
        <Select aria-label="Activity type" className="mt-2" value={filter} onChange={(event) => { setFilter(event.target.value as ActivityFilter); setPage(1); }}>
          <option value="ALL">All actions</option>
          <option value="APPLY">Applied</option>
          <option value="UNDO">Undone</option>
          <option value="REDO">Redone</option>
        </Select>
      </label>
      <p role="status" className="text-sm text-muted-foreground">{`${matching.length} recorded action${matching.length === 1 ? "" : "s"}`}</p>
    </div>
    {matching.length === 0 ? <p className="rounded-lg border border-border p-3 text-sm text-muted-foreground">No correction actions recorded for this filter.</p> :
      <ol aria-label="Correction activity timeline" tabIndex={0} className="max-h-[32rem] space-y-2 overflow-auto rounded-md outline-offset-2">
        {visible.map((entry) => <ActivityItem key={entry.id} entry={entry} />)}
      </ol>}
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
      <p className="text-sm text-muted-foreground">{`Page ${safePage} of ${totalPages}`}</p>
      <div className="flex gap-2">
        <Button type="button" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>Previous activity</Button>
        <Button type="button" disabled={safePage >= totalPages} onClick={() => setPage(safePage + 1)}>Next activity</Button>
      </div>
    </div>
  </section>;
}
