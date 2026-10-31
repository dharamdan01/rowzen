"use client";

import { useState } from "react";
import type { WorkspaceSchemaDescriptor } from "../../lib/schema-diagram/types";
import { assertDiagramExportCurrent, DiagramExportError, diagramExportMessages, prepareSchemaDiagramSvgExport } from "../../lib/schema-diagram/export";
import { Button } from "../ui/primitives";

export default function SchemaDiagramExportControls({ descriptor, isCurrent, disabled }: {
  descriptor: WorkspaceSchemaDescriptor; isCurrent: () => boolean; disabled: boolean;
}) {
  const [error, setError] = useState(""), [status, setStatus] = useState("");
  function download() {
    setError(""); setStatus("");
    try {
      if (disabled) throw new DiagramExportError("STALE");
      const theme = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
      const file = prepareSchemaDiagramSvgExport(descriptor, theme, isCurrent);
      assertDiagramExportCurrent(isCurrent);
      const url = URL.createObjectURL(new Blob([file.content], { type: file.contentType }));
      try {
        assertDiagramExportCurrent(isCurrent);
        const link = document.createElement("a"); link.href = url; link.download = file.filename; link.hidden = true;
        document.body.appendChild(link);
        try { assertDiagramExportCurrent(isCurrent); link.click(); setStatus(file.draft ? "Draft SVG download started. Unresolved declarations and warnings are included." : "Complete SVG download started."); }
        finally { link.remove(); }
      } finally { window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
    } catch (caught) { setError(caught instanceof DiagramExportError ? diagramExportMessages[caught.code] : diagramExportMessages.FAILED); }
  }
  return <div className="min-w-0 space-y-2 rounded-lg border border-border bg-surface-muted p-3">
    <Button type="button" className="w-full sm:w-auto" disabled={disabled} onClick={download}>Download schema SVG</Button>
    <p className="text-sm leading-relaxed text-muted-foreground">Full diagram in the current appearance. Includes schema names and warnings; no CSV values. Review before sharing.</p>
    {status && <p role="status" className="text-sm text-muted-foreground">{status}</p>}
    {error && <p role="alert" className="rounded-lg border border-danger bg-danger-surface p-3 text-sm text-danger">{error}</p>}
  </div>;
}
