"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Button, Card, Input, Select, Table } from "../ui/primitives";
import { buildWorkspaceSchemaDescriptor } from "../../lib/schema-diagram/descriptor";
import { createDatabaseExportSession, type DatabaseExportWorkspaceScope } from "../../lib/database-export/session";
import { metadataOnlyConstraintIds } from "../../lib/database-export/plan";
import { mongoStorageFamily, MongoExportError, type MongoOptions, type MongoType } from "../../lib/database-export/mongodb-contracts";
import { prepareMongoMetadata, type MongoMetadataArtifact } from "../../lib/database-export/mongodb";
import { prepareMongoDocuments, type MongoDocumentArtifact } from "../../lib/database-export/mongodb-data";
import type { DatabaseExportPlan } from "../../lib/database-export/types";
import type { ColumnExportChoice } from "../../lib/database-export/contracts";

type ColumnDraft = { type: "" | MongoType; emptyPolicy: "" | ColumnExportChoice["emptyPolicy"] };
type CollectionDraft = { name: string; idPolicy: "" | MongoOptions["collections"][number]["idPolicy"] };
interface Props { scope: DatabaseExportWorkspaceScope; active: boolean; disabled: boolean }
export default function MongodbExport({ scope, active, disabled }: Props) {
  const [session] = useState(createDatabaseExportSession);
  const descriptor = useMemo(() => { try { return buildWorkspaceSchemaDescriptor(scope.configuration); } catch { return null; } }, [scope.configuration]);
  const [draft, setDraft] = useState<{ source: Props["scope"]["configuration"]; columns: Record<string, ColumnDraft>; collections: Record<string, CollectionDraft> }>({ source: scope.configuration, columns: {}, collections: {} });
  const [validators, setValidators] = useState(false), [indexes, setIndexes] = useState(false), [ack, setAck] = useState(false);
  const settings = useMemo(() => ({ draft, validators, indexes, ack }), [draft, validators, indexes, ack]);
  const [saved, setSaved] = useState<{ source: Props["scope"]; settings: typeof settings; plan: DatabaseExportPlan; metadata: MongoMetadataArtifact } | null>(null);
  const [consent, setConsent] = useState<MongoMetadataArtifact | null>(null);
  const [data, setData] = useState<{ source: MongoMetadataArtifact; artifact: MongoDocumentArtifact } | null>(null);
  const [error, setError] = useState(""), [status, setStatus] = useState("");
  const live = useRef<{ scope: Props["scope"]; settings: typeof settings; saved: typeof saved; consent: typeof consent; data: typeof data; enabled: boolean } | null>(null);
  useLayoutEffect(() => {
    live.current = { scope, settings, saved, consent, data, enabled: active && !disabled };
    try { session.update(scope); } catch { /* Fixed preparation errors are shown on request. */ }
    return () => { live.current = null; };
  }, [scope, settings, saved, consent, data, active, disabled, session]);
  const fresh = Boolean(saved && saved.source === scope && saved.settings === settings && !scope.draftsPending);
  const recordsApproved = fresh && consent === saved?.metadata;
  const dataCurrent = recordsApproved && data?.source === saved?.metadata;
  function check(expected = saved, records = false, expectedData: typeof data = null) {
    const current = live.current;
    if (!current || !current.enabled || current.scope !== scope || current.settings !== settings || current.scope.draftsPending ||
        expected && current.saved !== expected || records && (!expected || current.consent !== expected.metadata) || expectedData && current.data !== expectedData) throw new MongoExportError("STALE");
    if (expected) session.assertCurrent(expected.plan);
  }
  const currentDraft = draft.source === scope.configuration ? draft : { source: scope.configuration, columns: {}, collections: {} };
  function patchColumn(id: string, required: boolean, patch: Partial<ColumnDraft>) {
    setDraft({ ...currentDraft, columns: { ...currentDraft.columns, [id]: { ...(currentDraft.columns[id] ?? { type: "", emptyPolicy: required ? "REJECT_EMPTY" : "" }), ...patch } } });
  }
  function prepare() {
    setError(""); setStatus(""); setData(null); setConsent(null);
    try {
      // The old preview may be stale, but current source/choices must still be committed.
      check(null);
      if (!descriptor || !ack) throw new MongoExportError("INVALID_OPTIONS");
      session.update(scope);
      const columns = descriptor.datasets.flatMap(table => table.columns.map(column => ({ columnId: column.id, ...currentDraft.columns[column.id] })));
      const plan = session.prepare({ target: "MONGODB", revisions: session.getRevisions(), comparisonPolicy: "ACKNOWLEDGE_TARGET_NATIVE_DIFFERENCES",
        acknowledgedMetadataOnlyConstraints: metadataOnlyConstraintIds(descriptor, "MONGODB"),
        columns: columns.map(column => ({ columnId: column.columnId, storage: column.type ? mongoStorageFamily(column.type) : undefined, emptyPolicy: column.emptyPolicy })) });
      const metadata = prepareMongoMetadata(plan, { revisions: plan.revisions, columns,
        collections: descriptor.datasets.map(table => ({ datasetId: table.id, ...currentDraft.collections[table.id] })),
        includeValidators: validators, includeUniqueIndexes: indexes, acknowledgeMongoSemantics: true }, () => { check(null); session.assertCurrent(plan); });
      setSaved({ source: scope, settings, plan, metadata }); setStatus("MongoDB metadata prepared locally. Foreign-key enforcement: NONE.");
    } catch (caught) { setSaved(null); setError(caught instanceof MongoExportError ? caught.message : "Review current validation, types, empty policies, collection choices and acknowledgements."); }
  }
  function prepareRecords() {
    setError(""); setStatus(""); setData(null);
    try {
      if (!saved || !recordsApproved) throw new MongoExportError("STALE");
      check(saved, true);
      const artifact = prepareMongoDocuments(session, saved.plan, saved.metadata,
        { target: "MONGODB", revisions: saved.plan.revisions, approved: true }, () => check(saved, true));
      setData({ source: saved.metadata, artifact }); setStatus(`${artifact.manifest.records.totalDocuments} approved documents prepared locally. Nothing was imported.`);
    } catch (caught) { setError(caught instanceof MongoExportError ? `${caught.message}${caught.location ? ` CSV record starts at line ${caught.location.rowNumber}.` : ""}` : "Record export refused. Recheck current consent and validation; only dependency-cycle blockers are accepted."); }
  }
  function download(filename: string, content: string, type = "application/json;charset=utf-8", records = false) {
    setError(""); setStatus("");
    try {
      if (!saved || !fresh) throw new MongoExportError("STALE");
      const expectedData = records ? data : null;
      check(saved, records, expectedData);
      const url = URL.createObjectURL(new Blob([content], { type }));
      try {
        check(saved, records, expectedData);
        const link = document.createElement("a"); link.href = url; link.download = filename; link.hidden = true; document.body.appendChild(link);
        try { check(saved, records, expectedData); link.click(); setStatus("Local download started. No MongoDB connection or import."); } finally { link.remove(); }
      } finally { window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
    } catch { setError("This MongoDB export is stale or no longer consented. Prepare it again."); }
  }
  return <Card aria-labelledby="mongodb-export-heading" className="min-w-0 space-y-4">
    <p className="text-xs font-medium text-muted-foreground">Schema / metadata first; records require separate consent</p>
    <h2 id="mongodb-export-heading" className="text-xl font-semibold">MongoDB document export</h2>
    <p className="text-sm text-muted-foreground">Flat documents from applied columns. SQL foreign keys are metadata only and are NOT enforced by MongoDB. Record files require separate consent.</p>
    <details className="rounded-lg border border-border bg-surface-muted px-3 py-1"><summary className="min-h-11 cursor-pointer content-center font-semibold">Choose MongoDB types and collections</summary>
      <div className="max-h-80 overflow-auto"><Table scrollLabel="MongoDB column choices" className="min-w-[36rem]"><caption>Explicit BSON types and empty values</caption><thead><tr><th scope="col">Column</th><th>BSON type</th><th>Empty policy</th></tr></thead><tbody>
        {descriptor?.datasets.flatMap(table => table.columns.map(column => {
          const required = column.explicitlyRequired || column.primaryKeyIds.length > 0 || column.target === "_id";
          const value = currentDraft.columns[column.id] ?? { type: "", emptyPolicy: required ? "REJECT_EMPTY" : "" };
          const allowed = column.configuredType === "integer" ? ["STRING", "INT32", "INT64"] : column.configuredType === "number" ? ["STRING", "DECIMAL128"] : column.configuredType === "boolean" ? ["STRING", "BOOLEAN"] : column.configuredType === "date" ? ["STRING", "DATE_UTC_MIDNIGHT"] : ["STRING"];
          const label = `${table.name}.${column.target ?? column.source}`;
          return <tr key={column.id}><th scope="row">{label}<span className="block text-xs text-muted-foreground">Configured: {column.typeLabel}</span></th><td>
            <Select aria-label={`MongoDB type for ${label}`} value={value.type} onChange={event => patchColumn(column.id, required, { type: event.target.value as MongoType })}>
              <option value="">Choose type</option>{allowed.map(type => <option value={type} key={type}>{type.replaceAll("_", " ")}</option>)}
            </Select></td><td><Select aria-label={`MongoDB empty policy for ${label}`} disabled={required} value={value.emptyPolicy}
              onChange={event => patchColumn(column.id, required, { emptyPolicy: event.target.value as ColumnExportChoice["emptyPolicy"] })}>
              <option value="">Choose policy</option><option value="PRESERVE_EMPTY_STRING">Keep empty string</option><option value="EMPTY_STRING_AS_NULL">Empty to BSON null</option>
              <option value="EMPTY_STRING_AS_MISSING">Omit exact empty field</option><option value="REJECT_EMPTY">Reject empty; required</option>
            </Select></td></tr>;
        }))}
      </tbody></Table></div>
      <Button type="button" className="my-2" disabled={!descriptor || disabled || scope.draftsPending} onClick={() => setDraft({ ...currentDraft,
        columns: Object.fromEntries((descriptor?.datasets ?? []).flatMap(table => table.columns.map(column => [column.id, { type: "STRING",
          emptyPolicy: column.explicitlyRequired || column.primaryKeyIds.length || column.target === "_id" ? "REJECT_EMPTY" : "PRESERVE_EMPTY_STRING" } as ColumnDraft]))) })}>Use string types</Button>
      {descriptor?.datasets.map(table => { const hasId = table.columns.some(column => column.target === "_id"), value = currentDraft.collections[table.id] ?? { name: table.name, idPolicy: "" };
        const update = (patch: Partial<CollectionDraft>) => setDraft({ ...currentDraft, collections: { ...currentDraft.collections, [table.id]: { ...value, ...patch } } });
        return <div key={table.id} className="mb-3 grid gap-2 sm:grid-cols-2"><label className="text-sm">Collection for {table.name}<Input aria-label={`MongoDB collection for ${table.name}`} value={value.name} onChange={event => update({ name: event.target.value })} /></label>
          <label className="text-sm">Technical _id policy<Select aria-label={`MongoDB id policy for ${table.name}`} value={value.idPolicy} onChange={event => update({ idPolicy: event.target.value as CollectionDraft["idPolicy"] })}>
            <option value="">Choose explicitly</option>{hasId ? <option value="PRESERVE_CONFIGURED_ID">Preserve configured _id</option> : <option value="ALLOW_SERVER_GENERATED_ID">Allow server ObjectId; retain original key fields</option>}
          </Select></label></div>;
      })}
      <p className="text-xs text-muted-foreground">Dates remain strings unless DATE UTC MIDNIGHT is chosen explicitly. Null and omitted fields are different. No embedding, ObjectId coercion or foreign-key transformations are generated.</p>
    </details>
    <label className="flex items-start gap-2 text-sm"><Input type="checkbox" checked={validators} onChange={event => setValidators(event.target.checked)} />Include optional collection validators</label>
    <label className="flex items-start gap-2 text-sm"><Input type="checkbox" checked={indexes} onChange={event => setIndexes(event.target.checked)} />Include optional declared unique indexes</label>
    <label className="flex items-start gap-2 text-sm"><Input type="checkbox" checked={ack} onChange={event => setAck(event.target.checked)} />I understand FKs are not enforced, source PKs are not automatically _id, and MongoDB unique indexes treat null/missing differently from SQL.</label>
    {scope.draftsPending && <p role="status" className="text-sm text-warning">Apply or cancel pending mapping/rule drafts first.</p>}
    {saved && !fresh && <p role="status" className="text-sm text-warning">The workspace or MongoDB choices changed. Prepare a new preview.</p>}
    <div className="flex flex-wrap gap-2"><Button type="button" onClick={prepare} disabled={disabled || !active || scope.draftsPending || !scope.report || !ack}>Prepare MongoDB export</Button>
      {saved && fresh && <><Button type="button" onClick={() => download(saved.metadata.filename, saved.metadata.content)}>Download MongoDB definitions</Button>
        <Button type="button" onClick={() => download("datarehearsal-mongodb-manifest.json", JSON.stringify(dataCurrent && data ? data.artifact.manifest : saved.metadata.manifest, null, 2) + "\n", undefined, Boolean(dataCurrent))}>Download MongoDB manifest</Button>
        <Button type="button" onClick={() => download("datarehearsal-mongodb-import-instructions.txt", saved.metadata.instructions, "text/plain;charset=utf-8")}>Download MongoDB instructions</Button></>}
      {saved && <Button type="button" onClick={() => { session.cancel(); setSaved(null); setConsent(null); setData(null); setStatus("MongoDB export cancelled."); setError(""); }}>Cancel MongoDB export</Button>}
    </div>
    {saved && fresh && <><pre aria-label="MongoDB definitions preview" tabIndex={0} className="max-h-56 max-w-full overflow-auto rounded-lg border border-border bg-surface-muted p-3 font-mono text-xs">{saved.metadata.content}</pre>
      <p className="text-sm text-muted-foreground">Database compatibility NOT VERIFIED. Unique indexes use simple collation and include null/missing values; partial/sparse uniqueness is unsupported.</p>
      <h3 className="border-t border-border pt-3 font-semibold">Optional corrected documents</h3>
      <label className="flex items-start gap-3 rounded-md border border-warning bg-warning-surface p-3 text-sm"><Input type="checkbox" checked={recordsApproved} disabled={disabled || !active} onChange={event => { setConsent(event.target.checked ? saved.metadata : null); setData(null); setStatus(""); }} />I consent to include approved current CSV records in sensitive local MongoDB JSONL files.</label>
      <Button type="button" disabled={!recordsApproved || disabled || !active} onClick={prepareRecords}>Prepare MongoDB documents</Button>
      {dataCurrent && data && <div className="flex flex-wrap gap-2">{data.artifact.files.map(file => <Button type="button" key={file.filename} disabled={disabled || !active}
        onClick={() => download(file.filename, file.content, file.contentType, true)}>Download JSONL: {file.collection}</Button>)}</div>}
    </>}
    {status && <p role="status" className="rounded-md border border-border bg-surface-muted p-3 text-sm text-muted-foreground">{status}</p>}{error && <p role="alert" className="rounded-md border border-danger bg-danger-surface p-3 text-sm text-danger">{error}</p>}
  </Card>;
}
