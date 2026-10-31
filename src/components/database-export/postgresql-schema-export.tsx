"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Button, Card, Input, Select, Table } from "../ui/primitives";
import { buildWorkspaceSchemaDescriptor } from "../../lib/schema-diagram/descriptor";
import { createDatabaseExportSession, type DatabaseExportWorkspaceScope } from "../../lib/database-export/session";
import { preparePostgresSchemaExport, postgresStorageFamily, PostgresSchemaError, type PostgresSchemaArtifact, type PostgresType } from "../../lib/database-export/postgresql";
import type { DatabaseExportPlan } from "../../lib/database-export/types";
import type { ColumnExportChoice } from "../../lib/database-export/contracts";
import PostgresqlDataExport from "./postgresql-data-export";

type Draft = { kind: "" | PostgresType["kind"]; length: string; precision: string; scale: string; emptyPolicy: "" | ColumnExportChoice["emptyPolicy"] };
interface Props { scope: DatabaseExportWorkspaceScope; active: boolean; disabled: boolean }
const emptyDraft = (required: boolean): Draft => ({ kind: "", length: "", precision: "", scale: "", emptyPolicy: required ? "REJECT_EMPTY" : "" });
function draftType(draft: Draft): PostgresType {
  if (!draft.kind) throw new PostgresSchemaError("INVALID_OPTIONS");
  if (draft.kind === "VARCHAR") return { kind: "VARCHAR", length: Number(draft.length) };
  if (draft.kind === "NUMERIC") {
    if (!draft.precision || !draft.scale) throw new PostgresSchemaError("INVALID_OPTIONS");
    return { kind: "NUMERIC", precision: Number(draft.precision), scale: Number(draft.scale) };
  }
  return { kind: draft.kind };
}

export default function PostgresqlSchemaExport({ scope, active, disabled }: Props) {
  const [session] = useState(createDatabaseExportSession);
  const [drafts, setDrafts] = useState<{ source: Props["scope"]["configuration"]; columns: Record<string, Draft> }>({ source: scope.configuration, columns: {} });
  const [namespace, setNamespace] = useState("public"), [acknowledged, setAcknowledged] = useState(false);
  const [error, setError] = useState(""), [status, setStatus] = useState("");
  const descriptor = useMemo(() => { try { return buildWorkspaceSchemaDescriptor(scope.configuration); } catch { return null; } }, [scope.configuration]);
  const columns = descriptor?.datasets.flatMap(dataset => dataset.columns.map(column => ({ ...column, dataset: dataset.name }))) ?? [];
  const selected = drafts.source === scope.configuration ? drafts.columns : {};
  const settings = useMemo(() => ({ drafts, namespace, acknowledged }), [drafts, namespace, acknowledged]);
  const [saved, setSaved] = useState<{ artifact: PostgresSchemaArtifact; plan: DatabaseExportPlan; scope: Props["scope"]; settings: typeof settings } | null>(null);
  const live = useRef<{ scope: Props["scope"]; settings: typeof settings; active: boolean; disabled: boolean } | null>(null);
  useLayoutEffect(() => {
    live.current = { scope, settings, active, disabled };
    try { session.update(scope); } catch { /* Preparation reports a fixed error; stale downloads remain guarded. */ }
    return () => { live.current = null; };
  }, [session, scope, settings, active, disabled]);
  const fresh = Boolean(saved && saved.scope === scope && saved.settings === settings && !scope.draftsPending);
  function check(expectedScope: Props["scope"], expectedSettings: typeof settings, plan?: DatabaseExportPlan) {
    const current = live.current;
    if (!current || !current.active || current.disabled || current.scope.draftsPending || current.scope !== expectedScope ||
        current.settings !== expectedSettings) throw new PostgresSchemaError("STALE");
    if (plan) session.assertCurrent(plan);
  }
  function updateColumn(id: string, patch: Partial<Draft>, required: boolean) {
    setDrafts(previous => ({ source: scope.configuration, columns: { ...(previous.source === scope.configuration ? previous.columns : {}),
      [id]: { ...(previous.source === scope.configuration ? previous.columns[id] : null) ?? emptyDraft(required), ...patch } } }));
    setStatus("");
  }
  function generate() {
    setError(""); setStatus(""); setSaved(null);
    try {
      check(scope, settings);
      if (!descriptor || !acknowledged) throw new PostgresSchemaError("UNSUPPORTED_SCHEMA");
      session.update(scope);
      const physical = columns.map(column => ({ columnId: column.id, type: draftType(selected[column.id] ?? emptyDraft(column.explicitlyRequired || column.primaryKeyIds.length > 0)) }));
      const plan = session.prepare({ target: "POSTGRESQL", revisions: session.getRevisions(),
        comparisonPolicy: "ACKNOWLEDGE_TARGET_NATIVE_DIFFERENCES",
        columns: physical.map(column => ({ columnId: column.columnId, storage: postgresStorageFamily(column.type), emptyPolicy: selected[column.columnId]?.emptyPolicy })),
        acknowledgedMetadataOnlyConstraints: descriptor.fieldRules.flatMap(rule => [
          ...(rule.explicitlyRequired ? [JSON.stringify(["required", rule.id])] : []),
          ...(rule.configuredType === "email" ? [JSON.stringify(["email", rule.id])] : []),
        ]) });
      if (plan.status !== "PLANNED") throw new PostgresSchemaError("UNSUPPORTED_SCHEMA");
      const artifact = preparePostgresSchemaExport(plan, { revisions: plan.revisions, namespace, columns: physical }, () => check(scope, settings, plan));
      setSaved({ artifact, plan, scope, settings }); setStatus("Schema preview prepared locally. No database was contacted.");
    } catch (caught) { setError(caught instanceof PostgresSchemaError ? caught.message : "Unable to prepare this schema. Review types, empty policies and the current validation report."); }
  }
  function download(manifest = false) {
    setError(""); setStatus("");
    try {
      if (!saved || !fresh) throw new PostgresSchemaError("STALE");
      check(saved.scope, saved.settings, saved.plan);
      const artifact = saved.artifact;
      const url = URL.createObjectURL(new Blob([manifest ? JSON.stringify(artifact.manifest, null, 2) + "\n" : artifact.content],
        { type: manifest ? "application/json;charset=utf-8" : artifact.contentType }));
      try {
        check(saved.scope, saved.settings, saved.plan);
        const link = document.createElement("a"); link.href = url;
        link.download = manifest ? "datarehearsal-postgresql-manifest.json" : artifact.filename;
        link.hidden = true; document.body.appendChild(link);
        try { check(saved.scope, saved.settings, saved.plan); link.click(); setStatus("Local schema download started. No SQL was executed."); }
        finally { link.remove(); }
      } finally { window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
    } catch { setError("The preview is no longer current. Generate it again before downloading."); }
  }
  return <Card aria-labelledby="postgresql-schema-heading" className="min-w-0 space-y-4">
    <p className="text-xs font-medium text-muted-foreground">Schema / metadata first; records require separate consent</p>
    <h2 id="postgresql-schema-heading" className="text-xl font-semibold">PostgreSQL schema export</h2>
    <p className="text-sm text-muted-foreground">Schema only: configured tables, keys and relationships. No CSV values, database connection or automatic execution. The destination schema must already exist.</p>
    <details className="rounded-lg border border-border bg-surface-muted px-3 py-1"><summary className="min-h-11 cursor-pointer content-center font-semibold">Choose PostgreSQL column types</summary>
      <div className="max-h-80 overflow-auto"><Table scrollLabel="PostgreSQL column choices" className="min-w-[36rem]"><caption>Applied columns and explicit target choices</caption><thead><tr><th scope="col">Column</th><th scope="col">PostgreSQL type</th><th scope="col">Empty values</th></tr></thead><tbody>
        {columns.map(column => {
          const required = column.explicitlyRequired || column.primaryKeyIds.length > 0, value = selected[column.id] ?? emptyDraft(required);
          const allowed = column.configuredType === "integer" ? ["TEXT", "VARCHAR", "SMALLINT", "INTEGER", "BIGINT"] : column.configuredType === "number" ? ["TEXT", "VARCHAR", "NUMERIC", "DOUBLE_PRECISION"]
            : column.configuredType === "boolean" ? ["TEXT", "VARCHAR", "BOOLEAN"] : column.configuredType === "date" ? ["TEXT", "VARCHAR", "DATE"] : ["TEXT", "VARCHAR"];
          const label = `${column.dataset}.${column.target ?? column.source}`;
          return <tr key={column.id}><th scope="row" className="[overflow-wrap:anywhere]">{label}<span className="block text-xs text-muted-foreground">Configured: {column.typeLabel}{required ? " · required" : ""}</span></th><td>
            <Select aria-label={`PostgreSQL type for ${label}`} value={value.kind} onChange={event => updateColumn(column.id, { kind: event.target.value as Draft["kind"] }, required)}>
              <option value="">Choose type</option>{allowed.map(kind => <option key={kind} value={kind}>{kind.replaceAll("_", " ")}</option>)}
            </Select>
            {value.kind === "VARCHAR" && <Input type="number" min={1} max={1_000_000} aria-label={`Length for ${label}`} placeholder="Length" value={value.length} onChange={event => updateColumn(column.id, { length: event.target.value }, required)} />}
            {value.kind === "NUMERIC" && <><Input type="number" min={1} max={1000} aria-label={`Precision for ${label}`} placeholder="Precision" value={value.precision} onChange={event => updateColumn(column.id, { precision: event.target.value }, required)} />
              <Input type="number" min={0} max={1000} aria-label={`Scale for ${label}`} placeholder="Scale" value={value.scale} onChange={event => updateColumn(column.id, { scale: event.target.value }, required)} /></>}
          </td><td><Select aria-label={`Empty policy for ${label}`} disabled={required} value={value.emptyPolicy} onChange={event => updateColumn(column.id, { emptyPolicy: event.target.value as Draft["emptyPolicy"] }, required)}>
            <option value="">Choose policy</option><option value="PRESERVE_EMPTY_STRING">Preserve empty text; nullable</option><option value="EMPTY_STRING_AS_NULL">Empty as NULL; nullable</option><option value="REJECT_EMPTY">Reject empty; NOT NULL</option>
          </Select></td></tr>;
        })}
      </tbody></Table></div>
      <Button type="button" className="mt-2" disabled={disabled || scope.draftsPending || !columns.length} onClick={() => {
        setDrafts({ source: scope.configuration, columns: Object.fromEntries(columns.map(column => [column.id, { ...emptyDraft(column.explicitlyRequired || column.primaryKeyIds.length > 0), kind: "TEXT",
          emptyPolicy: column.explicitlyRequired || column.primaryKeyIds.length ? "REJECT_EMPTY" : "PRESERVE_EMPTY_STRING" }])) }); setStatus("");
      }}>Use text for all columns</Button>
      <p className="text-xs text-muted-foreground">This explicit choice keeps typed formats as application rules. NOT NULL alone does not reject blank text. Record export uses these empty policies only after separate consent; this schema file contains no data.</p>
    </details>
    <label className="block max-w-md text-sm font-medium">Destination PostgreSQL schema<Input className="mt-2" aria-label="Destination PostgreSQL schema" value={namespace} onChange={event => { setNamespace(event.target.value); setStatus(""); }} /></label>
    <label className="flex items-start gap-2 text-sm"><Input type="checkbox" checked={acknowledged} onChange={event => setAcknowledged(event.target.checked)} />
      <span>I reviewed PostgreSQL type, NULL and comparison differences. Nonblank and email rules remain application checks; preflight does not guarantee database compatibility.</span></label>
    {scope.draftsPending && <p role="status" className="text-sm text-warning">Apply or cancel pending mapping/rule drafts before generating a schema.</p>}
    {saved && !fresh && <p role="status" className="text-sm text-warning">The workspace or export choices changed. Generate a new preview.</p>}
    <div className="flex flex-wrap gap-2 border-t border-border pt-3"><Button type="button" onClick={generate} disabled={disabled || !active || scope.draftsPending || !scope.report || !columns.length || !acknowledged}>Generate PostgreSQL schema</Button>
      {saved && fresh && <><Button type="button" onClick={() => download()} disabled={disabled || !active}>Download PostgreSQL schema</Button><Button type="button" onClick={() => download(true)} disabled={disabled || !active}>Download PostgreSQL manifest</Button></>}
      {saved && <Button type="button" onClick={() => { session.cancel(); setSaved(null); setStatus("Schema preview cancelled."); setError(""); }}>Cancel preview</Button>}
    </div>
    {saved && fresh && <><pre aria-label="PostgreSQL schema preview" tabIndex={0} className="max-h-80 max-w-full overflow-auto rounded-lg border border-border bg-surface-muted p-3 text-xs">{saved.artifact.content}</pre>
      <details><summary className="min-h-11 cursor-pointer content-center font-semibold">Compatibility manifest and warnings</summary><p className="text-sm">Current preflight: {saved.artifact.manifest.configuredPreflight}. Database compatibility: NOT VERIFIED. Review the manifest before using this schema.</p>
        <pre aria-label="PostgreSQL manifest preview" tabIndex={0} className="max-h-56 max-w-full overflow-auto rounded-lg border border-border bg-surface-muted p-3 font-mono text-xs">{JSON.stringify(saved.artifact.manifest, null, 2)}</pre></details>
      <PostgresqlDataExport session={session} plan={saved.plan} schema={saved.artifact} assertCurrent={() => check(saved.scope, saved.settings, saved.plan)} disabled={disabled || !active} />
    </>}
    {status && <p role="status" className="rounded-md border border-border bg-surface-muted p-3 text-sm text-muted-foreground">{status}</p>}{error && <p role="alert" className="rounded-md border border-danger bg-danger-surface p-3 text-sm text-danger">{error}</p>}
  </Card>;
}
