"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Button, Input, Select } from "../ui/primitives";
import AiRequestStatus from "./ai-request-status";
import WhatIfPanel from "../corrections/what-if-panel";
import { createSmartRepairSession } from "../../lib/ai/smart-repair-session";
import { buildSmartRepairContext } from "../../lib/ai/smart-repair";
import { createSmartRepairWorkspaceBridge, type SmartRepairWorkspaceSource } from "../../lib/ai/smart-repair-workspace";
import { assertSmartRepairPlanReadyForApproval, validateSmartRepairPlan, type SmartRepairPlan } from "../../lib/ai/smart-repair-plan";
import type { SmartRepairIntent } from "../../lib/ai/smart-repair-contracts";
import { readLocalRepairCandidate } from "../../lib/corrections/repair-candidates";
import { hostedAi } from "../../lib/ai/providers/configured";
import { readRepairVerification } from "../../lib/corrections/repair-verification";
import { getOriginalCellValue } from "../../lib/corrections/engine";
import { issueCorrectionLocation } from "../../lib/corrections/navigation";
import { safeAiError } from "../../lib/ai/contracts";
import type { AiRequestState } from "../../lib/ai/session";
import type { RehearsalIssue } from "../../lib/rehearsal/types";
import { aiPanel, aiDisclosure, AiLabel, AiStep, AiProcessingDetails } from "./ai-presentation";

const idle: AiRequestState<SmartRepairPlan> = Object.freeze({ status: "idle" });
type Props = {
  source: SmartRepairWorkspaceSource | null; dataset: string; scopeKey: string;
  active: boolean; disabled?: boolean; manualEditing: boolean;
  onApprove: (plan: SmartRepairPlan) => void; onLocate: (issue: RehearsalIssue) => void;
};

export default function SmartRepairPlanner({ source, dataset, scopeKey, active, disabled = false, manualEditing, onApprove, onLocate }: Props) {
  const id = useId(), trigger = useRef<HTMLButtonElement>(null);
  const previewFocus = useRef<HTMLDivElement>(null);
  const resultFocus = useRef<HTMLHeadingElement>(null);
  const requestSettings = useRef<HTMLDetailsElement>(null);
  const [session] = useState(() => createSmartRepairSession());
  const [bridge] = useState(createSmartRepairWorkspaceBridge);
  const [expanded, setExpanded] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [interpretation, setInterpretation] = useState<{ source: object; issueId: string; choice: string } | null>(null);
  const issues = useMemo(() => source?.report.issues.filter(issue => issue.dataset === dataset).slice(0, 50) ?? [], [source, dataset]);
  const issue = issues.find(issue => issue.id === selectedId) ?? issues[0];
  const type = issue && source?.configuration?.rules[issue.dataset]?.types[issue.column ?? ""];
  const choice = interpretation?.source === source && interpretation?.issueId === issue?.id ? interpretation.choice : "UNCONFIRMED";
  const intent = useMemo<SmartRepairIntent>(() => {
    if (type === "boolean" && (choice === "YES_NO" || choice === "ONE_ZERO")) return { kind: "CONFIRMED_BOOLEAN", convention: choice };
    if (type === "date" && (choice === "YYYY/MM/DD" || choice === "YYYY-M-D")) return { kind: "CONFIRMED_DATE", format: choice };
    return { kind: "UNCONFIRMED" };
  }, [type, choice]);
  const enabled = Boolean(active && expanded && !disabled && !manualEditing && source && !source.draftsPending && issue);
  // Identity changes immediately hide stale output, before lifecycle cleanup runs.
  const scope = useMemo(() => ({ source, scopeKey, issueId: issue?.id, intent, enabled }), [source, scopeKey, issue?.id, intent, enabled]);
  const [consent, setConsent] = useState<object | null>(null);
  const [requested, setRequested] = useState<{ scope: object; context: ReturnType<typeof buildSmartRepairContext> } | null>(null);
  const [previewed, setPreviewed] = useState<SmartRepairPlan | null>(null);
  const [actionError, setActionError] = useState("");
  useLayoutEffect(() => {
    bridge.update(enabled ? source : null, intent); session.setContext(null);
    return () => { session.cancel(); session.setContext(null); bridge.clear(); };
  }, [bridge, session, source, scope, intent, enabled]);
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot, () => idle);
  const current = requested?.scope === scope && enabled;
  const pending = current && state.status === "loading";
  const allowed = enabled && consent === scope && !pending;
  let plan: SmartRepairPlan | null = null;
  if (current && state.status === "ready") {
    try { plan = validateSmartRepairPlan(requested.context, state.result); } catch { /* Never render expired capabilities. */ }
  }
  let local: ReturnType<typeof readLocalRepairCandidate> | null = null;
  let verification: ReturnType<typeof readRepairVerification> | null = null;
  if (plan?.resolution.outcome === "ACTIONABLE_CANDIDATE" && plan.verification?.outcome === "PREVIEW_READY") {
    try { local = readLocalRepairCandidate(plan.resolution.candidate); verification = readRepairVerification(plan.verification.verification); }
    catch { plan = null; }
  }
  const shownPreview = plan && previewed === plan && verification;
  const canApply = Boolean(shownPreview && verification?.impact === "PREFLIGHT_IMPROVEMENT");
  useEffect(() => {
    if (shownPreview) { previewFocus.current?.focus({ preventScroll: true }); previewFocus.current?.scrollIntoView({ block: "start" }); }
  }, [shownPreview]);
  useEffect(() => {
    if (plan) { resultFocus.current?.focus({ preventScroll: true }); resultFocus.current?.scrollIntoView({ block: "start" }); }
  }, [plan]);

  function request() {
    if (!allowed || !issue) return;
    try {
      const context = buildSmartRepairContext({ getSnapshot: bridge.getSnapshot, issueId: issue.id });
      setActionError(""); setPreviewed(null); setRequested({ scope, context }); session.setContext(context); void session.run(true);
    } catch (error) { setActionError(safeAiError(error).message); }
  }
  function dismiss() {
    session.cancel(); session.setContext(null); bridge.clear(); setExpanded(false); setActionError(""); trigger.current?.focus();
  }
  function preview() {
    if (!plan || !requested) return;
    try { validateSmartRepairPlan(requested.context, plan); setPreviewed(plan); setActionError(""); }
    catch { setActionError("The workspace changed. Request a fresh suggestion."); }
  }
  function apply() {
    if (!plan || !canApply) return;
    try {
      assertSmartRepairPlanReadyForApproval(plan);
      if (!window.confirm("Apply this one-cell correction? Original CSV values remain recoverable and Undo is available.")) return;
      assertSmartRepairPlanReadyForApproval(plan);
      onApprove(plan); // Synchronous existing correction handler; no gap after freshness checks.
      session.cancel(); session.setContext(null); bridge.clear(); setConsent(null); setPreviewed(null); setActionError("");
      trigger.current?.focus();
    } catch { setActionError("This correction could not be approved. Review the current cell and request a fresh suggestion."); }
  }
  const guidance = plan && !local;
  return <section aria-labelledby={`${id}-title`} className={aiPanel}>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="space-y-2"><h3 id={`${id}-title`} className="text-base font-semibold">AI repair planner</h3><AiLabel>One cell at a time</AiLabel></div>
      <Button ref={trigger} type="button" aria-expanded={expanded} aria-controls={`${id}-controls`} disabled={disabled} onClick={() => expanded ? dismiss() : setExpanded(true)}>{expanded ? "Close AI planner" : "Suggest fixes with AI"}</Button>
    </div>
    {expanded && <div id={`${id}-controls`} className="min-w-0 space-y-3">
      <p className="text-sm leading-relaxed text-muted-foreground">Review a suggested repair, preview its effect, then approve the change.</p>
      <ol aria-label="Repair review stages" className="grid grid-cols-1 gap-3 border-y border-border py-3 sm:grid-cols-3">
        <AiStep number={1} title="Suggested repair" current={!local} />
        <AiStep number={2} title="What-if preview" current={Boolean(local && !canApply)} />
        <AiStep number={3} title="Apply correction" current={canApply} />
      </ol>
      {issue && <div role="group" aria-label="Selected repair context" className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>{issue.code}{issue.rowNumber === null ? " · Configuration" : ` · CSV line ${issue.rowNumber}`}{issue.column ? ` · ${issue.column}` : ""}</span>
        {type && <AiLabel>Configured type: {type}</AiLabel>}
        {type === "boolean" && <AiLabel tone={intent.kind === "CONFIRMED_BOOLEAN" ? "neutral" : "warning"}>{intent.kind === "CONFIRMED_BOOLEAN" ? `Confirmed boolean: ${intent.convention === "YES_NO" ? "yes / no" : "1 / 0"}` : "Boolean convention not confirmed"}</AiLabel>}
        {type === "date" && <AiLabel tone={intent.kind === "CONFIRMED_DATE" ? "neutral" : "warning"}>{intent.kind === "CONFIRMED_DATE" ? `Confirmed date format: ${intent.format}` : "Date format not confirmed"}</AiLabel>}
      </div>}
      <details ref={requestSettings} open={!plan}>
      <summary className={aiDisclosure}>Request settings</summary>
      <div className="space-y-3">
      {!source ? <p role="status" className="text-sm text-muted-foreground">Run validation to plan fixes from current findings. Manual correction remains available.</p>
        : manualEditing ? <p role="status" className="text-sm text-muted-foreground">Apply or cancel the current cell draft before requesting a fix. Your draft is preserved.</p>
          : source.draftsPending ? <p role="status" className="text-sm text-muted-foreground">Apply or cancel configuration drafts, then run validation again.</p>
            : !issue ? <p role="status" className="text-sm text-muted-foreground">No current findings in this dataset to repair.</p> : <>
        <label className="block text-sm font-medium">Finding to investigate
          <Select aria-label="Finding to investigate" className="mt-1" value={issue.id} disabled={pending} onChange={event => { session.cancel(); setSelectedId(event.target.value); setActionError(""); }}>
            {issues.map(item => <option key={item.id} value={item.id}>{item.code} · {item.rowNumber === null ? "Configuration" : `CSV line ${item.rowNumber}`}{item.column ? ` · ${item.column}` : ""}</option>)}
          </Select>
        </label>
        {source.report.issues.filter(item => item.dataset === dataset).length > 50 && <p className="text-xs text-muted-foreground">Showing the first 50 findings in this dataset. Use Review to inspect other findings.</p>}
        {issue.code === "INVALID_TYPE" && (type === "boolean" || type === "date") && <label className="block text-sm font-medium">{type === "boolean" ? "Source boolean convention" : "Source date format"}
          <Select aria-label={type === "boolean" ? "Source boolean convention" : "Source date format"} className="mt-1" value={choice} disabled={pending} onChange={event => {
            session.cancel(); setInterpretation({ source, issueId: issue.id, choice: event.target.value }); setActionError("");
          }}>
            <option value="UNCONFIRMED">Unknown — investigate first</option>
            {type === "boolean" ? <><option value="YES_NO">Confirmed: yes / no</option><option value="ONE_ZERO">Confirmed: 1 / 0</option></> : <><option value="YYYY/MM/DD">Confirmed: YYYY/MM/DD</option><option value="YYYY-M-D">Confirmed: YYYY-M-D</option></>}
          </Select><span className="mt-1 block text-xs font-normal text-muted-foreground">Confirm only the source meaning you know. AI cannot choose it for you.</span>
        </label>}
        <label className="flex min-h-11 items-start gap-3 text-sm">
          <Input type="checkbox" className="mt-1" aria-label={hostedAi ? "Allow hosted repair strategy request" : "Allow local repair strategy request"} checked={consent === scope} disabled={pending || !enabled} onChange={event => setConsent(event.target.checked ? scope : null)} />
          <span>Send issue categories, permitted strategy IDs and counts to {hostedAi ? "Groq (hosted)" : "Ollama on this device"}. Counts may be sensitive. CSV values, private labels and correction history are excluded.</span>
        </label>
        <AiProcessingDetails hosted={hostedAi} />
        <Button type="button" disabled={!allowed} pending={pending} onClick={request}>{pending ? "Finding repair options…" : "Suggest fix"}</Button>
        {enabled && !pending && consent !== scope && <p className="text-xs text-muted-foreground">Review and allow this request to continue. Changing the finding or source meaning requires fresh consent.</p>}
      </>}
      </div>
      </details>
      {actionError && <p role="alert" className="text-sm text-danger">{actionError}</p>}
      {current && state.status !== "ready" && <AiRequestStatus session={session} onRetry={request} retryDisabled={!allowed} loadingMessage="Finding repair options…" showSpinner={false} />}
      {plan && <div className="min-w-0 space-y-3 text-sm">
        <div className="border-t border-border pt-3"><h4 ref={resultFocus} tabIndex={-1} className="scroll-mt-44 rounded-md font-semibold">AI suggestion</h4>
          {!shownPreview && <p role="status" className="mt-2"><AiLabel tone="advice">{local ? "Step 2 of 3 · What-if preview" : "Step 1 of 3 · Suggested repair"}</AiLabel></p>}
          {!local && <div role="note" aria-label="Repair availability" className="mt-3 space-y-2 rounded-lg border border-border bg-surface-muted p-3">
            <AiLabel tone="warning">{plan.resolution.outcome === "REQUIRES_USER_INPUT" ? "Input required" : plan.resolution.outcome === "GUIDANCE_ONLY" ? "Guidance only" : plan.resolution.outcome === "ACTIONABLE_CANDIDATE" ? "Verification blocked" : "No supported repair"}</AiLabel>
            <p>What-if preview and Apply correction are unavailable for this result. No eligible replacement has been prepared.</p>
          </div>}
          <p className="mt-1">{local
          ? plan.selection.outcome === "ACTIONABLE_CANDIDATE" && plan.selection.strategyId === "BOOLEAN_FROM_CONFIRMED_CONVENTION"
            ? "Normalize values using the boolean convention you confirmed." : "Normalize the year-first date format you confirmed."
          : plan.resolution.explanation}</p></div>
        {plan.verification && plan.verification.outcome !== "PREVIEW_READY" && <p role="status">{plan.verification.explanation}</p>}
        {local && source && <>
          <p className="font-medium">Local candidate · {local.edit.dataset} · CSV line {local.edit.rowNumber} · {local.edit.column}</p>
          <dl className="grid min-w-0 gap-2 sm:grid-cols-2">
            {(getOriginalCellValue(source.corrections, local.edit) === local.edit.expectedValue
              ? [["Original / current", local.edit.expectedValue], ["Proposed", local.edit.value]]
              : [["Original", getOriginalCellValue(source.corrections, local.edit)], ["Current", local.edit.expectedValue], ["Proposed", local.edit.value]])
              .map(([label, value]) => <div key={label} className="min-w-0"><dt className="flex flex-wrap items-center gap-2 text-xs font-semibold text-muted-foreground">{label}{label === "Proposed" && value !== local.edit.expectedValue && <AiLabel tone="advice">Changed value</AiLabel>}</dt><dd tabIndex={0} role="region" aria-label={`${label} repair value`} className={`mt-1 max-h-24 overflow-auto whitespace-pre-wrap break-all rounded-md border p-3 font-mono outline-offset-2 ${label === "Proposed" && value !== local.edit.expectedValue ? "border-primary bg-info-surface" : "border-border bg-surface-muted"}`}>{value || "(empty)"}</dd></div>)}
          </dl>
          <p className="text-xs text-muted-foreground">These cell values are shown only in this browser.</p>
          {!shownPreview && <Button type="button" onClick={preview}>Preview fix</Button>}
          {shownPreview && <div ref={previewFocus} tabIndex={-1} role="region" aria-label="Verified repair preview" className="min-w-0 scroll-mt-44 space-y-3 border-t border-border pt-3">
            <p role="status"><AiLabel tone={canApply ? "advice" : "warning"}>{canApply ? "Step 3 of 3 · Apply correction" : "Step 2 of 3 · Review preview findings"}</AiLabel></p>
            <p className="font-semibold">Verified deterministic simulation</p>
            <p className="text-sm text-muted-foreground">Simulated only. A supported improvement still requires your explicit approval.</p>
            <WhatIfPanel preview={verification!.preview} findings={verification!.preview.findings} titleId={`${id}-what-if`} canApply={canApply} compact />
            <details><summary className={aiDisclosure + " text-muted-foreground"}>Verification details</summary><p className="pb-2 leading-relaxed">{verification!.explanation}</p></details>
            <div className="flex flex-wrap gap-2"><Button className="grow sm:grow-0" type="button" variant="primary" disabled={!canApply || disabled} onClick={apply}>Apply suggested correction</Button>
              <Button className="grow sm:grow-0" type="button" onClick={() => { session.cancel(); setPreviewed(null); trigger.current?.focus(); }}>Cancel preview</Button></div>
          </div>}
        </>}
        {guidance && issue && <div className="space-y-2"><p><strong>Investigate locally:</strong> {issue.suggestedInvestigation}</p>
          {issue.code === "INVALID_TYPE" && issue.column && !disabled && <div className="space-y-2">
            <p className="text-muted-foreground">This column is configured as {type ?? "an unspecified type"}. If that rule does not match the intended data, review its field type. Otherwise inspect the source value; no conversion will be guessed.</p>
            <a href={`#mapping-${encodeURIComponent(issue.dataset)}-type-${encodeURIComponent(issue.column)}`} className="inline-flex min-h-11 items-center rounded-lg border border-control-border bg-surface px-4 py-2 text-sm font-medium hover:bg-surface-muted">Review field type</a>
          </div>}
          {plan.resolution.outcome === "REQUIRES_USER_INPUT" && <Button type="button" disabled={disabled} onClick={() => {
            if (requestSettings.current) { requestSettings.current.open = true; requestSettings.current.querySelector("summary")?.focus(); }
          }}>Review required input</Button>}
          {source && issueCorrectionLocation(issue, source.corrections, source.configuration?.mappings ?? {}) && <Button type="button" disabled={disabled} onClick={() => { session.cancel(); onLocate(issue); }}>Inspect finding</Button>}</div>}
      </div>}
      <Button type="button" onClick={dismiss}>Dismiss AI planner</Button>
    </div>}
  </section>;
}
