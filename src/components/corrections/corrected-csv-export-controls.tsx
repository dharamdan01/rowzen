"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Button, Select } from "../ui/primitives";
import type { CorrectionState } from "../../lib/corrections/types";
import { getEffectiveCorrections } from "../../lib/corrections/engine";
import { prepareCorrectedCsvExport } from "../../lib/corrections/export";

/** Deliberate local download only; does not upload CSV or save report metadata. */
export default function CorrectedCsvExportControls({ state, onDownloadStarted }: { state: CorrectionState; onDownloadStarted?: () => void }) {
  const [datasetName, setDatasetName] = useState(state.current[0]?.name ?? "");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const selected = state.current.find((item) => item.name === datasetName) ?? state.current[0];
  const changes = getEffectiveCorrections(state);
  const localChanges = changes.filter((change) => change.dataset === selected?.name).length;

  function download() {
    if (!selected || changes.length === 0) return;
    setError("");
    setStatus("");
    try {
      const output = prepareCorrectedCsvExport(state, selected.name);
      const blob = new Blob([output.content], { type: output.contentType });
      const url = URL.createObjectURL(blob);
      try {
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = output.filename;
        anchor.hidden = true;
        document.body.appendChild(anchor);
        try { anchor.click(); onDownloadStarted?.(); } finally { anchor.remove(); }
      } finally {
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      setStatus(`Prepared ${output.filename} for local download. ${output.totalRows} records; ${output.changedCells} corrected cells in this dataset; ${output.formulaProtectedCells} formula-like values protected.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to create corrected CSV.");
    }
  }

  return (
    <section aria-labelledby="corrected-csv-export-title" className="min-w-0 space-y-4 rounded-lg border border-border bg-surface p-4 sm:p-5">
      <div className="space-y-2">
        <h2 id="corrected-csv-export-title" className="text-xl font-semibold text-foreground">Export corrected CSV records</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Download approved values, including all source rows and cell values. Draft edits are excluded.
          The CSV may contain personal or sensitive data. Nothing is uploaded.
        </p>
      </div>
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface-muted p-3 sm:flex-row sm:items-end">
        <label className="min-w-0 flex-1 text-sm font-medium text-foreground sm:max-w-md">
          Corrected CSV dataset
          <Select className="mt-2 w-full" aria-label="Corrected CSV dataset" value={selected?.name ?? ""}
            onChange={(event) => { setDatasetName(event.target.value); setError(""); setStatus(""); }}>
            {state.current.map((dataset) => <option key={dataset.name} value={dataset.name}>{dataset.filename}</option>)}
          </Select>
        </label>
        <Button type="button" variant="primary" disabled={!selected || changes.length === 0}
          onClick={download} aria-describedby="corrected-export-status" className="w-full sm:w-auto">
          <Download aria-hidden="true" className="h-4 w-4" /> Download corrected CSV
        </Button>
      </div>
      <p id="corrected-export-status" className="text-sm text-muted-foreground" role="status">
        {changes.length} current cell changes across all datasets; {localChanges} in the selected dataset.
        {changes.length === 0 ? " Approve a correction before exporting." : " Select each dataset to download it individually, including unchanged related datasets if needed."}
      </p>
      <p className="rounded-md bg-surface-muted p-3 text-sm leading-relaxed text-muted-foreground">
        Header order and rows are preserved. Formula-like values get an apostrophe prefix for spreadsheet safety,
        which changes their exported text. Review before importing. Exporting does not mean the dataset is READY.
      </p>
      {status && <p role="status" className="rounded-md border border-border p-3 text-sm text-foreground">{status}</p>}
      {error && <p role="alert" className="rounded-md border border-danger bg-danger-surface p-3 text-sm text-danger">{error}</p>}
    </section>
  );
}
