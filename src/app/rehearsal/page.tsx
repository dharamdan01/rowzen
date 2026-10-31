"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import ThemeSelector from "../../components/theme/theme-selector";
import RowzenBrand from "../../components/brand/rowzen-brand";
import PageHeader from "../../components/layout/page-header";
import { Button, Card, Input, Select, StatusMessage, Table } from "../../components/ui/primitives";
import type { ParsedCsv } from "../../lib/csv/parser";
import { DEMO_TYPES, demoConfiguration, emptyDemoSettings, exampleDemoSettings, hasDemoChecks, readDemoFiles, type DemoColumn, type DemoSettings } from "../../lib/demo/configuration";
import type { Relationship } from "../../lib/rehearsal/rules";
import { revalidateCorrectionSnapshot, type VerifiedCorrectionReport } from "../../lib/corrections/revalidation";
import { prepareReportExport } from "../../lib/reports/export";

export default function RehearsalDemoPage() {
  const [datasets, setDatasets] = useState<ParsedCsv[]>([]);
  const [settings, setSettings] = useState<DemoSettings[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [verified, setVerified] = useState<VerifiedCorrectionReport | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [issuePage, setIssuePage] = useState(0);
  const attempt = useRef(0);
  const picker = useRef<HTMLInputElement>(null);

  function invalidate() { setVerified(null); setIssuePage(0); setError(""); }
  async function loadFiles(files: readonly File[]) {
    const current = ++attempt.current;
    invalidate(); setDatasets([]); setSettings([]); setRelationships([]); setBusy(true);
    try {
      const parsed = await readDemoFiles(files);
      if (current !== attempt.current) return;
      setDatasets(parsed); setSettings(emptyDemoSettings(parsed));
    } catch (failure) {
      if (current === attempt.current) setError(failure instanceof Error ? failure.message : "Could not read the CSV files.");
    } finally { if (current === attempt.current) setBusy(false); }
  }
  function clear() {
    attempt.current++; invalidate(); setBusy(false); setDatasets([]); setSettings([]); setRelationships([]);
    if (picker.current) picker.current.value = "";
  }
  function updateColumn(dataset: number, column: number, patch: Partial<DemoColumn>) {
    invalidate();
    setSettings(current => current.map((setting, index) => index === dataset ? { ...setting, columns: setting.columns.map((value, position) => position === column ? { ...value, ...patch } : value) } : setting));
  }
  function validate() {
    invalidate();
    try { setVerified(revalidateCorrectionSnapshot(datasets, demoConfiguration(datasets, settings, relationships))); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Could not run validation. Review the settings."); }
  }
  function download() {
    if (!verified) return;
    try {
      const output = prepareReportExport(verified.report, verified.analytics, "json");
      const url = URL.createObjectURL(new Blob([JSON.stringify({ ...JSON.parse(output.content), demoScope: checked ? "Only explicitly configured checks were evaluated." : "CSV structure only. No data checks were configured." }, null, 2)], { type: output.contentType }));
      try { const link = document.createElement("a"); link.href = url; link.download = "datarehearsal-report.json"; document.body.append(link); link.click(); link.remove(); }
      finally { window.setTimeout(() => URL.revokeObjectURL(url), 0); }
    } catch { setError("Could not download this report. Run validation again and retry."); }
  }
  const example = exampleDemoSettings(datasets);
  const report = verified?.report;
  const checked = hasDemoChecks(settings, relationships);
  const endpoints = datasets.flatMap((dataset, di) => dataset.headers.map((column, ci) => ({ value: di + "/" + ci, dataset: dataset.name, column, label: dataset.filename + " / " + column })));
  function changeEndpoint(index: number, side: "child" | "parent", value: string) {
    const endpoint = endpoints.find(item => item.value === value);
    if (!endpoint) return;
    invalidate();
    setRelationships(current => current.map((relation, i) => i === index ? { ...relation, [side + "Dataset"]: endpoint.dataset, [side + "Column"]: endpoint.column } : relation));
  }
  function selectedEndpoint(dataset: string, column: string) { return endpoints.find(item => item.dataset === dataset && item.column === column)?.value ?? ""; }

  return <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
    <nav aria-label="Demo navigation" className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
      <RowzenBrand /><Link href="/upload" className="inline-flex min-h-11 items-center rounded-md text-sm font-medium text-primary hover:underline">CSV workspace</Link><ThemeSelector />
    </nav>
    <PageHeader title="Try your CSV. See what needs attention." description="A public, browser-local demo. Choose your own files and checks; no account or database connection is needed." />
    <Card aria-label="CSV files" className="space-y-4">
      <div><label htmlFor="csv-files" className="block font-medium">Choose 1 or 2 CSV files (1 MB maximum each)</label>
        <Input ref={picker} id="csv-files" aria-describedby="csv-hint" disabled={busy} type="file" multiple accept=".csv,text/csv" onChange={event => { if (event.target.files?.length) void loadFiles(Array.from(event.target.files)); }} /></div>
      <p id="csv-hint" className="text-sm leading-relaxed text-muted-foreground">UTF-8, comma-separated CSV with unique, nonempty headers and at least one record. Files and rules stay in browser memory. Refresh clears the demo. No server upload.</p>
      <div className="flex flex-wrap gap-3"><Button type="button" disabled={busy} onClick={() => void loadFiles([
        new File(["id,name,department_id\n1,Ada,10\n2,Grace,99\n2,Alan,10"], "students.csv", { type: "text/csv" }),
        new File(["id,name\n10,Science\n20,Arts"], "departments.csv", { type: "text/csv" }),
      ])}>Load sample CSVs</Button><Button type="button" disabled={!busy && !datasets.length && !error} onClick={clear}>Clear demo</Button></div>
      {busy && <p role="status" className="text-sm text-muted-foreground">Reading CSV files...</p>}
      {error && <StatusMessage tone="error">{error}</StatusMessage>}
    </Card>
    {datasets.length > 0 && <Card aria-label="Demo checks" className="space-y-5">
      <div><h2 className="text-xl font-semibold">Choose your checks</h2><p className="mt-2 text-sm leading-relaxed text-muted-foreground">Headers keep their source names. Types are not inferred. Select multiple primary columns for one composite key; each Unique checkbox is a separate single-column constraint. Unconfigured checks are not performed.</p></div>
      {example && <Button type="button" onClick={() => { invalidate(); setSettings(example.settings); setRelationships(example.relationships); }}>Apply students/departments example rules</Button>}
      {datasets.map((dataset, di) => <ColumnChecks key={di + dataset.filename} dataset={dataset} columns={settings[di].columns} onChange={(ci, patch) => updateColumn(di, ci, patch)} />)}
      <section aria-labelledby="demo-relationships" className="space-y-3 border-t border-border pt-4">
        <h3 id="demo-relationships" className="font-medium">Optional relationships</h3>
        <p className="text-sm text-muted-foreground">{datasets.length < 2 ? "Add a second CSV to configure cross-dataset checks." : "No relationships are inferred. Choose a child reference and a declared primary or unique parent key."}</p>
        {relationships.map((relation, index) => <fieldset key={index} className="grid min-w-0 gap-3 rounded-lg border border-border p-3 sm:grid-cols-[1fr_1fr_auto]">
          <legend className="px-1 text-sm">Relationship {index + 1}</legend>
          <label className="min-w-0 text-sm">Child reference<Select value={selectedEndpoint(relation.childDataset, relation.childColumn)} onChange={event => changeEndpoint(index, "child", event.target.value)}>{endpoints.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</Select></label>
          <label className="min-w-0 text-sm">Parent key<Select value={selectedEndpoint(relation.parentDataset, relation.parentColumn)} onChange={event => changeEndpoint(index, "parent", event.target.value)}>{endpoints.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</Select></label>
          <Button type="button" aria-label={"Remove relationship " + (index + 1)} onClick={() => { invalidate(); setRelationships(current => current.filter((_, i) => i !== index)); }}>Remove</Button>
        </fieldset>)}
        <Button type="button" disabled={datasets.length < 2} onClick={() => { invalidate(); setRelationships(current => [...current, { childDataset: datasets[0].name, childColumn: datasets[0].headers[0], parentDataset: datasets[1].name, parentColumn: datasets[1].headers[0] }]); }}>Add relationship</Button>
      </section>
      {!checked && <p className="text-sm text-warning">No data rules selected. Running now checks CSV structure only; it does not establish data readiness.</p>}
      <Button type="button" variant="primary" onClick={validate}>Run validation</Button>
    </Card>}
    {report && <Card aria-label="Validation results" className="space-y-5">
      <h2 className="text-xl font-semibold">Validation results</h2>
      <p role="status" className="font-medium">{!checked ? "No data checks configured" : report.status === "CONFIG_ERROR" ? "Configuration error: review the selected checks" : report.status === "BLOCKED" ? "Configured checks found issues" : report.status === "READY_WITH_WARNINGS" ? "Configured checks passed with warnings" : "Configured checks found no errors"}</p>
      <p className="text-sm text-muted-foreground">Static preflight only. No database import is performed; unconfigured checks and target database compatibility are not verified.</p>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Metric label="Rows" count={report.totals.totalRows} /><Metric label="Rows without findings" count={report.totals.validRows} /><Metric label="Rows with errors" count={report.totals.invalidRows} />
      </dl>
      <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">Suggested order: {report.importOrder.join(" → ") || "No complete order available"}</p>
      <ul className="space-y-1 text-sm [overflow-wrap:anywhere]">{datasets.map(dataset => <li key={dataset.name}>{dataset.filename}: {dataset.rows.length} rows</li>)}</ul>
      {report.issues.length > 0 && <><Table scrollLabel="Demo validation issues" className="min-w-[42rem]">
        <caption className="sr-only">Configured CSV validation findings and investigation guidance</caption>
        <thead><tr><th scope="col">Dataset</th><th scope="col">Physical CSV line</th><th scope="col">Column</th><th scope="col">Finding</th></tr></thead>
        <tbody>{report.issues.slice(issuePage * 50, (issuePage + 1) * 50).map(issue => <tr key={issue.id}><td>{issue.dataset}</td><td>{issue.rowNumber ?? "Not evaluated"}</td><td className="max-w-48 [overflow-wrap:anywhere]">{issue.column ?? "Configuration"}</td><td className="max-w-lg whitespace-normal [overflow-wrap:anywhere]"><p className="font-medium">{issue.code}: {issue.explanation}</p><p className="mt-1 text-muted-foreground">{issue.suggestedInvestigation}</p></td></tr>)}</tbody>
      </Table><div className="flex flex-wrap items-center gap-3 text-sm"><Button type="button" disabled={issuePage === 0} onClick={() => setIssuePage(value => value - 1)}>Previous findings</Button><span>Findings {issuePage * 50 + 1}–{Math.min((issuePage + 1) * 50, report.issues.length)} of {report.issues.length}</span><Button type="button" disabled={(issuePage + 1) * 50 >= report.issues.length} onClick={() => setIssuePage(value => value + 1)}>Next findings</Button></div></>}
      <p className="text-xs text-muted-foreground">Report downloads contain counts, rule codes and column/dataset labels, not cell values. Review metadata before sharing.</p>
      <Button type="button" variant="primary" onClick={download}>Download JSON report</Button>
    </Card>}
  </main>;
}
function Metric({ label, count }: { label: string; count: number | null }) {
  return <div className="min-w-0 rounded-lg bg-surface-muted p-3"><dt className="text-sm text-muted-foreground">{label}</dt><dd className="mt-2 text-2xl font-semibold tabular-nums">{count ?? "Not evaluated"}</dd></div>;
}
function ColumnChecks({ dataset, columns, onChange }: { dataset: ParsedCsv; columns: DemoColumn[]; onChange: (index: number, patch: Partial<DemoColumn>) => void }) {
  const [page, setPage] = useState(0);
  return <fieldset className="min-w-0 space-y-3">
    <legend className="max-w-full text-sm font-medium [overflow-wrap:anywhere]">{dataset.filename} · {dataset.rows.length} rows</legend>
    <Table scrollLabel={"Column checks for " + dataset.filename} className="min-w-[38rem]">
      <caption className="sr-only">Checks for {dataset.filename}; all controls are optional</caption>
      <thead><tr><th scope="col">Column</th><th scope="col">Type</th><th scope="col">Required</th><th scope="col">Primary key</th><th scope="col">Unique</th></tr></thead>
      <tbody>{columns.slice(page * 20, (page + 1) * 20).map((column, position) => <tr key={column.column}>
        <th scope="row" className="max-w-64 whitespace-normal [overflow-wrap:anywhere]">{column.column}</th>
        <td><Select aria-label={"Type for " + dataset.filename + " / " + column.column} value={column.type} onChange={event => onChange(page * 20 + position, { type: event.target.value as DemoColumn["type"] })}><option value="">Not configured</option>{DEMO_TYPES.map(type => <option key={type} value={type}>{type}</option>)}</Select></td>
        {(["required", "primary", "unique"] as const).map(rule => <td key={rule}><Input aria-label={dataset.filename + " / " + column.column + " " + rule} type="checkbox" checked={column[rule]} onChange={event => onChange(page * 20 + position, { [rule]: event.target.checked })} /></td>)}
      </tr>)}</tbody>
    </Table>
    {columns.length > 20 && <div className="flex flex-wrap items-center gap-3 text-sm"><Button type="button" disabled={!page} onClick={() => setPage(value => value - 1)}>Previous columns</Button><span>Columns {page * 20 + 1}–{Math.min((page + 1) * 20, columns.length)} of {columns.length}</span><Button type="button" disabled={(page + 1) * 20 >= columns.length} onClick={() => setPage(value => value + 1)}>Next columns</Button></div>}
  </fieldset>;
}
