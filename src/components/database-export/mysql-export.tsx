"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Button, Card, Input, Select, Table } from "../ui/primitives";
import { buildWorkspaceSchemaDescriptor } from "../../lib/schema-diagram/descriptor";
import { createDatabaseExportSession, type DatabaseExportWorkspaceScope } from "../../lib/database-export/session";
import { metadataOnlyConstraintIds } from "../../lib/database-export/plan";
import type { DatabaseExportPlan } from "../../lib/database-export/types";
import type { ColumnExportChoice } from "../../lib/database-export/contracts";
import { MysqlExportError, mysqlStorageFamily, type MysqlType } from "../../lib/database-export/mysql-contracts";
import { prepareMysqlSchemaExport, type MysqlSchemaArtifact } from "../../lib/database-export/mysql";
import { prepareMysqlDataExport, type MysqlDataArtifact } from "../../lib/database-export/mysql-data";

type Draft = { kind: "" | MysqlType["kind"]; length: string; precision: string; scale: string; emptyPolicy: "" | ColumnExportChoice["emptyPolicy"] };
interface Props { scope: DatabaseExportWorkspaceScope; active: boolean; disabled: boolean }
const emptyDraft = (required: boolean): Draft => ({ kind: "", length: "", precision: "", scale: "", emptyPolicy: required ? "REJECT_EMPTY" : "" });
function physicalType(draft: Draft): MysqlType {
  if (!draft.kind) throw new MysqlExportError("INVALID_OPTIONS");
  if (draft.kind === "VARCHAR") return { kind: draft.kind, length: Number(draft.length) };
  if (draft.kind === "DECIMAL") {
    if (!draft.precision || !draft.scale) throw new MysqlExportError("INVALID_OPTIONS");
    return { kind: draft.kind, precision: Number(draft.precision), scale: Number(draft.scale) };
  }
  return { kind: draft.kind };
}
export default function MysqlExport({ scope, active, disabled }: Props) {
  const [session] = useState(createDatabaseExportSession);
  const descriptor = useMemo(() => { try { return buildWorkspaceSchemaDescriptor(scope.configuration); } catch { return null; } }, [scope.configuration]);
  const [draft, setDraft] = useState<{ source: Props["scope"]["configuration"]; columns: Record<string, Draft> }>({ source: scope.configuration, columns: {} });
  const [database, setDatabase] = useState(""), [ack, setAck] = useState(false);
  const settings = useMemo(() => ({ draft, database, ack }), [draft, database, ack]);
  const [saved, setSaved] = useState<{ source: Props["scope"]; settings: typeof settings; plan: DatabaseExportPlan; schema: MysqlSchemaArtifact } | null>(null);
  const [consent, setConsent] = useState<MysqlSchemaArtifact | null>(null);
  const [data, setData] = useState<{ source: MysqlSchemaArtifact; artifact: MysqlDataArtifact } | null>(null);
  const [error, setError] = useState(""), [status, setStatus] = useState("");
  const live = useRef<{ scope: Props["scope"]; settings: typeof settings; saved: typeof saved; consent: typeof consent; data: typeof data; enabled: boolean } | null>(null);
  useLayoutEffect(() => {
    live.current = { scope, settings, saved, consent, data, enabled: active && !disabled };
    try { session.update(scope); } catch { /* Current preparation emits a fixed private error. */ }
    return () => { live.current = null; };
  }, [session, scope, settings, saved, consent, data, active, disabled]);
  const fresh = Boolean(saved && saved.source === scope && saved.settings === settings && !scope.draftsPending);
  const approved = fresh && consent === saved?.schema, dataCurrent = approved && data?.source === saved?.schema;
  const selected = draft.source === scope.configuration ? draft.columns : {};
  const columns = descriptor?.datasets.flatMap(table => table.columns.map(column => ({ ...column, dataset: table.name }))) ?? [];
  function check(expected = saved, records = false, expectedData: typeof data = null) {
    const current = live.current;
    if (!current || !current.enabled || current.scope !== scope || current.settings !== settings || current.scope.draftsPending ||
        expected && current.saved !== expected || records && (!expected || current.consent !== expected.schema) || expectedData && current.data !== expectedData) throw new MysqlExportError("STALE");
    if (expected) session.assertCurrent(expected.plan);
  }
  function patchColumn(id: string, required: boolean, patch: Partial<Draft>) {
    setDraft({ source: scope.configuration, columns: { ...selected, [id]: { ...(selected[id] ?? emptyDraft(required)), ...patch } } });
  }
  function prepare() {
    setError(""); setStatus(""); setData(null); setConsent(null);
    try {
      check(null);
      if (!descriptor || !ack) throw new MysqlExportError("INVALID_OPTIONS");
      session.update(scope);
      const physical = columns.map(column => ({ columnId: column.id, type: physicalType(selected[column.id] ?? emptyDraft(column.explicitlyRequired || column.primaryKeyIds.length > 0)) }));
      const plan = session.prepare({ target: "MYSQL", revisions: session.getRevisions(), comparisonPolicy: "ACKNOWLEDGE_TARGET_NATIVE_DIFFERENCES",
        acknowledgedMetadataOnlyConstraints: metadataOnlyConstraintIds(descriptor, "MYSQL"),
        columns: physical.map(column => ({ columnId: column.columnId, storage: mysqlStorageFamily(column.type), emptyPolicy: selected[column.columnId]?.emptyPolicy })) });
      const schema = prepareMysqlSchemaExport(plan, { revisions: plan.revisions, database, columns: physical,
        profile: "MYSQL_8_INNODB_UTF8MB4_0900_BIN", acknowledgeNonAtomicDdl: true }, () => { check(null); session.assertCurrent(plan); });
      setSaved({ source: scope, settings, plan, schema }); setStatus("MySQL schema prepared locally. No database was contacted.");
    } catch (caught) { setSaved(null); setError(caught instanceof MysqlExportError ? caught.message : "Review current validation, MySQL types, empty policies and acknowledgements."); }
  }
  function prepareRecords() {
    setError(""); setStatus(""); setData(null);
    try {
      if (!saved || !approved) throw new MysqlExportError("STALE");
      check(saved, true);
      const artifact = prepareMysqlDataExport(session, saved.plan, saved.schema,
        { target: "MYSQL", revisions: saved.plan.revisions, approved: true }, () => check(saved, true));
      setData({ source: saved.schema, artifact }); setStatus("Approved corrected records prepared locally. Nothing was executed.");
    } catch (caught) { setError(caught instanceof MysqlExportError ? caught.message : "Unable to prepare current approved records. Revalidate and review MySQL choices."); }
  }
  function download(kind: "schema" | "records" | "manifest" | "instructions") {
    setError(""); setStatus("");
    try {
      if (!saved || !fresh || kind === "records" && !dataCurrent) throw new MysqlExportError("STALE");
      const records = kind !== "schema" && Boolean(dataCurrent), expectedData = records ? data : null;
      check(saved, records, expectedData);
      const artifact = records && data ? data.artifact : saved.schema;
      const content = kind === "manifest" ? JSON.stringify(artifact.manifest, null, 2) + "\n" : kind === "instructions" ? artifact.instructions : artifact.content;
      const filename = kind === "manifest" ? "datarehearsal-mysql-manifest.json" : kind === "instructions" ? "datarehearsal-mysql-import-instructions.txt" : artifact.filename;
      const url = URL.createObjectURL(new Blob([content], { type: kind === "manifest" ? "application/json;charset=utf-8" : kind === "instructions" ? "text/plain;charset=utf-8" : artifact.contentType }));
      try {
        check(saved, records, expectedData);
        const link = document.createElement("a"); link.href = url; link.download = filename; link.hidden = true; document.body.appendChild(link);
        try { check(saved, records, expectedData); link.click(); setStatus("Local MySQL download started. No connection or execution."); } finally { link.remove(); }
      } finally { window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
    } catch { setError("This MySQL export is stale or the download could not start. Prepare a current export again."); }
  }
  return <Card aria-labelledby="mysql-export-heading" className="min-w-0 space-y-4">
    <p className="text-xs font-medium text-muted-foreground">Schema / metadata first; records require separate consent</p>
    <h2 id="mysql-export-heading" className="text-xl font-semibold">MySQL database export</h2>
    <p className="text-sm text-muted-foreground">Schema only by default. MySQL 8.0.30+/8.4, InnoDB, binary NO PAD comparisons. DDL implicitly commits; a failed import can leave partial objects/data. Text storage preserves strings; configured numeric/date/boolean checks then remain metadata. No database connection or automatic execution.</p>
    <details className="rounded-lg border border-border bg-surface-muted px-3 py-1"><summary className="min-h-11 cursor-pointer content-center font-semibold">Choose MySQL column types</summary>
      <div className="max-h-80 overflow-auto"><Table scrollLabel="MySQL column choices" className="min-w-[36rem]"><caption>Applied columns and explicit target choices</caption><thead><tr><th scope="col">Column</th><th scope="col">MySQL type</th><th scope="col">Empty values</th></tr></thead><tbody>
        {columns.map(column => {
          const required = column.explicitlyRequired || column.primaryKeyIds.length > 0, value = selected[column.id] ?? emptyDraft(required), label = `${column.dataset}.${column.target ?? column.source}`;
          const kinds: MysqlType["kind"][] = ["VARCHAR", "LONGTEXT", ...(column.configuredType === "integer" ? ["TINYINT", "SMALLINT", "INT", "BIGINT"] as const : column.configuredType === "number" ? ["DECIMAL"] as const : column.configuredType === "boolean" ? ["BOOLEAN"] as const : column.configuredType === "date" ? ["DATE"] as const : [])];
          return <tr key={column.id}><th scope="row" className="[overflow-wrap:anywhere]">{label}<span className="block text-xs text-muted-foreground">Configured: {column.typeLabel}{required ? " · required" : ""}</span></th><td>
            <Select aria-label={`MySQL type for ${label}`} value={value.kind} onChange={event => patchColumn(column.id, required, { kind: event.target.value as Draft["kind"] })}><option value="">Choose type</option>{kinds.map(kind => <option key={kind} value={kind}>{kind}</option>)}</Select>
            {value.kind === "VARCHAR" && <Input aria-label={`MySQL length for ${label}`} type="number" min={1} max={16383} placeholder="Length" value={value.length} onChange={event => patchColumn(column.id, required, { length: event.target.value })} />}
            {value.kind === "DECIMAL" && <><Input aria-label={`MySQL precision for ${label}`} type="number" min={1} max={65} placeholder="Precision" value={value.precision} onChange={event => patchColumn(column.id, required, { precision: event.target.value })} />
              <Input aria-label={`MySQL scale for ${label}`} type="number" min={0} max={30} placeholder="Scale" value={value.scale} onChange={event => patchColumn(column.id, required, { scale: event.target.value })} /></>}
          </td><td><Select aria-label={`MySQL empty policy for ${label}`} disabled={required} value={value.emptyPolicy} onChange={event => patchColumn(column.id, required, { emptyPolicy: event.target.value as Draft["emptyPolicy"] })}>
            <option value="">Choose policy</option><option value="PRESERVE_EMPTY_STRING">Preserve exact empty text</option><option value="EMPTY_STRING_AS_NULL">Exact empty as NULL</option><option value="REJECT_EMPTY">Reject empty; NOT NULL</option>
          </Select></td></tr>;
        })}
      </tbody></Table></div>
      <Button type="button" className="mt-2" disabled={disabled || scope.draftsPending || !columns.length} onClick={() => setDraft({ source: scope.configuration,
        columns: Object.fromEntries(columns.map(column => [column.id, { ...emptyDraft(column.explicitlyRequired || column.primaryKeyIds.length > 0), kind: "VARCHAR", length: "255",
          emptyPolicy: column.explicitlyRequired || column.primaryKeyIds.length ? "REJECT_EMPTY" : "PRESERVE_EMPTY_STRING" }])) })}>Use VARCHAR(255) types</Button>
    </details>
    <label className="block max-w-md text-sm font-medium">Existing destination MySQL database<Input className="mt-2" aria-label="Destination MySQL database" value={database} onChange={event => setDatabase(event.target.value)} /></label>
    <label className="flex items-start gap-2 text-sm"><Input type="checkbox" checked={ack} onChange={event => setAck(event.target.checked)} /><span>I acknowledge MySQL binary NO PAD comparisons, metadata-only nonblank/email rules, 16 KiB InnoDB profile and non-atomic DDL. Review schema labels before sharing.</span></label>
    {scope.draftsPending && <p role="status">Apply or cancel pending mapping/rule drafts first.</p>}
    {saved && !fresh && <p role="status">Workspace or MySQL choices changed. Prepare a fresh export.</p>}
    <div className="flex flex-wrap gap-2"><Button type="button" disabled={disabled || !active || scope.draftsPending || !ack} onClick={prepare}>Prepare MySQL export</Button>
      <Button type="button" onClick={() => { session.cancel(); setSaved(null); setData(null); setConsent(null); setError(""); setStatus("MySQL export cancelled."); }}>Cancel MySQL export</Button>
      {saved && fresh && <><Button type="button" onClick={() => download("schema")}>Download MySQL schema</Button><Button type="button" onClick={() => download("manifest")}>Download MySQL manifest</Button><Button type="button" onClick={() => download("instructions")}>Download MySQL instructions</Button></>}
    </div>
    {saved && fresh && <><pre aria-label="MySQL schema preview" tabIndex={0} className="max-h-56 max-w-full overflow-auto rounded-lg border border-border bg-surface-muted p-3 font-mono text-xs">{saved.schema.content}</pre>
      <p className="text-sm text-muted-foreground">Database compatibility: NOT VERIFIED. No records appear in this preview.</p>
      <section aria-label="Optional MySQL records" className="min-w-0 space-y-3 rounded-lg border border-border bg-surface-muted p-3">
        <h3 className="font-semibold">Optional corrected records</h3>
        <p className="text-sm text-muted-foreground">The restore includes schema and sensitive approved corrected records as reversible hex. It replaces the schema-only file. DDL is not atomic.</p>
        <label className="flex items-start gap-3 rounded-md border border-warning bg-warning-surface p-3 text-sm"><Input type="checkbox" checked={Boolean(approved)} onChange={event => { setConsent(event.target.checked ? saved.schema : null); setData(null); }} /><span>I consent to include approved current CSV records in a local MySQL restore file.</span></label>
        <div className="flex flex-wrap gap-2"><Button type="button" disabled={!approved || disabled || !active} onClick={prepareRecords}>Prepare MySQL records</Button>{dataCurrent && <Button type="button" onClick={() => download("records")}>Download MySQL restore</Button>}</div>
      </section></>}
    {status && <p role="status" className="rounded-md border border-border bg-surface-muted p-3 text-sm text-muted-foreground">{status}</p>}{error && <p role="alert" className="rounded-md border border-danger bg-danger-surface p-3 text-sm text-danger">{error}</p>}
  </Card>;
}
