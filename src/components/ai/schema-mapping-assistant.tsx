"use client";

import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { TemplateConfiguration } from "../../lib/templates/schema";
import { createAiVersion, safeAiError, sameAiVersion } from "../../lib/ai/contracts";
import { createConfiguredAiProvider, hostedAi } from "../../lib/ai/providers/configured";
import { createAiRequestSession, type AiRequestState } from "../../lib/ai/session";
import {
  approveSchemaSuggestions, buildSchemaMappingContext, possibleSchemaRenames, schemaMappingDetails,
  schemaColumnEvidence, schemaSuggestionChanges, schemaSuggestionBasis, hasSchemaSuggestionChange, serializeSchemaMappingContext, validateSchemaMappingResponse,
  type SchemaMappingContext, type SchemaMappingResponse,
} from "../../lib/ai/schema-mapping";
import type { ColumnProfile, ProfileDataset } from "../../lib/ai/column-profile";
import { Button, Input } from "../ui/primitives";
import { ArrowRight } from "lucide-react";
import { aiPanel, aiDisclosure, AiLabel, AiProcessingDetails } from "./ai-presentation";

const idle: AiRequestState<SchemaMappingResponse> = { status: "idle" };
type Props = {
  configuration: TemplateConfiguration | null;
  datasetName: string;
  dataset?: ProfileDataset;
  template: TemplateConfiguration | null;
  revision: object;
  disabled?: boolean;
  onApprove: (configuration: TemplateConfiguration) => void;
};

function evidenceSummary(profile: ColumnProfile | null): string[] {
  if (!profile) return ["No local values available"];
  const warnings: string[] = [];
  if (profile.empty) warnings.push(`Missing: ${profile.empty}/${profile.rows}`);
  for (const format of ["email", "date"] as const) if (profile.formats[format].like && profile.formats[format].invalid) warnings.push(`Invalid ${format}: ${profile.formats[format].invalid}/${profile.nonEmpty} populated`);
  if (profile.duplicateRows) warnings.push(`Duplicates: ${profile.duplicateRows} rows (${profile.repeatedValues} repeated ${profile.repeatedValues === 1 ? "value" : "values"}); key suggestions blocked`);
  if (profile.leadingZeros) warnings.push(`Leading zeros: ${profile.leadingZeros}; preserve as text`);
  if (profile.unsafeIntegers) warnings.push(`Unsafe integers: ${profile.unsafeIntegers}; preserve as text`);
  return warnings;
}

export default function SchemaMappingAssistant({ configuration, datasetName, dataset, template, revision, disabled = false, onApprove }: Props) {
  const evidenceId = useId();
  const [session] = useState(() => {
    const provider = createConfiguredAiProvider();
    return createAiRequestSession<SchemaMappingContext, SchemaMappingResponse>(provider.suggestSchemaMapping, serializeSchemaMappingContext, validateSchemaMappingResponse);
  });
  const [consent, setConsent] = useState<SchemaMappingContext | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const [dismissed, setDismissed] = useState<SchemaMappingResponse | null>(null);
  const startButton = useRef<HTMLButtonElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const restoreFocus = useRef(false);
  const contextResult = useMemo(() => {
    // revision also changes for corrections/Undo/Redo, results, drafts and project replacement.
    void revision;
    if (!configuration || !datasetName) return { context: null, error: "Apply or cancel mapping drafts before requesting suggestions." };
    try { return { context: buildSchemaMappingContext({ configuration, datasetName, dataset, template, version: createAiVersion() }), error: "" }; }
    catch (error) { return { context: null, error: safeAiError(error).message }; }
  }, [configuration, datasetName, dataset, template, revision]);
  const context = contextResult.context;
  useEffect(() => {
    session.setContext(context);
    // Release context/output and abort on cleanup; this owner can be reused by StrictMode setup.
    return () => { session.cancel(); session.setContext(null); };
  }, [session, context]);
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot, () => idle);
  const pending = state.status === "loading";
  useEffect(() => {
    if (!pending && restoreFocus.current) { restoreFocus.current = false; startButton.current?.focus(); }
  }, [pending]);
  const response = state.status === "ready" && context && sameAiVersion(state.version, context.version) && state.result !== dismissed ? state.result : null;
  const details = context ? schemaMappingDetails(context) : null;
  const renames = context && response ? possibleSchemaRenames(context, response) : [];
  const allowed = Boolean(context && consent === context && !disabled && session);
  // Validate the complete response first; hiding no-ops must never conceal an invalid item.
  const usefulSuggestions = context && response ? response.suggestions.filter(suggestion => hasSchemaSuggestionChange(context, suggestion)) : [];
  const selectedForResponse = selected.filter(id => usefulSuggestions.some(suggestion => suggestion.sourceId === id));
  let preview: TemplateConfiguration | null = null, previewError = "";
  if (context && response && selectedForResponse.length) {
    try { preview = approveSchemaSuggestions(context, response, selectedForResponse); }
    catch { previewError = "These selections conflict. Choose distinct target names and at most one primary-key candidate, or edit the mapping manually."; }
  }
  function request() {
    if (!allowed || !context || !session) return;
    setSelected([]); setNotice(""); setDismissed(null);
    session.setContext(context);
    void session.run(true);
  }
  function reject() {
    setDismissed(response); setSelected([]);
    setNotice("Suggestions dismissed. Mappings, rules, corrections and history are unchanged.");
    heading.current?.focus();
  }
  function approve() {
    if (!preview || !response || !context || disabled) return;
    if (!window.confirm("Apply the selected AI suggestions? Only this dataset's selected mappings and rules will change. Existing rules follow renamed targets. An approved primary-key suggestion replaces its current primary/composite key. Relationships remain unchanged; review them after renaming. Current results will be cleared. CSV values, corrections and Undo/Redo history remain unchanged.")) return;
    onApprove(preview);
    setDismissed(response); setSelected([]);
    setNotice("Selected suggestions applied. Review relationships and run validation again.");
    heading.current?.focus();
  }
  function showEvidence(sourceId: string) {
    const disclosure = document.getElementById(`${evidenceId}-${sourceId}`) as HTMLDetailsElement | null;
    if (!disclosure) return;
    disclosure.open = true;
    disclosure.querySelector("summary")?.focus({ preventScroll: true });
    disclosure.scrollIntoView({ block: "center", behavior: "instant" });
  }
  return <section aria-label="AI schema mapping" className={aiPanel}>
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 ref={heading} tabIndex={-1} className="scroll-mt-44 rounded-md text-base font-semibold">Schema suggestions</h3>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Review the evidence and choose which settings to apply.</p></div><AiLabel tone="advice">AI suggestions</AiLabel></div>
    {details?.drift.status === "no_template" && <p className="text-sm text-muted-foreground">No approved template selected. There is no previous schema to compare. Select a saved template under Project and mapping templates to check drift.</p>}
    {details?.drift.status === "dataset_missing" && <p className="text-sm text-warning">The selected template has no matching dataset name. No previous schema is assumed for this dataset.</p>}
    {details?.drift.status === "compared" && <details aria-label="Schema drift comparison" className="rounded-lg border border-border bg-surface-muted px-3 text-sm [overflow-wrap:anywhere]">
      <summary className={aiDisclosure}>Template comparison <span className="ml-2 font-normal text-muted-foreground">{details.drift.added.length} added · {details.drift.removed.length} removed · {details.drift.incompatible.length} type conflicts{details.drift.reordered ? " · Reordered" : ""}</span></summary>
      <div className="space-y-1 pb-3">
      <p className="font-medium">Compared with the selected approved template</p>
      <p>Added columns: {details.drift.added.join(", ") || "None"}. Removed columns: {details.drift.removed.join(", ") || "None"}.</p>
      {details.drift.reordered && <p>Column order changed.</p>}
      {details.drift.incompatible.map(item => <p key={item.column} className="text-warning">Configured type conflict: {item.column} — {item.previous} in template, {item.current} now. This compares settings; local value checks appear above.</p>)}
      {details.drift.compatibility && !details.drift.compatibility.ok && <p className="text-warning">{details.drift.compatibility.reason} Direct template loading remains blocked; suggestions do not change its compatibility rules.</p>}
    </div></details>}
    <div className="border-t border-border pt-4"><h4 className="mb-2 text-sm font-medium">Request suggestions</h4>
    <label className="flex min-h-11 items-start gap-3 text-sm">
      <Input type="checkbox" className="mt-1" aria-label={hostedAi ? "Allow hosted schema metadata request" : "Allow local schema metadata request"} disabled={!context || pending || disabled} checked={Boolean(context && consent === context)} onChange={event => setConsent(event.target.checked ? context : null)} />
      <span>Send column names, candidate targets, configured rules and counts to {hostedAi ? "Groq (hosted)" : "Ollama on this device"}. Names and counts may be sensitive. CSV values, dataset/project names and correction history are excluded.</span>
    </label><AiProcessingDetails hosted={hostedAi} /></div>
    <div className="flex flex-wrap gap-2">
      <Button ref={startButton} type="button" pending={pending} disabled={!allowed || pending} onClick={request}>{pending ? "Analyzing mappings…" : state.status === "error" || state.status === "cancelled" ? "Retry schema suggestions" : "Suggest schema settings"}</Button>
      {pending && <Button type="button" onClick={() => { restoreFocus.current = true; session.cancel(); }}>Cancel schema request</Button>}
    </div>
    {contextResult.error && <p role="status" className="text-sm text-muted-foreground">{contextResult.error}</p>}
    {pending && <p role="status" className="text-sm text-muted-foreground">{state.phase === "checking-model" ? hostedAi ? "Checking hosted AI…" : "Checking the local model…" : "Analyzing mappings…"} Validation remains available.</p>}
    {state.status === "error" && <p role="alert" className="text-sm text-danger">{state.message}</p>}
    {(state.status === "stale" || (state.status === "ready" && context && !sameAiVersion(state.version, context.version))) && <p role="status" className="text-sm text-muted-foreground">Workspace or template changed. Previous suggestions were discarded; request new suggestions.</p>}
    {state.status === "cancelled" && <p role="status" className="text-sm text-muted-foreground">Request cancelled. Your data and configuration are unchanged.</p>}
    {response && details && <div className="space-y-3 border-t border-border pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="text-sm font-semibold">AI recommendations</h4><AiLabel tone="advice">{selectedForResponse.length} of {usefulSuggestions.length} selected</AiLabel></div>
      <p role="status" className="text-sm">{usefulSuggestions.length ? "Unverified suggestions. Proposed settings passed local compatibility checks; confirm their business meaning before applying." : "No safe schema changes recommended"}</p>
      {renames.map(item => <p key={item.current} className="text-sm text-warning [overflow-wrap:anywhere]">Possible rename: {item.previous} → {item.current}. This is a hypothesis, not a confirmed change.</p>)}
      <ul className="divide-y divide-border rounded-lg border border-border px-3">
        {usefulSuggestions.map(suggestion => {
          const column = details.columns.find(column => column.id === suggestion.sourceId)!;
          const target = details.targets.find(target => target.id === (suggestion.targetId ?? column.currentTarget));
          return <li key={suggestion.sourceId} className="min-w-0 py-3">
            <div className="flex flex-col items-start justify-between gap-x-4 gap-y-1 sm:flex-row"><label className="flex min-h-11 min-w-0 w-full flex-1 items-start gap-3 text-sm">
              <Input className="mt-1" type="checkbox" aria-label={`Accept suggestion for ${column.name}`} disabled={disabled} checked={selectedForResponse.includes(suggestion.sourceId)} onChange={event => setSelected(previous => event.target.checked ? [...previous, suggestion.sourceId] : previous.filter(id => id !== suggestion.sourceId))} />
              <span className="min-w-0 flex-1 space-y-2 [overflow-wrap:anywhere]">
                <span className="grid min-w-0 grid-cols-1 items-center gap-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
                  <span className="min-w-0"><span className="block text-xs text-muted-foreground">CSV column</span><span className="block font-mono text-sm font-medium">{column.name}</span></span>
                  <ArrowRight aria-hidden="true" className="size-4 rotate-90 text-muted-foreground sm:rotate-0" />
                  <span className="min-w-0"><span className="block text-xs text-muted-foreground">Suggested field</span><span className="block font-mono text-sm font-medium">{target?.name ?? "No target suggested"}</span></span>
                </span>
                <span className="flex flex-wrap gap-2"><AiLabel tone="advice">Needs review</AiLabel><AiLabel>Type: {suggestion.type ?? column.type ?? "Not configured"}</AiLabel></span>
                {context && <span className="block">{schemaSuggestionChanges(context, suggestion).join(" · ")}</span>}
              </span>
            </label>
            <button type="button" aria-label={`View evidence for ${column.name}`} className="ml-7 min-h-11 shrink-0 rounded px-2 text-sm text-primary underline underline-offset-4 sm:ml-0" onClick={() => showEvidence(column.id)}>View evidence</button></div>
            {context && schemaSuggestionBasis(context, suggestion) && <details className="ml-7 text-sm"><summary className={aiDisclosure + " text-muted-foreground"}>Why this suggestion?</summary><p className="pb-2 text-muted-foreground">{schemaSuggestionBasis(context, suggestion)}</p></details>}
          </li>;
        })}
      </ul>
      {usefulSuggestions.length > 0 && <p className="text-sm text-muted-foreground">Applying changes clears current results. CSV records and correction history stay unchanged. Review relationships after renaming and run validation again.</p>}
      {previewError && <p role="alert" className="text-sm text-danger">{previewError}</p>}
      <div className="flex flex-wrap gap-2"><Button className="grow sm:grow-0" type="button" variant="primary" disabled={!preview || disabled} onClick={approve}>Apply selected suggestions</Button><Button className="grow sm:grow-0" type="button" onClick={reject}>Reject suggestions</Button></div>
    </div>}
    {details && context && <div role="group" aria-label="Local column evidence" className="space-y-2 text-sm">
      <h4 className="font-medium">Browser-local evidence <span className="font-normal text-muted-foreground">· {details.columns.every(column => column.profile) ? "Verified against current records" : "Local values unavailable"}</span></h4>
      <ul className="grid gap-x-5 md:grid-cols-2">{details.columns.map(column => {
        const warnings = evidenceSummary(column.profile);
        return <li key={column.id} className="min-w-0 border-b border-border [overflow-wrap:anywhere]">
        <details id={`${evidenceId}-${column.id}`}>
          <summary aria-label={`Evidence details for ${column.name}`} aria-describedby={`${evidenceId}-${column.id}-types${warnings.length ? ` ${evidenceId}-${column.id}-warnings` : ""}`} className="cursor-pointer rounded py-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring">
            <span className="font-medium">{column.name}</span><span id={`${evidenceId}-${column.id}-types`} className="text-muted-foreground"> · Inferred: {column.profile?.inferredType ?? "Unknown"} · Configured: {column.type ?? "Not set"}</span>
            {warnings.length > 0 && <span id={`${evidenceId}-${column.id}-warnings`} className="mt-1 block text-warning">{warnings.join(" · ")}</span>}
          </summary>
          <div className="space-y-1 pb-3 text-muted-foreground">{schemaColumnEvidence(context, column.id).map((message, index) => <p key={index}>{message}</p>)}</div>
        </details>
      </li>; })}</ul>
    </div>}
    {notice && <p role="status" className="text-sm text-muted-foreground">{notice}</p>}
  </section>;
}
