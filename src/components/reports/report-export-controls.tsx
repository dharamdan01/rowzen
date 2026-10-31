"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import type { RehearsalReportV1 } from "../../lib/rehearsal/types";
import type { ReportAnalytics } from "../../lib/reports/types";
import { prepareReportExport, type ReportExportKind } from "../../lib/reports/export";
import { Button } from "../ui/primitives";

/** All downloads happen locally. No fetch() or persistence occurs in this component. */
export default function ReportExportControls({ report, analytics, onDownloadStarted }: {
  onDownloadStarted?: () => void;
  report: RehearsalReportV1;
  analytics: ReportAnalytics;
}) {
  const [error, setError] = useState("");

  function download(kind: ReportExportKind) {
    setError("");
    try {
      const file = prepareReportExport(report, analytics, kind);
      const blob = new Blob([file.content], { type: file.contentType });
      const url = URL.createObjectURL(blob);
      try {
        const link = document.createElement("a");
        link.href = url;
        link.download = file.filename; // Fixed filenames; no user-supplied paths.
        link.hidden = true;
        document.body.appendChild(link);
        try { link.click(); onDownloadStarted?.(); } finally { link.remove(); }
      } finally {
        // Allow navigation/download to start before revoking the Blob URL.
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to prepare report export.");
    }
  }

  return (
    <section aria-labelledby="report-exports-title" className="min-w-0 space-y-3 rounded-lg border border-border bg-surface p-4 sm:p-5">
      <div>
        <h3 id="report-exports-title" className="text-lg font-semibold text-foreground">Export validation report</h3>
        <p className="mt-1 text-sm text-muted-foreground">Local metadata-only exports. No CSV source rows or cell values are included.</p>
      </div>
      <div className="grid gap-3 border-t border-border pt-3 lg:grid-cols-3">
        {([
          ["json", "Download privacy-safe JSON", "Full validation metadata and summary."],
          ["issues-csv", "Download issues CSV", "Issue locations, codes and severity."],
          ["datasets-csv", "Download dataset summary CSV", "Counts for each dataset; not source records."],
        ] as const).map(([kind, label, description]) => <div key={kind} className="min-w-0 space-y-1">
          <Button type="button" onClick={() => download(kind)} aria-describedby={`export-${kind}-help`} className="w-full">
            <Download aria-hidden="true" className="size-4 shrink-0" />{label}
          </Button>
          <p id={`export-${kind}-help`} className="text-sm leading-relaxed text-muted-foreground">{description}</p>
        </div>)}
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">Dataset/column names and physical line numbers can still be sensitive metadata. Review before sharing. CSV formula-like cells are prefixed for spreadsheet safety.</p>
      {error && <p role="alert" className="rounded-md border border-danger bg-danger-surface p-3 text-sm text-danger">{error}</p>}
    </section>
  );
}
