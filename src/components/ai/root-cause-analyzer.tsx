"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Button, Input } from "../ui/primitives";
import AiRequestStatus from "./ai-request-status";
import { createRootCauseSession } from "../../lib/ai/root-cause-session";
import { buildRootCauseContext, explainRootCauses, type RootCauseContext, type RootCauseResponse } from "../../lib/ai/root-cause";
import { readImpactEvidence, resolveImpactDataset, resolveImpactIssue, type ImpactEvidence } from "../../lib/ai/impact-evidence";
import { safeAiError } from "../../lib/ai/contracts";
import type { AiRequestState } from "../../lib/ai/session";
import type { RehearsalIssue, RehearsalReportV1 } from "../../lib/rehearsal/types";
import { aiPanel, aiDisclosure, AiLabel, AiProcessingDetails } from "./ai-presentation";
import { hostedAi } from "../../lib/ai/providers/configured";

const idle: AiRequestState<RootCauseResponse> = { status: "idle" };
type Props = {
  report: RehearsalReportV1; evidence: ImpactEvidence | null; evidenceError?: string; revision: object;
  disabled?: boolean; draftsPending?: boolean; focusIssueIds?: readonly string[]; onClearFocus: () => void;
  onViewIssues: (ids: string[]) => void; onLocate: (issue: RehearsalIssue) => void; canLocate: (issue: RehearsalIssue) => boolean;
  onViewDependencies?: () => void;
};

export default function RootCauseAnalyzer({ report, evidence, evidenceError, revision, disabled = false, draftsPending = false, focusIssueIds, onClearFocus, onViewIssues, onLocate, canLocate, onViewDependencies }: Props) {
  const [session] = useState(() => createRootCauseSession());
  const [consent, setConsent] = useState<RootCauseContext | null>(null);
  const [requested, setRequested] = useState<RootCauseContext | null>(null);
  const prepared = useMemo(() => {
    void revision;
    if (!evidence || draftsPending) return { context: null, error: draftsPending ? "Apply or cancel mapping drafts before requesting explanations." : evidenceError || "Detailed evidence is unavailable. Run validation again or use the existing readiness action plan and Issue Explorer." };
    try {
      const facts = readImpactEvidence(evidence);
      const focus = focusIssueIds?.map(id => facts.issues.find(issue => resolveImpactIssue(evidence, issue.id)?.id === id)?.id);
      if (focus?.some(id => !id)) return { context: null, error: "The selected findings are no longer in this report. Review current issues." };
      return { context: buildRootCauseContext(evidence, focus as string[] | undefined), error: "" };
    } catch (error) {
      const safe = safeAiError(error);
      return { context: null, error: safe.code === "CONTEXT_TOO_LARGE" ? focusIssueIds?.length ? "This finding still exceeds the local analysis budget. Use the readiness action plan and Issue Explorer; validation remains available." : "This report exceeds the local analysis budget. In Issue Explorer, choose “Explain this issue with AI” to focus on one finding." : "Detailed evidence is unavailable. Run validation again or inspect the findings manually." };
    }
  }, [evidence, evidenceError, revision, draftsPending, focusIssueIds]);
  const context = prepared.context;
  useEffect(() => {
    session.setContext(context);
    // Cancel on cleanup without disposing the reusable owner during StrictMode setup.
    return () => { session.cancel(); session.setContext(null); };
  }, [session, context]);
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot, () => idle);
  const pending = state.status === "loading", allowed = Boolean(context && consent === context && !disabled && !draftsPending);
  const outdated = requested !== null && requested !== context;
  let analysis: ReturnType<typeof explainRootCauses> | null = null;
  if (state.status === "ready" && context && requested === context) {
    try { analysis = explainRootCauses(context, state.result); } catch { /* Expired evidence is never rendered as current. */ }
  }
  function request() { if (allowed && context && !pending) { setRequested(context); session.setContext(context); void session.run(true); } }
  function citedIssues(ids: readonly string[]) {
    if (!evidence) return [];
    return ids.flatMap(id => { const location = resolveImpactIssue(evidence, id); const issue = location && report.issues.find(issue => issue.id === location.id); return issue ? [issue] : []; });
  }
  return <section aria-labelledby="root-cause-heading" className={aiPanel}>
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 id="root-cause-heading" tabIndex={-1} className="scroll-mt-44 text-base font-semibold">Explain issues with AI</h3>
      {report.issues.length > 0 && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Investigate possible causes linked to verified findings.</p>}</div><AiLabel>Possible causes</AiLabel></div>
    {report.issues.length === 0 ? <p role="status" className="text-sm text-muted-foreground">No validation issues to explain for this report.</p> : <>
      {focusIssueIds && <div className="flex flex-wrap items-center gap-2 text-sm"><p>Focused analysis: {focusIssueIds.length} of {report.issues.length} findings.</p><Button type="button" disabled={pending || disabled} onClick={onClearFocus}>Analyze all issues</Button></div>}
      {prepared.error && <p role="status" className="text-sm text-muted-foreground">{prepared.error}</p>}
      {context && <>
        <label className="flex min-h-11 items-start gap-3 text-sm">
          <Input type="checkbox" className="mt-1" aria-label={hostedAi ? "Allow hosted issue analysis" : "Allow local issue analysis"} checked={consent === context} disabled={pending || disabled} onChange={event => setConsent(event.target.checked ? context : null)} />
          <span>Send issue codes, counts and opaque relationship IDs to {hostedAi ? "Groq (hosted)" : "Ollama on this device"}. Counts may be sensitive. CSV values, dataset/column names and correction history are excluded.</span>
        </label>
        <AiProcessingDetails hosted={hostedAi} />
        <Button type="button" pending={pending} disabled={!allowed || pending} onClick={request}>{pending ? "Analyzing issues…" : "Explain Issues with AI"}</Button>
      </>}
      {(state.status !== "ready" || analysis) && <AiRequestStatus session={session} onRetry={request} retryDisabled={!allowed || pending} showStale={!outdated && Boolean(requested)} loadingMessage="Analyzing issues…" showSpinner={false} readyMessage="Explanations checked against this report. Possible causes still need your review." />}
      {outdated && <p role="status" className="text-sm text-muted-foreground">The workspace changed. Previous AI explanations were discarded; review the current findings and request fresh analysis.</p>}
      {analysis?.abstained && <p role="status" className="text-sm text-muted-foreground">No supported explanation was returned. Use the readiness action plan or inspect individual findings.</p>}
      {analysis && !analysis.abstained && <>
        <ol aria-label="AI issue hypotheses" className="divide-y divide-border border-y border-border">
          {analysis.explanations.map((explanation, index) => {
            const issues = citedIssues(explanation.supportingFindings.map(issue => issue.id));
            const firstLocation = issues.find(canLocate);
            const downstream = evidence ? [...new Set(explanation.potentialDownstream.flatMap(impact => impact.datasetIds).map(id => resolveImpactDataset(evidence, id)).filter((name): name is string => Boolean(name)))] : [];
            return <li key={index} className="min-w-0 py-2 text-sm [overflow-wrap:anywhere]"><details open={index === 0}>
              <summary className={aiDisclosure}><span className="mr-3">AI hypothesis {index + 1} · Possible cause</span><AiLabel tone="advice">Needs investigation</AiLabel></summary>
              <div className="space-y-4 pb-3 pt-2">
              <div className="border-l-2 border-primary pl-3"><h4 className="text-xs font-medium text-muted-foreground">Possible cause · AI hypothesis</h4><p className="mt-1 leading-relaxed">{explanation.possibleCause}</p></div>
              <div className="space-y-2" aria-label={`Verified evidence for hypothesis ${index + 1}`}><h4 className="text-xs font-semibold text-muted-foreground">Verified findings:</h4>
                <ul className="divide-y divide-border rounded-lg border border-border px-3">{issues.map(issue => <li key={issue.id} className="flex flex-col gap-1 py-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0"><code className="text-xs font-medium">{issue.code}</code><p className="text-xs text-muted-foreground">{issue.dataset}{issue.column ? ` · ${issue.column}` : ""}{issue.rowNumber === null ? " · Configuration" : ` · CSV line ${issue.rowNumber}`}</p></div>
                  <Button type="button" className="self-start text-xs sm:shrink-0" disabled={disabled} onClick={() => onViewIssues([issue.id])}>View finding {issue.code}{issue.rowNumber === null ? "" : ` · line ${issue.rowNumber}`}</Button>
                </li>)}</ul>
              </div>
              <div className="flex flex-wrap gap-2">
                {issues.length > 0 && <Button type="button" disabled={disabled} onClick={() => onViewIssues(issues.map(issue => issue.id))}>View cited issues ({issues.length})</Button>}
                {firstLocation && <Button type="button" disabled={disabled} onClick={() => onLocate(firstLocation)}>Locate first cited {firstLocation.column ? "cell" : "record"}</Button>}
              </div>
              {downstream.length > 0 && <div className="space-y-2 border-l-2 border-warning pl-3"><p className="font-medium">Potential downstream impact:</p><div className="flex flex-wrap gap-2">{downstream.map(name => <AiLabel key={name} tone="warning">{name}</AiLabel>)}</div><p className="text-xs text-muted-foreground">Configured dependencies only; affected records are unknown.</p>{onViewDependencies && <Button type="button" disabled={disabled} onClick={onViewDependencies}>View dependency graph</Button>}</div>}
              <div className="border-t border-border pt-3"><h4 className="text-xs font-semibold text-muted-foreground">Investigate next</h4><p className="mt-1 leading-relaxed">{explanation.investigationSteps[0]}</p></div>
              {explanation.investigationSteps.length > 1 && <details><summary className={aiDisclosure + " text-muted-foreground"}>More investigation guidance</summary><ul className="list-disc space-y-1 pl-5">{explanation.investigationSteps.slice(1).map(step => <li key={step}>{step}</li>)}</ul></details>}
              </div></details></li>;
          })}
        </ol>
        <p className="text-sm leading-relaxed text-muted-foreground">{analysis.explanations[0]?.uncertainty}</p>
      </>}
    </>}
  </section>;
}
