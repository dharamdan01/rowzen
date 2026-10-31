"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { Button, Input } from "../ui/primitives";
import { preparePostgresDataExport, type PostgresDataArtifact } from "../../lib/database-export/postgresql-data";
import { PostgresDataError } from "../../lib/database-export/postgresql-values";
import type { PostgresSchemaArtifact } from "../../lib/database-export/postgresql";
import type { DatabaseExportPlan } from "../../lib/database-export/types";
import type { createDatabaseExportSession } from "../../lib/database-export/session";

export default function PostgresqlDataExport({ session, plan, schema, assertCurrent, disabled }: {
  session: ReturnType<typeof createDatabaseExportSession>; plan: DatabaseExportPlan; schema: PostgresSchemaArtifact;
  assertCurrent: () => void; disabled: boolean;
}) {
  const [consent, setConsent] = useState<PostgresSchemaArtifact | null>(null);
  const [saved, setSaved] = useState<{ source: PostgresSchemaArtifact; artifact: PostgresDataArtifact } | null>(null);
  const [error, setError] = useState(""), [status, setStatus] = useState("");
  const approved = consent === schema;
  const current = approved && saved?.source === schema;
  const live = useRef<{ consent: typeof consent; schema: typeof schema; saved: typeof saved; disabled: boolean; assertCurrent: () => void } | null>(null);
  useLayoutEffect(() => {
    live.current = { consent, schema, saved, disabled, assertCurrent };
    return () => { live.current = null; };
  }, [consent, schema, saved, disabled, assertCurrent]);
  function check(expected: typeof saved = null) {
    const latest = live.current;
    if (!latest || latest.disabled || latest.schema !== schema || latest.consent !== schema || expected && latest.saved !== expected) {
      throw new Error("Current record consent is required.");
    }
    latest.assertCurrent();
  }
  function prepare() {
    setError(""); setStatus(""); setSaved(null);
    try {
      if (!approved || disabled) return;
      check();
      const artifact = preparePostgresDataExport(session, plan, schema, { target: "POSTGRESQL", revisions: plan.revisions, approved: true }, () => check());
      setSaved({ source: schema, artifact }); setStatus(`${artifact.manifest.records.totalRows} approved records prepared locally. Nothing was executed.`);
    } catch (caught) {
      setError(caught instanceof PostgresDataError ? `${caught.message}${caught.location ? ` CSV record starts at line ${caught.location.rowNumber}.` : ""}` :
        "Data export refused. Recheck the current validation report, consent and schema preview. Only dependency-cycle blockers are supported.");
    }
  }
  function download(kind: "sql" | "manifest" | "instructions") {
    setError(""); setStatus("");
    try {
      if (!current || !saved || disabled) return;
      check(saved);
      const artifact = saved.artifact;
      const content = kind === "sql" ? artifact.content : kind === "manifest" ? JSON.stringify(artifact.manifest, null, 2) + "\n" : artifact.instructions;
      const filename = kind === "sql" ? artifact.filename : kind === "manifest" ? "datarehearsal-postgresql-data-manifest.json" : "datarehearsal-postgresql-import-instructions.txt";
      const url = URL.createObjectURL(new Blob([content], { type: kind === "sql" ? artifact.contentType : kind === "manifest" ? "application/json;charset=utf-8" : "text/plain;charset=utf-8" }));
      try {
        check(saved);
        const link = document.createElement("a"); link.href = url; link.download = filename; link.hidden = true; document.body.appendChild(link);
        try { check(saved); link.click(); setStatus("Local download started. No database connection or execution."); }
        finally { link.remove(); }
      } finally { window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
    } catch { setError("This export is stale. Prepare a current schema and record export again."); }
  }
  return <section aria-label="Optional PostgreSQL records" className="min-w-0 space-y-3 rounded-lg border border-border bg-surface-muted p-3">
    <h3 className="font-semibold">Optional corrected records</h3>
    <p className="text-sm text-muted-foreground">The restore file creates new tables and loads every approved current record. It includes sensitive values encoded as reversible hex, not encryption. It replaces running the schema-only file separately.</p>
    <label className="flex items-start gap-3 rounded-md border border-warning bg-warning-surface p-3 text-sm"><Input type="checkbox" checked={approved} disabled={disabled}
      onChange={event => { setConsent(event.target.checked ? schema : null); setSaved(null); setError(""); setStatus(""); }} />
      <span>Include approved current CSV records in a local PostgreSQL restore file. I consent to downloading the sensitive records.</span></label>
    <div className="flex flex-wrap gap-2"><Button type="button" disabled={!approved || disabled} onClick={prepare}>Prepare PostgreSQL data export</Button>
      {current && <><Button type="button" disabled={disabled} onClick={() => download("sql")}>Download PostgreSQL restore</Button>
        <Button type="button" disabled={disabled} onClick={() => download("manifest")}>Download data manifest</Button>
        <Button type="button" disabled={disabled} onClick={() => download("instructions")}>Download import instructions</Button></>}
    </div>
    {current && saved && <details><summary className="min-h-11 cursor-pointer content-center font-semibold">Import instructions and limits</summary>
      <pre tabIndex={0} className="max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-md border border-border bg-surface p-3 font-mono text-xs">{saved.artifact.instructions}</pre>
      <p className="text-sm">{saved.artifact.manifest.records.totalRows} records · local value/key checks only · database compatibility NOT VERIFIED. The preview above remains schema-only.</p></details>}
    {status && <p role="status" className="rounded-md border border-border p-3 text-sm text-muted-foreground">{status}</p>}{error && <p role="alert" className="rounded-md border border-danger bg-danger-surface p-3 text-sm text-danger">{error}</p>}
  </section>;
}
