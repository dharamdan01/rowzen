"use client";

import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { issueCorrectionLocation, type CorrectionLocation } from "../../lib/corrections/navigation";
import { Button, Card, Select, Table, Textarea } from "../ui/primitives";
import CorrectionHistory from "./correction-history";
import WhatIfPanel from "./what-if-panel";
import SmartRepairPlanner from "../ai/smart-repair-planner";
import type { SmartRepairWorkspaceSource } from "../../lib/ai/smart-repair-workspace";
import { assertSmartRepairPlanReadyForApproval, type SmartRepairPlan } from "../../lib/ai/smart-repair-plan";
import { readLocalRepairCandidate } from "../../lib/corrections/repair-candidates";
import type { WhatIfPreview } from "../../lib/corrections/what-if";
import { createCorrectionActivityState, recordCorrectionActivity } from "../../lib/corrections/history";
import { readinessStyles } from "../reports/report-status";
import type { ReadinessStatus, RehearsalIssue } from "../../lib/rehearsal/types";
import type { ColumnMapping } from "../../lib/rehearsal/mapping";
import {
  getEffectiveCorrections,
  getOriginalCellValue,
} from "../../lib/corrections/engine";
import type { CellAddress, CellEditRequest, CorrectionState } from "../../lib/corrections/types";

const ROWS_PER_PAGE = 10;

type PendingEdit = CellAddress & { expectedValue: string; value: string };

function focusCellEditor(editor: HTMLTextAreaElement | null) {
  editor?.focus();
  editor?.scrollIntoView({ block: "center", inline: "center" });
}

export type CorrectionNavigationHandle = { locate: (location: CorrectionLocation) => boolean };

export interface CorrectionWorkspaceProps {
  repairSource?: SmartRepairWorkspaceSource | null;
  repairDisabled?: boolean;
  active?: boolean;
  navigationRef?: Ref<CorrectionNavigationHandle>;
  state: CorrectionState;
  issues: readonly RehearsalIssue[];
  mappings: Readonly<Record<string, readonly ColumnMapping[]>>;
  onApprove: (edit: CellEditRequest) => void;
  /** Optional to preserve legacy component test consumers. */
  onPreview?: (edit: CellEditRequest) => WhatIfPreview;
  /** Configuration-only fingerprint: hides stale previews on mapping/rule/FK changes. */
  previewContextKey?: string;
  onUndo: () => void;
  onRedo: () => void;
  onDiscard: () => void;
  /** Current canonical result; null means no current result, never a clean bill of health. */
  validationStatus?: ReadinessStatus | null;
  validationError?: string;
}

/**
 * Edit only one physical source cell at a time. The draft is not applied until
 * the user explicitly approves it. Full CSV values remain in browser memory.
 * The parent reruns Phase 6 after approved corrections; drafts do not affect the current report.
 */
export default function CorrectionWorkspace({
  state, issues, mappings, onApprove, onPreview, previewContextKey = "", onUndo, onRedo, onDiscard,
  validationStatus = null, validationError = "", navigationRef, active = true, repairSource, repairDisabled = false,
}: CorrectionWorkspaceProps) {
  const [locationVersion, setLocationVersion] = useState(0);
  const [datasetName, setDatasetName] = useState(state.current[0]?.name ?? "");
  const [page, setPage] = useState(1);
  const [pending, setPending] = useState<PendingEdit | null>(null);
  const [editError, setEditError] = useState("");
  const [status, setStatus] = useState("");
  const [activity, setActivity] = useState(createCorrectionActivityState);
  const [preview, setPreview] = useState<{
    value: WhatIfPreview;
    state: CorrectionState;
    draft: PendingEdit;
    contextKey: string;
  } | null>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const requestedLocation = useRef<CorrectionLocation | null>(null);
  const rowHeaders = useRef(new Map<string, HTMLTableCellElement>());
  const editButtons = useRef(new Map<string, HTMLButtonElement>());
  const returnFocusKey = useRef<string | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const pendingKey = pending ? JSON.stringify([pending.dataset, pending.rowNumber, pending.column]) : null;

  useEffect(() => {
    if (!active) return;
    const requested = requestedLocation.current;
    if (requested) {
      requestedLocation.current = null;
      if (requested.column === null) {
        const row = rowHeaders.current.get(JSON.stringify([requested.dataset,requested.rowNumber]));
        row?.focus(); row?.scrollIntoView({ block: "center", inline: "nearest" });
      } else focusCellEditor(editorRef.current);
      return;
    }
    if (pendingKey) {
      focusCellEditor(editorRef.current);
    } else if (returnFocusKey.current) {
      // A page/dataset change may remove the edited cell: never focus a detached node.
      editButtons.current.get(returnFocusKey.current)?.focus();
      returnFocusKey.current = null;
    }
  }, [pendingKey, locationVersion, active]);

  useEffect(() => {
    if (editError) focusCellEditor(editorRef.current);
  }, [editError]);

  useEffect(() => {
    if (preview) previewRef.current?.focus();
  }, [preview]);

  const selected = state.current.find((item) => item.name === datasetName) ?? state.current[0];
  const effective = getEffectiveCorrections(state);
  const totalPages = selected ? Math.max(1, Math.ceil(selected.rows.length / ROWS_PER_PAGE)) : 1;
  const visiblePage = Math.min(page, totalPages);
  const start = (visiblePage - 1) * ROWS_PER_PAGE;
  const rows = selected?.rows.slice(start, start + ROWS_PER_PAGE) ?? [];

  function startEdit(address: CellAddress, value: string) {
    returnFocusKey.current = JSON.stringify([address.dataset, address.rowNumber, address.column]);
    setPending({ ...address, expectedValue: value, value });
    setPreview(null);
    setEditError("");
    setStatus("");
  }

  function navigateToRecord(location: CorrectionLocation): boolean {
    const dataset = state.current.find(entry => entry.name === location.dataset);
    const index = dataset?.rowNumbers.indexOf(location.rowNumber) ?? -1;
    if (!dataset || index < 0 || (location.column !== null && !dataset.headers.includes(location.column))) return false;
    const sameCell = pending?.dataset === location.dataset && pending.rowNumber === location.rowNumber && pending.column === location.column;
    if (sameCell) { focusCellEditor(editorRef.current); return true; }
    if (pending && pending.value !== pending.expectedValue && !window.confirm("Discard the unapplied cell draft and locate this finding? Approved corrections and history will stay unchanged.")) return false;
    setDatasetName(dataset.name);
    setPage(Math.floor(index / ROWS_PER_PAGE) + 1);
    setPreview(null); setEditError("");
    if (location.column !== null) startEdit({ ...location, column: location.column },dataset.rows[index][location.column]);
    else { setPending(null); returnFocusKey.current = null; }
    requestedLocation.current = location;
    setLocationVersion(version => version + 1);
    setStatus(`Located ${dataset.filename}, CSV line ${location.rowNumber}${location.column ? `, source column ${location.column}` : ""}.`);
    return true;
  }

  useImperativeHandle(navigationRef, () => ({ locate: navigateToRecord }));

  function calculatePreview() {
    if (!pending || !onPreview || pending.value === pending.expectedValue) return;
    try {
      const edit = { ...pending };
      const outcome = onPreview(edit);
      setPreview({ value: outcome, state, draft: edit, contextKey: previewContextKey });
      setEditError("");
    } catch (caught) {
      setPreview(null);
      setEditError(caught instanceof Error ? caught.message : "Preview could not be calculated.");
    }
  }

  function approve() {
    if (!pending) return;
    setPreview(null);
    if (pending.value === pending.expectedValue) {
      setPending(null);
      setStatus("No change to apply.");
      return;
    }
    try {
      commitEdit(pending);
    } catch (caught) {
      setEditError(caught instanceof Error ? caught.message : "Correction could not be applied.");
    }
  }

  function commitEdit(edit: CellEditRequest & { expectedValue: string }) {
    onApprove(edit);
    // The parent callback returns only after the correction engine accepts the edit.
    // The operation has the exact same data as the successful engine action.
    const operation = {
      sequence: state.nextSequence,
      dataset: edit.dataset,
      rowNumber: edit.rowNumber,
      column: edit.column,
      previousValue: edit.expectedValue,
      correctedValue: edit.value,
    };
    const occurredAt = new Date().toISOString();
    setActivity((history) => recordCorrectionActivity(history, "APPLY", operation, occurredAt));
    setPending(null);
    setPreview(null);
    setEditError("");
    setStatus("Correction applied locally. Automatic revalidation attempted; check the current result.");
  }

  function approveRepair(plan: SmartRepairPlan) {
    assertSmartRepairPlanReadyForApproval(plan);
    if (plan.resolution.outcome !== "ACTIONABLE_CANDIDATE") throw new Error("Resolve a fresh candidate.");
    commitEdit(readLocalRepairCandidate(plan.resolution.candidate).edit);
  }

  function undo() {
    setPreview(null);
    try {
      const operation = state.undoStack[state.undoStack.length - 1];
      if (!operation) return;
      onUndo();
      const occurredAt = new Date().toISOString();
      setActivity((history) => recordCorrectionActivity(history, "UNDO", operation, occurredAt));
      setPending(null);
      setEditError("");
      setStatus("Last correction undone. Automatic revalidation attempted; check the current result.");
    } catch (caught) {
      setEditError(caught instanceof Error ? caught.message : "Undo failed.");
    }
  }

  function redo() {
    setPreview(null);
    try {
      const operation = state.redoStack[state.redoStack.length - 1];
      if (!operation) return;
      onRedo();
      const occurredAt = new Date().toISOString();
      setActivity((history) => recordCorrectionActivity(history, "REDO", operation, occurredAt));
      setPending(null);
      setEditError("");
      setStatus("Correction restored. Automatic revalidation attempted; check the current result.");
    } catch (caught) {
      setEditError(caught instanceof Error ? caught.message : "Redo failed.");
    }
  }

  function discard() {
    if (!window.confirm("Discard all local corrections and undo/redo history? Original CSV values will be restored.")) return;
    try {
      setPreview(null);
      onDiscard();
      setActivity(createCorrectionActivityState());
      setPending(null);
      setEditError("");
      setStatus("All local corrections discarded. Automatic revalidation attempted; check the current result.");
    } catch (caught) {
      setEditError(caught instanceof Error ? caught.message : "Could not discard corrections.");
    }
  }

  if (!selected) return null;

  const mapping = mappings[selected.name] ?? [];
  const toSource = new Map(mapping.map((entry) => [entry.target.trim(), entry.source]));
  const issuesByRow = new Map<number, RehearsalIssue[]>();
  for (const issue of issues) {
    if (issue.dataset !== selected.name || issue.rowNumber === null) continue;
    const list = issuesByRow.get(issue.rowNumber) ?? [];
    list.push(issue);
    issuesByRow.set(issue.rowNumber, list);
  }
  const hasHistory = state.undoStack.length > 0 || state.redoStack.length > 0;
  const visiblePreview = preview && pending && preview.state === state &&
    preview.contextKey === previewContextKey &&
    preview.draft.dataset === pending.dataset &&
    preview.draft.rowNumber === pending.rowNumber &&
    preview.draft.column === pending.column &&
    preview.draft.expectedValue === pending.expectedValue &&
    preview.draft.value === pending.value ? preview.value : null;

  return (
    <Card aria-labelledby="correction-workspace-title" className="min-w-0 space-y-5">
      <div className="space-y-2 border-b border-border pb-4">
        <p className="text-xs font-medium text-muted-foreground">Browser-local working copy / one cell at a time</p>
        <h2 id="correction-workspace-title" className="text-xl font-semibold text-foreground sm:text-2xl">
          Data correction workspace
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Edit source values, preview the impact, then apply each correction. Changes stay in this browser; originals remain recoverable.
        </p>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3 rounded-lg border border-border bg-surface-muted p-3">
        <label className="block min-w-0 max-w-sm basis-56 flex-1 text-sm font-medium text-foreground">
          Correction dataset
          <Select aria-label="Correction dataset" className="mt-2" value={selected.name} onChange={(event) => {
            setDatasetName(event.target.value);
            setPage(1);
            setPending(null);
            setPreview(null);
            setEditError("");
          }}>
            {state.current.map((item) => <option key={item.name} value={item.name}>{item.filename}</option>)}
          </Select>
        </label>
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap">
          <Button type="button" aria-label="Undo correction" disabled={state.undoStack.length === 0} onClick={undo}>Undo</Button>
          <Button type="button" aria-label="Redo correction" disabled={state.redoStack.length === 0} onClick={redo}>Redo</Button>
          <Button type="button" variant="danger" className="col-span-2" disabled={!hasHistory} onClick={discard}>Discard corrections</Button>
        </div>
      </div>

      {hasHistory && <p className="text-xs text-muted-foreground">
        {state.undoStack.length > 0 && <>Undo next: {state.undoStack.at(-1)!.dataset}, line {state.undoStack.at(-1)!.rowNumber}, {state.undoStack.at(-1)!.column}.</>}
        {state.redoStack.length > 0 && <> Redo next: {state.redoStack.at(-1)!.dataset}, line {state.redoStack.at(-1)!.rowNumber}, {state.redoStack.at(-1)!.column}.</>}
      </p>}
      <p className="text-sm text-muted-foreground" role="status">
        {effective.length} currently changed cell{effective.length === 1 ? "" : "s"} across {state.current.length} dataset{state.current.length === 1 ? "" : "s"}.
      </p>
      <div className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-lg border px-3 py-2 text-sm ${validationStatus ? readinessStyles[validationStatus] : "border-border bg-surface-muted text-foreground"}`}>
        <p role="status">{validationStatus ? `Current validation: ${validationStatus.replaceAll("_", " ")}. Cell markers reflect this completed run.` : "No current validation result. Run Validation to identify current issues."}</p>
        {validationError && <p className="text-danger [overflow-wrap:anywhere]">{validationError}</p>}
        <a href={validationStatus ? "#validation-results" : "#rehearsal-execution"} className="inline-flex min-h-11 items-center rounded-md font-semibold underline underline-offset-4">{validationStatus ? "Review validation report" : "Go to validation controls"}</a>
      </div>
      {repairSource !== undefined && <SmartRepairPlanner source={repairSource} dataset={selected.name}
        scopeKey={JSON.stringify([selected.name, visiblePage, pendingKey])} active={active} disabled={repairDisabled}
        manualEditing={Boolean(pending)} onApprove={approveRepair} onLocate={issue => {
          const location = issueCorrectionLocation(issue, state, mappings);
          if (location) navigateToRecord(location);
        }} />}
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground" aria-label="Cell highlighting legend">
        <span className="border-l-4 border-danger pl-2">Error</span>
        <span className="border-l-4 border-warning pl-2">Warning</span>
        <span className="border-l-4 border-info pl-2">Corrected (may still have issues)</span>
        <span className="border-l-4 border-primary pl-2">Editing</span>
      </div>
      <p className="text-xs text-muted-foreground">Scroll across columns or use the focused table&apos;s arrow keys. CSV lines refer to the source file.</p>
      {status && <p role="status" className="rounded-lg bg-surface-muted p-3 text-sm">{status}</p>}
      {editError && <p id="correction-edit-error" role="alert" className="rounded-lg border border-danger bg-danger-surface p-3 text-sm text-danger">{editError}</p>}

      <div className="min-w-0 [&>div]:max-h-[65vh] [&>div]:overflow-auto">
      <Table scrollLabel={`Editable CSV records for ${selected.filename}`} className="[&_tr>td]:py-2 [&_tr>th]:py-2 [&_thead_th]:sticky [&_thead_th]:top-0 [&_thead_th]:z-20 [&_thead_th:first-child]:z-30 [&_thead_th]:bg-surface-muted">
        <caption className="sr-only">Editable records — {selected.filename} (source columns and physical CSV lines)</caption>
        <thead><tr>
          <th scope="col" className="sm:left-0 z-20 whitespace-nowrap">CSV line</th>
          <th scope="col">Validation issues</th>
          {selected.headers.map((column) => <th key={column} scope="col" className="min-w-48">{column}</th>)}
        </tr></thead>
        <tbody>
          {rows.map((row, localIndex) => {
            const rowNumber = selected.rowNumbers[start + localIndex];
            const rowIssues = issuesByRow.get(rowNumber) ?? [];
            return <tr key={`${selected.name}:${rowNumber}`}>
              <th scope="row" tabIndex={-1} ref={node => { const key = JSON.stringify([selected.name,rowNumber]); if (node) rowHeaders.current.set(key,node); else rowHeaders.current.delete(key); }} className="sm:sticky sm:left-0 z-10 bg-surface-muted align-top font-mono tabular-nums">{rowNumber}</th>
              <td className="min-w-32">
                {rowIssues.length > 0 ? (
                  <span className={rowIssues.some(issue => issue.severity === "ERROR") ? "font-medium text-danger" : "font-medium text-warning"} aria-label={`${rowIssues.length} validation ${rowIssues.length === 1 ? "issue" : "issues"} on CSV line ${rowNumber}`}>
                    {rowIssues.length} issue{rowIssues.length === 1 ? "" : "s"}
                  </span>
                ) : <span className="text-muted-foreground">—</span>}
              </td>
              {selected.headers.map((column) => {
                const address = { dataset: selected.name, rowNumber, column };
                const currentValue = row[column];
                const originalValue = getOriginalCellValue(state, address);
                const changed = currentValue !== originalValue;
                const relevant = rowIssues.filter((issue) => issue.column !== null && (toSource.get(issue.column) ?? issue.column) === column);
                const isEditing = pending?.dataset === selected.name && pending.rowNumber === rowNumber && pending.column === column;
                const hasError = relevant.some(issue => issue.severity === "ERROR");
                const cellTone = hasError ? "border-l-2 border-l-danger bg-danger-surface" : relevant.length ? "border-l-2 border-l-warning bg-warning-surface" : changed ? "bg-info-surface" : "";
                const cellKey = JSON.stringify([selected.name, rowNumber, column]);
                const issueId = `cell-issues-${encodeURIComponent(cellKey)}`;
                return <td key={column} data-cell-state={isEditing ? "editing" : hasError ? "error" : relevant.length ? "warning" : changed ? "corrected" : "unchanged"} className={`min-w-48 max-w-80 space-y-1 align-top ${cellTone} ${isEditing ? "min-w-64 sm:min-w-80 outline-2 -outline-offset-2 outline-primary" : ""}`}>
                  {relevant.length > 0 && <p id={issueId} className={`text-xs font-medium ${hasError ? "text-danger" : "text-warning"}`}>{relevant.map(issue => `${issue.severity === "ERROR" ? "Error" : "Warning"}: ${issue.code}`).join(", ")}</p>}
                  {isEditing && pending ? (
                    <div className="space-y-2">
                      <label className="block text-xs font-semibold">
                        Proposed value: {selected.name} line {rowNumber}, {column}
                        <Textarea
                          ref={editorRef}
                          aria-label={`Proposed value for ${selected.name} line ${rowNumber} column ${column}`}
                          aria-describedby={[relevant.length ? issueId : "", editError ? "correction-edit-error" : ""].filter(Boolean).join(" ") || undefined}
                          aria-invalid={Boolean(editError)}
                          onKeyDown={(event) => {
                            if (event.key === "Escape") {
                              event.preventDefault();
                              setPending(null); setPreview(null); setEditError("");
                            }
                          }}
                          className="mt-2 min-h-28 font-mono"
                          value={pending.value}
                          onChange={(event) => { setPending({ ...pending, value: event.target.value }); setPreview(null); }}
                        />
                      </label>
                      <div className="grid gap-2 border-t border-border pt-2 sm:grid-cols-2">
                      <p className="text-xs text-muted-foreground">Original: <span className="mt-1 block break-all whitespace-pre-wrap font-mono text-foreground">{originalValue || "(empty)"}</span></p>
                      <p className="text-xs text-muted-foreground">Current: <span className="mt-1 block break-all whitespace-pre-wrap font-mono text-foreground">{currentValue || "(empty)"}</span></p>
                      </div>
                      <p className="text-xs text-muted-foreground">Draft only. Apply commits the value; Escape cancels. Preview does not change the working copy.</p>
                      <div className="flex flex-wrap gap-2">
                        {onPreview && <Button type="button" disabled={pending.value === pending.expectedValue} onClick={calculatePreview}>Preview impact</Button>}
                        {!visiblePreview && <>
                          <Button type="button" variant="primary" disabled={pending.value === pending.expectedValue} onClick={approve}>Apply correction</Button>
                          <Button type="button" onClick={() => { setPending(null); setPreview(null); setEditError(""); }}>Cancel edit</Button>
                        </>}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1 space-y-1">
                      <p className="max-w-60 whitespace-pre-wrap break-all text-foreground">{currentValue || <span className="italic text-muted-foreground">(empty)</span>}</p>
                      {changed && <p className="text-xs text-muted-foreground">Original: <span className="whitespace-pre-wrap break-all">{originalValue || "(empty)"}</span></p>}
                      {changed && <span className="inline-block rounded-md bg-info-surface px-2 py-1 text-xs font-medium text-info">Corrected</span>}
                      </div>
                      <Button type="button" className="shrink-0" ref={node => { if (node) editButtons.current.set(cellKey, node); else editButtons.current.delete(cellKey); }} onClick={() => startEdit(address, currentValue)} aria-describedby={relevant.length ? issueId : undefined} aria-label={`Edit ${selected.name} line ${rowNumber} column ${column}`}>
                        Edit
                      </Button>
                    </div>
                  )}
                </td>;
              })}
            </tr>;
          })}
        </tbody>
      </Table>
      </div>
      {pending && !visiblePreview && <div className="flex flex-wrap items-center gap-3 border-l-2 border-primary pl-4">
        <p className="text-sm font-medium [overflow-wrap:anywhere]">Editing {pending.dataset}, CSV line {pending.rowNumber}, {pending.column}</p>
        <Button type="button" onClick={() => focusCellEditor(editorRef.current)}>Return to cell editor</Button>
      </div>}
      {visiblePreview && pending && <div ref={previewRef} tabIndex={-1} className="space-y-3 rounded-lg">
        <WhatIfPanel preview={visiblePreview} />
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="primary" disabled={pending.value === pending.expectedValue} onClick={approve}>Apply correction</Button>
          <Button type="button" onClick={() => focusCellEditor(editorRef.current)}>Return to cell editor</Button>
          <Button type="button" onClick={() => { setPending(null); setPreview(null); setEditError(""); }}>Cancel edit</Button>
        </div>
      </div>}

      <nav aria-label="Correction record pages" className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
        <p className="text-sm text-muted-foreground" role="status">
          Showing {selected.rows.length ? start + 1 : 0}–{Math.min(start + ROWS_PER_PAGE, selected.rows.length)} of {selected.rows.length} records · Page {visiblePage} of {totalPages}
        </p>
        <div className="flex gap-2">
          <Button type="button" disabled={visiblePage <= 1} onClick={() => { setPage(visiblePage - 1); setPending(null); setPreview(null); }}>Previous records</Button>
          <Button type="button" disabled={visiblePage >= totalPages} onClick={() => { setPage(visiblePage + 1); setPending(null); setPreview(null); }}>Next records</Button>
        </div>
      </nav>
      <details className="rounded-lg border border-border bg-surface p-3">
        <summary className="min-h-11 cursor-pointer content-center rounded-md font-semibold">Correction activity history ({activity.entries.length})</summary>
        <CorrectionHistory history={activity} />
      </details>
      <p className="text-sm leading-relaxed text-muted-foreground">
        This workspace changes source cells, not the database. Unsaved drafts are discarded by Cancel edit or page navigation. Approved corrections can be downloaded with Export corrected CSV records. Review sensitive values before sharing or re-importing.
      </p>
    </Card>
  );
}
