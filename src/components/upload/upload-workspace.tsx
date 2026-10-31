// CSV upload, mapping, validation aur saving summaries
"use client";

import { configurationFieldId, relationshipFieldId, configurationIssueLocation } from "../../lib/reports/configuration-locations";
import WorkspaceStepper from "./workspace-stepper";
import { workspaceSteps, workspaceStepStates, previousWorkspaceStep, nextWorkspaceStep, type WorkspaceStep } from "../../lib/workspace/steps";
import PageHeader from "../layout/page-header";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import ReportComparisonPanel from "../corrections/report-comparison-panel";
import { relationshipColumnOptions } from "./relationship-options";
import FilePicker from "./file-picker";
import WorkspaceDepartureGuard from "./workspace-departure-guard";
import SchemaMapping from "./schema-mapping";
import RehearsalExecution from "./rehearsal-execution";
import { CsvPreview, DatasetList, UploadFeedback } from "./upload-presentation";
import CorrectionWorkspace, { type CorrectionNavigationHandle } from "../corrections/correction-workspace";
import { issueCorrectionLocation } from "../../lib/corrections/navigation";
import CorrectedCsvExportControls from "../corrections/corrected-csv-export-controls";
import MappingTemplateControls from "../templates/mapping-template-controls";
import SchemaMappingAssistant from "../ai/schema-mapping-assistant";
import RootCauseAnalyzer from "../ai/root-cause-analyzer";
import { createImpactEvidenceOwner, type ImpactEvidence } from "../../lib/ai/impact-evidence";
import { safeAiError } from "../../lib/ai/contracts";
import type { VerifiedCorrectionReport } from "../../lib/corrections/revalidation";
import { sameSchemaConfiguration } from "../../lib/ai/schema-mapping";
import { captureTemplateConfiguration, checkTemplateCompatibility } from "../../lib/templates/workspace";
import type { TemplateConfiguration } from "../../lib/templates/schema";
import RevalidationStatus, { type RevalidationAction } from "../corrections/revalidation-status";
import { revalidateCorrectionSnapshot } from "../../lib/corrections/revalidation";
import { previewCellCorrection } from "../../lib/corrections/what-if";
import {
  applyCellCorrection, createCorrectionState, discardAllCorrections,
  redoCorrection, undoCorrection,
} from "../../lib/corrections/engine";
import type { CellEditRequest, CorrectionState } from "../../lib/corrections/types";
import IssueExplorer from "../reports/issue-explorer";
import ReportAnalyticsDashboard from "../reports/report-analytics-dashboard";
import ReadinessInsightsPanel from "../reports/readiness-insights-panel";
import ReportExportControls from "../reports/report-export-controls";
import type { ReportAnalytics } from "../../lib/reports/types";
import DependencyGraphSection from "../validation/dependency-graph-section";
import SchemaDiagramSection, { type SchemaDiagramHandle } from "../schema-diagram/schema-diagram-section";
import { captureSchemaDiagramConfiguration } from "../../lib/schema-diagram/workspace";
import PostgresqlSchemaExport from "../database-export/postgresql-schema-export";
import MongodbExport from "../database-export/mongodb-export";
import MysqlExport from "../database-export/mysql-export";
import type { DatabaseExportWorkspaceScope } from "../../lib/database-export/session";
import { Button, Card, Input, Select, Textarea, LoadingState } from "../ui/primitives";
import { readCsvFile, type ParsedCsv } from "../../lib/csv/parser";
import {
  applyMapping, identityMapping,
  type ColumnMapping,
} from "../../lib/rehearsal/mapping";
import {
  type DatasetRules,
  type FieldType,
  type Relationship,
} from "../../lib/rehearsal/rules";
import type { RehearsalReportV1 } from "../../lib/rehearsal/types";
import type { CompositeForeignKey } from "../../lib/rehearsal/foreign-keys";
import { buildWorkspaceKeyRules } from "../../lib/rehearsal/workspace-config";
import { toValidationRunSummary } from "../../lib/rehearsal/report-persistence";

const fieldTypes: FieldType[] = ["string", "integer", "number", "boolean", "date", "email"];

type ReviewView = "summary" | "issues" | "dependencies" | "analytics" | "schema";

type ProjectOption = { id: string; name: string };

export default function UploadWorkspace({ initialProjectId = "" }: { initialProjectId?: string }) {
  const correctionNavigation = useRef<CorrectionNavigationHandle>(null);
  const schemaDiagram = useRef<SchemaDiagramHandle>(null);
  const [datasets, setDatasets] = useState<ParsedCsv[]>([]);
  const [correctionState, setCorrectionState] = useState<CorrectionState | null>(null);
  const [correctionSessionId, setCorrectionSessionId] = useState(0);
  const [mappings, setMappings] = useState<Record<string, ColumnMapping[]>>({});
  const [mappingDrafts, setMappingDrafts] = useState<Record<string, ColumnMapping[]>>({});
  const [rules, setRules] = useState<Record<string, DatasetRules>>({});
  const [requiredDrafts, setRequiredDrafts] = useState<Record<string, string>>({});
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [result, setResult] = useState<RehearsalReportV1 | null>(null);
  const [postgresReport, setPostgresReport] = useState<DatabaseExportWorkspaceScope["report"]>(null);
  const [analytics, setAnalytics] = useState<ReportAnalytics | null>(null);
  const [verificationAction, setVerificationAction] = useState<RevalidationAction | null>(null);
  const [primaryOverrides, setPrimaryOverrides] = useState<Record<string, string>>({});
  const [uniqueSpecs, setUniqueSpecs] = useState<Record<string, string>>({});
  const [compositeRelationships, setCompositeRelationships] = useState<CompositeForeignKey[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploadError, setUploadError] = useState("");
  // First accepted selection owns the read, including before React disables the picker.
  const readingFiles = useRef(false);
  const savingSummary = useRef(false);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [projectsError, setProjectsError] = useState("");
  const [projectsRetry, setProjectsRetry] = useState(0);
  const [projectId, setProjectId] = useState("");
  const [saveStatus, setSaveStatus] = useState("");
  const [savedRunId, setSavedRunId] = useState<string | null>(null);
  const comparisonConfig = useMemo(() => ({
    mappings, rules, relationships: [...relationships, ...compositeRelationships],
    keyRules: buildWorkspaceKeyRules(rules, primaryOverrides, uniqueSpecs),
  }), [mappings, rules, relationships, compositeRelationships, primaryOverrides, uniqueSpecs]);

  const [activeStep, setActiveStep] = useState<WorkspaceStep>("upload");
  const [configureDataset, setConfigureDataset] = useState("");
  const [previewDataset, setPreviewDataset] = useState("");
  const [reviewView, setReviewView] = useState<ReviewView>("summary");
  const [reviewedConfig, setReviewedConfig] = useState("");
  const [openedReport, setOpenedReport] = useState<RehearsalReportV1 | null>(null);
  const [downloaded, setDownloaded] = useState<{ state: CorrectionState | null; report: RehearsalReportV1 | null } | null>(null);
  const [exportOrigin, setExportOrigin] = useState<WorkspaceStep>("review");
  const [templatePending, setTemplatePending] = useState(false);
  const templateMutation = useRef(false);
  const pendingFocus = useRef<string | null>(null);
  const [navigationVersion, setNavigationVersion] = useState(0);
  const [aiTemplate, setAiTemplate] = useState<{ projectId: string; configuration: TemplateConfiguration | null } | null>(null);
  const [impactOwner] = useState(() => createImpactEvidenceOwner());
  const [impactSnapshot, setImpactSnapshot] = useState<{ report: RehearsalReportV1; analytics: ReportAnalytics; evidence: ImpactEvidence | null; error: string } | null>(null);
  const [issueFocus, setIssueFocus] = useState<{ report: RehearsalReportV1; ids: string[] } | null>(null);
  const [analysisFocus, setAnalysisFocus] = useState<{ report: RehearsalReportV1; ids: string[] } | null>(null);
  const onAiTemplateSelection = useCallback((configuration: TemplateConfiguration | null) => setAiTemplate({ projectId, configuration }), [projectId]);
  const configKey = JSON.stringify([correctionSessionId, comparisonConfig]);
  const schemaConfiguration = useMemo(() => captureSchemaDiagramConfiguration({
    identity: { sessionId: correctionSessionId, configurationKey: configKey }, datasets, mappings, rules,
    relationships: [...relationships, ...compositeRelationships], primaryOverrides, uniqueSpecs,
  }), [correctionSessionId, configKey, datasets, mappings, rules, relationships, compositeRelationships, primaryOverrides, uniqueSpecs]);
  const postgresScope = useMemo((): DatabaseExportWorkspaceScope => ({
    workspace: datasets, configuration: schemaConfiguration, corrections: correctionState,
    report: postgresReport?.value === result ? postgresReport : null,
    draftsPending: Boolean(Object.keys(mappingDrafts).length || Object.keys(requiredDrafts).length),
  }), [datasets, schemaConfiguration, correctionState, postgresReport, result, mappingDrafts, requiredDrafts]);
  const selectedConfiguration = datasets.some(dataset => dataset.name === configureDataset) ? configureDataset : datasets[0]?.name;
  const selectedPreview = datasets.find(dataset => dataset.name === previewDataset) ?? datasets[0];
  const steps = workspaceStepStates({ hasDatasets: datasets.length > 0, hasReport: Boolean(result),
    configurationReviewed: reviewedConfig === configKey && Object.keys(mappingDrafts).length === 0, configurationError: result?.status === "CONFIG_ERROR",
    reviewOpened: Boolean(result && openedReport === result), correctionActivity: (correctionState?.nextSequence ?? 1) > 1,
    exported: Boolean(savedRunId || (correctionState && downloaded?.state === correctionState && downloaded?.report === result)) });
  const blocked = busy || saving || templatePending;
  const back = previousWorkspaceStep(activeStep, Boolean(result), exportOrigin);
  const next = nextWorkspaceStep(activeStep);

  function showStep(step: WorkspaceStep, focus = true) {
    if (step === "export" && activeStep !== "export") setExportOrigin(activeStep);
    if (step === "review") setOpenedReport(result);
    setActiveStep(step);
    if (focus) { pendingFocus.current = `workspace-${step}-heading`; setNavigationVersion(value => value + 1); }
  }
  function goStep(step: WorkspaceStep) {
    if (readingFiles.current || savingSummary.current || templateMutation.current || !steps.find(entry => entry.id === step)?.available) return;
    showStep(step);
  }
  function generateSchemaDiagram() {
    if (readingFiles.current || savingSummary.current || templateMutation.current || blocked ||
      Object.keys(mappingDrafts).length || Object.keys(requiredDrafts).length || !result) return;
    if (schemaDiagram.current?.generate()) {
      setReviewView("schema"); pendingFocus.current = "schema-diagram-heading"; setNavigationVersion(value => value + 1);
    }
  }
  function continueStep() {
    if (!next) return;
    if (activeStep === "configure") setReviewedConfig(configKey);
    goStep(next);
  }
  function revealTarget(id: string) {
    const target = document.getElementById(id);
    const panel = target?.closest<HTMLElement>("[data-workspace-step]");
    if (!target || !panel || blocked) return false;
    const step = panel.dataset.workspaceStep as WorkspaceStep;
    if (!steps.find(entry => entry.id === step)?.available) return false;
    const dataset = target.closest<HTMLElement>("[data-workspace-dataset]")?.dataset.workspaceDataset;
    const view = target.closest<HTMLElement>("[data-review-view]")?.dataset.reviewView as ReviewView | undefined;
    if (dataset) setConfigureDataset(dataset);
    if (view) setReviewView(view);
    showStep(step, false);
    let ancestor = target.parentElement;
    while (ancestor) { if (ancestor instanceof HTMLDetailsElement) ancestor.open = true; ancestor = ancestor.parentElement; }
    pendingFocus.current = id; setNavigationVersion(value => value + 1);
    return true;
  }
  useEffect(() => {
    const id = pendingFocus.current;
    if (!id) return;
    pendingFocus.current = null;
    const target = document.getElementById(id);
    if (!target) return;
    if (!target.hasAttribute("tabindex") && !target.matches("input,select,textarea,button,a")) target.tabIndex = -1;
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: target.matches("input,select,textarea") ? "center" : "start", behavior: "instant" });
  }, [navigationVersion]);
  function stepHeading(step: WorkspaceStep) {
    const item = workspaceSteps.find(entry => entry.id === step)!;
    return <header className="space-y-1"><h2 id={`workspace-${step}-heading`} tabIndex={-1} className="scroll-mt-44 text-2xl font-semibold tracking-tight">{item.label}{step === "correct" && <span className="ml-2 text-sm font-normal text-muted-foreground">Optional</span>}</h2><p className="text-sm text-muted-foreground">{item.description}</p></header>;
  }
  function locateIssue(issue: Parameters<typeof issueCorrectionLocation>[0]) {
    const location = correctionState && issueCorrectionLocation(issue, correctionState, mappings);
    if (location && correctionNavigation.current?.locate(location)) showStep("correct", false);
  }

  function invalidateImpact(change: "session" | "configuration" | "corrections" | "report" = "configuration") {
    setPostgresReport(null);
    impactOwner.invalidate(change);
    setImpactSnapshot(null); setIssueFocus(null); setAnalysisFocus(null);
  }
  function publishImpact(verified: VerifiedCorrectionReport) {
    try {
      const evidence = impactOwner.captureReport({ source: "LIVE_REPORT", verified, configuration: currentConfiguration, expectedVersion: impactOwner.getVersion() });
      setImpactSnapshot({ ...verified, evidence, error: "" });
    } catch (caught) {
      // Optional AI evidence must never prevent canonical results from being published.
      setImpactSnapshot({ ...verified, evidence: null, error: safeAiError(caught).message });
    }
  }
  function viewCitedIssues(ids: string[]) {
    if (!result || blocked) return;
    const current = [...new Set(ids)].filter(id => result.issues.some(issue => issue.id === id));
    if (!current.length) return;
    setIssueFocus({ report: result, ids: current });
    revealTarget("issue-explorer-title");
  }
  function explainIssue(issue: RehearsalReportV1["issues"][number]) {
    if (!result || blocked || !result.issues.some(current => current.id === issue.id)) return;
    setAnalysisFocus({ report: result, ids: [issue.id] });
    revealTarget("root-cause-heading");
  }

  const configurationFindings = (result?.issues ?? []).flatMap((issue) => {
    const location = configurationIssueLocation(issue, { datasets: datasets.map(dataset => dataset.name), primaryOverrides, relationships, compositeRelationships });
    return location ? [{ issue, location }] : [];
  });
  function fieldProps(id: string, help?: string) {
    const invalid = configurationFindings.some(entry => entry.location.id === id);
    return { id, "aria-invalid": invalid || undefined, "aria-describedby": [help, invalid ? `${id}-errors` : undefined].filter(Boolean).join(" ") || undefined };
  }
  function fieldErrors(id: string) {
    const findings = configurationFindings.filter(entry => entry.location.id === id);
    return findings.length ? <ul id={`${id}-errors`} className="mt-2 space-y-1 text-sm text-danger [overflow-wrap:anywhere]">{findings.map(({issue}) => <li key={issue.id}>{issue.explanation}</li>)}</ul> : null;
  }

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    void fetch("/api/projects", { cache: "no-store", signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Could not load projects")))
      .then((data: { projects?: ProjectOption[] }) => {
        if (active) {
          if (!Array.isArray(data.projects)) throw new Error("Could not read projects");
          const ownedProjects = data.projects;
          setProjects(ownedProjects);
          // The URL is untrusted: only preselect a project returned for this user.
          if (initialProjectId && ownedProjects.some((p) => p.id === initialProjectId)) {
            setProjectId(current => current || initialProjectId);
          }
        }
      })
      .catch(() => {
        if (active) setProjectsError("Projects unavailable. Validation still works locally.");
      }).finally(() => { if (active) setProjectsLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [initialProjectId, projectsRetry]);

  function clearRequiredDraft(name: string) {
    setRequiredDrafts((previous) => {
      const next = { ...previous };
      delete next[name];
      return next;
    });
  }

  function updateRules(name: string, updated: DatasetRules) {
    // Checkbox changes replace the text draft; unrelated rule edits retain it.
    if (updated.required !== rules[name]?.required) clearRequiredDraft(name);
    setRules((previous) => ({ ...previous, [name]: updated }));
    invalidateImpact(); setResult(null); setAnalytics(null); setVerificationAction(null);
    setSaveStatus(""); setSavedRunId(null);
  }

  async function chooseFiles(files: File[]) {
    if (!files.length || readingFiles.current) return;
    if (correctionState && (correctionState.undoStack.length > 0 || correctionState.redoStack.length > 0) &&
        !window.confirm("Replace uploaded CSV files? This will discard local corrections and undo/redo history.")) return;
    readingFiles.current = true;
    setBusy(true);
    setUploadError("");
    try {
      if (files.length > 5) throw new Error("Choose a maximum of 5 CSV files");
      const parsed = await Promise.all(files.map(readCsvFile));
      if (new Set(parsed.map((d) => d.name)).size !== parsed.length) {
        throw new Error("CSV filenames must be unique (ignoring .csv and letter case)");
      }
      const nextCorrectionState = createCorrectionState(parsed);
      const nextMappings: Record<string, ColumnMapping[]> = {};
      const nextRules: Record<string, DatasetRules> = {};
      for (const dataset of parsed) {
        nextMappings[dataset.name] = identityMapping(dataset.headers);
        nextRules[dataset.name] = {
          primaryKey: dataset.headers.includes("id") ? "id" : "",
          required: ["name", ...(dataset.name === "students" ? ["department_id"] : [])]
            .filter((name) => dataset.headers.includes(name)),
          types: {},
        };
      }
      const students = parsed.find((d) => d.name === "students");
      const departments = parsed.find((d) => d.name === "departments");
      const sampleRelation = students?.headers.includes("department_id") && departments?.headers.includes("id")
        ? [{ childDataset: "students", childColumn: "department_id", parentDataset: "departments", parentColumn: "id" }]
        : [];
      // Candidate parsing and preparation are complete. Commit one new session;
      // failed reads never invalidate reports or remount the correction/history UI.
      setCorrectionSessionId((previous) => previous + 1);
      setError("");
      invalidateImpact("session"); setResult(null); setAnalytics(null); setVerificationAction(null);
      setSaveStatus(""); setSavedRunId(null);
      setDatasets(parsed);
      setCorrectionState(nextCorrectionState);
      setMappings(nextMappings);
      setMappingDrafts({});
      setRules(nextRules);
      setRequiredDrafts({});
      setRelationships(sampleRelation);
      setCompositeRelationships([]);
      setPrimaryOverrides({});
      setUniqueSpecs({});
      setConfigureDataset(parsed[0]?.name ?? ""); setPreviewDataset(parsed[0]?.name ?? "");
      setReviewedConfig(""); setOpenedReport(null); setDownloaded(null); setReviewView("summary");
    } catch (caught) {
      setUploadError(caught instanceof Error ? caught.message : "Could not read CSV files");
    } finally {
      readingFiles.current = false;
      setBusy(false);
    }
  }

  const currentConfiguration = useMemo((): TemplateConfiguration | null => {
    if (!datasets.length) return null;
    try {
      return captureTemplateConfiguration({
        datasets, mappings, rules, relationships, compositeRelationships,
        primaryOverrides, uniqueSpecs,
      });
    } catch {
      // Mappings can be temporarily blank or duplicated while user types.
      return null;
    }
  }, [datasets, mappings, rules, relationships, compositeRelationships, primaryOverrides, uniqueSpecs]);
  const selectedAiTemplate = aiTemplate?.projectId === projectId ? aiTemplate.configuration : null;
  const aiRevision = useMemo(() => ({ currentConfiguration, mappingDrafts, requiredDrafts, correctionState, result, projectId, selectedAiTemplate }), [currentConfiguration, mappingDrafts, requiredDrafts, correctionState, result, projectId, selectedAiTemplate]);
  const repairSource = useMemo(() => {
    const evidence = impactSnapshot?.report === result ? impactSnapshot?.evidence : null;
    return correctionState && result && currentConfiguration && evidence ? {
      corrections: correctionState, report: result, configuration: currentConfiguration, evidence,
      getVersion: impactOwner.getVersion, revision: aiRevision,
      draftsPending: Boolean(Object.keys(mappingDrafts).length || Object.keys(requiredDrafts).length),
    } : null;
  }, [correctionState, result, currentConfiguration, impactSnapshot, impactOwner, aiRevision, mappingDrafts, requiredDrafts]);

  function approveAiConfiguration(configuration: TemplateConfiguration) {
    if (readingFiles.current || savingSummary.current || templateMutation.current || Object.keys(mappingDrafts).length) return;
    if (!currentConfiguration || sameSchemaConfiguration(currentConfiguration, configuration)) return;
    if (!checkTemplateCompatibility(configuration, datasets).ok) return;
    for (const dataset of datasets) applyMapping({ ...dataset, rows: [], rowNumbers: [] }, configuration.mappings[dataset.name]);
    loadTemplateConfiguration(configuration);
  }

  function loadTemplateConfiguration(configuration: TemplateConfiguration) {
    // The controls verify the original dataset/headers before calling this.
    // Never modify CSV records or correction history when loading a template.
    setMappings(configuration.mappings);
    setMappingDrafts({});
    setRules(configuration.rules);
    setRequiredDrafts({});
    setRelationships(configuration.relationships);
    setCompositeRelationships(configuration.compositeRelationships);
    setPrimaryOverrides(configuration.primaryOverrides);
    setUniqueSpecs(configuration.uniqueSpecs);
    invalidateImpact(); setResult(null);
    setAnalytics(null);
    setVerificationAction(null);
    setSaveStatus(""); setSavedRunId(null);
    setError("");
  }

  function changeMapping(name: string, source: string, target: string) {
    setMappingDrafts((previous) => ({
      ...previous,
      [name]: (previous[name] ?? mappings[name]).map((entry) => entry.source === source ? { ...entry, target } : entry),
    }));
  }

  function cancelMapping(name: string) {
    setMappingDrafts((previous) => {
      const next = { ...previous };
      delete next[name];
      return next;
    });
  }

  function commitMapping(name: string) {
    const candidate = mappingDrafts[name];
    const dataset = datasets.find((entry) => entry.name === name);
    if (!candidate || !dataset) return;
    // Validate metadata only; CSV values and corrections are never rewritten.
    try {
      applyMapping({ ...dataset, rows: [], rowNumbers: [] }, candidate);
    } catch {
      return; // SchemaMapping displays the same canonical validation feedback.
    }
    const changed = candidate.some((entry, index) => entry.target.trim() !== mappings[name][index].target.trim());
    cancelMapping(name);
    if (!changed) return;
    setMappings((previous) => ({ ...previous, [name]: candidate }));
    clearRequiredDraft(name);
    // Column names change after mapping: reset this dataset's rules to prevent stale targets.
    setRules((previous) => ({
      ...previous,
      [name]: { primaryKey: "", required: [], types: {} },
    }));
    setPrimaryOverrides((previous) => ({ ...previous, [name]: "" }));
    setUniqueSpecs((previous) => ({ ...previous, [name]: "" }));
    invalidateImpact(); setResult(null); setAnalytics(null); setVerificationAction(null);
    setSaveStatus(""); setSavedRunId(null);
  }

  function editRelationship(index: number, update: Partial<Relationship>) {
    setRelationships((previous) => previous.map((relationship, i) => i === index ? { ...relationship, ...update } : relationship));
    invalidateImpact(); setResult(null); setAnalytics(null); setVerificationAction(null);
    setSaveStatus(""); setSavedRunId(null);
  }

  function updateComposite(index: number, update: Partial<CompositeForeignKey>) {
    setCompositeRelationships((previous) => previous.map((rel, i) => i === index ? { ...rel, ...update } : rel));
    invalidateImpact(); setResult(null); setAnalytics(null); setVerificationAction(null);
    setSaveStatus(""); setSavedRunId(null);
  }

  // Phase 8 S5: do not trust cached reports after ANY approved state transition.
  // Compute from the returned immutable snapshot, never the stale React state.
  function revalidateApprovedState(next: CorrectionState, action: RevalidationAction) {
    invalidateImpact("corrections"); setResult(null);
    setAnalytics(null);
    setVerificationAction(null);
    setSaveStatus(""); setSavedRunId(null);
    setError("");
    try {
      const verified = revalidateCorrectionSnapshot(next.current, {
        mappings,
        rules,
        relationships: [...relationships, ...compositeRelationships],
        keyRules: buildWorkspaceKeyRules(rules, primaryOverrides, uniqueSpecs),
      });
      setResult(verified.report);
      setAnalytics(verified.analytics);
      setVerificationAction(action);
      setPostgresReport({ value: verified.report, identity: { sessionId: correctionSessionId, configurationKey: configKey }, corrections: next });
      publishImpact(verified);
    } catch (caught) {
      // Correction is still approved locally. Clear old results instead of
      // showing a stale success or silently reverting a user-approved edit.
      const message = caught instanceof Error ? caught.message : "Unknown validation error";
      setError(`Correction ${action.toLowerCase()} succeeded locally, but automatic revalidation failed: ${message}. Fix the configuration and run validation again.`);
    }
  }

  function previewCorrection(edit: CellEditRequest) {
    if (!correctionState) throw new Error("Upload a CSV before previewing corrections.");
    return previewCellCorrection(correctionState, edit, {
      mappings,
      rules,
      relationships: [...relationships, ...compositeRelationships],
      keyRules: buildWorkspaceKeyRules(rules, primaryOverrides, uniqueSpecs),
    });
  }

  function approveCorrection(edit: CellEditRequest) {
    if (!correctionState) throw new Error("Upload a CSV before applying corrections.");
    const next = applyCellCorrection(correctionState, edit);
    if (next === correctionState) return;
    setCorrectionState(next);
    revalidateApprovedState(next, "APPLY");
  }

  function undoApprovedCorrection() {
    if (!correctionState) return;
    const next = undoCorrection(correctionState);
    if (next === correctionState) return;
    setCorrectionState(next);
    revalidateApprovedState(next, "UNDO");
  }

  function redoApprovedCorrection() {
    if (!correctionState) return;
    const next = redoCorrection(correctionState);
    if (next === correctionState) return;
    setCorrectionState(next);
    revalidateApprovedState(next, "REDO");
  }

  function discardApprovedCorrections() {
    if (!correctionState) return;
    const next = discardAllCorrections(correctionState);
    if (next === correctionState) return;
    setCorrectionState(next);
    revalidateApprovedState(next, "RESTORE");
  }

  // Manual Run Validation remains available, using the same canonical runner.
  function validate() {
    setError("");
    invalidateImpact("report"); setResult(null);
    setAnalytics(null);
    setVerificationAction(null);
    setSaveStatus(""); setSavedRunId(null);
    try {
      const verified = revalidateCorrectionSnapshot(correctionState?.current ?? datasets, {
        mappings,
        rules,
        relationships: [...relationships, ...compositeRelationships],
        keyRules: buildWorkspaceKeyRules(rules, primaryOverrides, uniqueSpecs),
      });
      setAnalytics(verified.analytics);
      setResult(verified.report);
      setVerificationAction("MANUAL");
      setPostgresReport({ value: verified.report, identity: { sessionId: correctionSessionId, configurationKey: configKey }, corrections: correctionState });
      publishImpact(verified);
      setReviewedConfig(configKey); setReviewView("summary"); showStep("review"); setOpenedReport(verified.report);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Validation failed");
    }
  }

  // Preserve the Phase 6 full preflight JSON download (backward compatibility).
  // For privacy-reduced sharing, prefer the new sanitized JSON export below.
  function downloadReport() {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "data-rehearsal-report.json";
    anchor.click();
    setDownloaded({ state: correctionState, report: result });
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function saveSummary() {
    if (!result || !projectId || savingSummary.current) return;
    const summary = toValidationRunSummary(result);
    if (!summary) {
      setSaveStatus("This report does not satisfy the summary-saving contract. Review the configuration or download JSON.");
      return;
    }
    savingSummary.current = true;
    setSaving(true);
    setSaveStatus("Saving...");
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(summary),
      });
      if (!response.ok) throw new Error(`Save failed (HTTP ${response.status})`);
      const responseBody: unknown = await response.json();
      const run = responseBody && typeof responseBody === "object" && "run" in responseBody
        ? responseBody.run : null;
      const runId = run && typeof run === "object" && "id" in run && typeof run.id === "string"
        ? run.id : null;
      if (!runId) throw new Error("Server did not return a saved report identifier.");
      setSavedRunId(runId);
      setSaveStatus("Summary saved. Raw CSV rows were not sent to the API.");
    } catch (caught) {
      setSaveStatus(caught instanceof Error ? caught.message : "Save failed");
    } finally {
      savingSummary.current = false;
      setSaving(false);
    }
  }

  return (
    <div className="min-w-0 space-y-6" onClickCapture={event => {
      const anchor = (event.target as HTMLElement).closest?.("a[href^=\"#\"]");
      const fragment = anchor?.getAttribute("href")?.slice(1);
      if (!fragment) return;
      if (blocked) { event.preventDefault(); return; }
      try { if (revealTarget(decodeURIComponent(fragment))) { event.preventDefault(); event.stopPropagation(); } } catch { /* Ignore malformed external fragments. */ }
    }}>
      <PageHeader title="CSV workspace" description="Parse and validate in your browser. No original CSV is uploaded to the server." />

      <WorkspaceDepartureGuard active={datasets.length > 0} />
      <WorkspaceStepper current={activeStep} steps={steps} blocked={blocked} back={back} next={next}
        onStep={goStep} onBack={() => back && goStep(back)} onContinue={continueStep}
        pendingMessage={busy ? "Reading CSV files. Navigation resumes when processing finishes." : saving ? "Saving summary..." : templatePending ? "Updating template..." : ""} />
      <div hidden={activeStep !== "configure" && activeStep !== "export"} className="space-y-3">
      {projectsLoading && <LoadingState className="p-3">Loading projects...</LoadingState>}
      {projectsError && <div className="space-y-2 rounded-lg border border-warning bg-warning-surface p-3 text-sm">
        <p role="alert">{projectsError}</p>
        <Button type="button" disabled={projectsLoading} onClick={() => { setProjectsLoading(true); setProjectsError(""); setProjectsRetry(value => value + 1); }}>Retry loading projects</Button>
      </div>}
      </div>
      <section data-workspace-step="upload" hidden={activeStep !== "upload"} aria-labelledby="workspace-upload-heading" className="min-w-0 space-y-5">
      {stepHeading("upload")}
      <div className="min-w-0 space-y-4">
        <FilePicker onChoose={(files) => void chooseFiles(files)} disabled={busy} />
        <UploadFeedback busy={busy} error={uploadError} hasCurrentData={datasets.length > 0} />
      </div>
      <DatasetList datasets={datasets} />
      {selectedPreview && <div className="space-y-4">
        <label className="block max-w-md text-sm font-medium">Preview dataset<Select aria-label="Preview dataset" className="mt-2" value={selectedPreview.name} onChange={event => setPreviewDataset(event.target.value)}>{datasets.map(dataset => <option key={dataset.name} value={dataset.name}>{dataset.filename}</option>)}</Select></label>
        <CsvPreview dataset={selectedPreview} />
      </div>}
      </section>
      <section data-workspace-step="configure" hidden={activeStep !== "configure"} aria-labelledby="workspace-configure-heading" className="min-w-0 space-y-5">
      {stepHeading("configure")}
      <details className="rounded-lg border border-border p-4"><summary className="min-h-11 cursor-pointer content-center rounded-md font-semibold">Project and mapping templates</summary><div className="mt-4">
      <MappingTemplateControls
        onPendingChange={value => { templateMutation.current = value; setTemplatePending(value); }}
        key={`mapping-templates-${projectId || "none"}`}
        projectId={projectId}
        projects={projects}
        projectSelectionDisabled={saving || (projectsLoading && projects.length === 0)}
        onProjectChange={(id) => { setProjectId(id); setSavedRunId(null); setSaveStatus(""); }}
        datasets={datasets}
        configuration={currentConfiguration}
        onLoad={loadTemplateConfiguration}
        onTemplateSelection={onAiTemplateSelection}
      /></div></details>
      {datasets.length > 0 && <label className="block max-w-md text-sm font-medium">Configure dataset<Select aria-label="Configure dataset" className="mt-2" value={selectedConfiguration} onChange={event => setConfigureDataset(event.target.value)}>{datasets.map(dataset => <option key={dataset.name} value={dataset.name}>{dataset.filename}</option>)}</Select></label>}

      {selectedConfiguration && <SchemaMappingAssistant configuration={Object.keys(mappingDrafts).length ? null : currentConfiguration}
        dataset={(correctionState?.current ?? datasets).find(dataset => dataset.name === selectedConfiguration)}
        datasetName={selectedConfiguration} template={selectedAiTemplate} revision={aiRevision} disabled={blocked}
        onApprove={approveAiConfiguration} />}

      {datasets.map((dataset) => {
        const mapping = mappings[dataset.name] ?? [];
        const targets = mapping.map((entry) => entry.target.trim()).filter(Boolean);
        const config = rules[dataset.name];
        if (!config) return null;
        return (
          <Card key={dataset.name} data-workspace-dataset={dataset.name} hidden={dataset.name !== selectedConfiguration} {...fieldProps(`dataset-${encodeURIComponent(dataset.name)}`)} tabIndex={-1} aria-label={`${dataset.filename} configuration`} className="scroll-mt-44 space-y-5">
            <div className="border-b border-border pb-4">
              <h2 className="text-xl font-semibold tracking-tight text-foreground [overflow-wrap:anywhere]">{dataset.filename}</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{dataset.rows.length} rows, {dataset.headers.length} columns</p>
            </div>

            {fieldErrors(`dataset-${encodeURIComponent(dataset.name)}`)}

            <SchemaMapping dataset={dataset} mapping={mappingDrafts[dataset.name] ?? mapping} appliedMapping={mapping}
              pending={Boolean(mappingDrafts[dataset.name])} onApply={() => commitMapping(dataset.name)} onCancel={() => cancelMapping(dataset.name)}
              rules={config} fieldTypes={fieldTypes}
              onTargetChange={(source, target) => changeMapping(dataset.name, source, target)}
              onRulesChange={(updated) => updateRules(dataset.name, updated)} />

            <div role="group" aria-label={`Validation rules for ${dataset.filename}`} className="border-t border-border pt-5">
              <h3 className="text-base font-semibold text-foreground">Keys and required fields</h3>
              <p className="mb-4 mt-1 text-sm text-muted-foreground">Keys detect duplicate values; required fields cannot be empty.</p>
              <label className="block text-sm font-medium text-foreground">Primary key
                <Select
                  aria-label={`Primary key for ${dataset.name}`} {...fieldProps(configurationFieldId(dataset.name,"primary"))}
                  className="mt-2 block sm:max-w-md"
                  value={config.primaryKey}
                  onChange={(event) => { updateRules(dataset.name, { ...config, primaryKey: event.target.value }); setPrimaryOverrides((previous) => ({ ...previous, [dataset.name]: "" })); }}
                >
                  <option value="">None</option>
                  {targets.map((target) => <option key={target} value={target}>{target}</option>)}
                </Select>
                {fieldErrors(configurationFieldId(dataset.name,"primary"))}
              </label>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium text-foreground">Composite primary key (comma-separated)
                  <Input aria-label={`Composite primary key for ${dataset.name}`} {...fieldProps(configurationFieldId(dataset.name,"composite-primary"))} className="mt-2"
                    value={primaryOverrides[dataset.name] ?? ""} placeholder="country, code"
                    onChange={(event) => {
                      const value = event.target.value;
                      setPrimaryOverrides((previous) => ({ ...previous, [dataset.name]: value }));
                      if (value.trim()) setRules((previous) => ({ ...previous, [dataset.name]: { ...previous[dataset.name], primaryKey: "" } }));
                      invalidateImpact(); setResult(null); setAnalytics(null); setVerificationAction(null); setSaveStatus(""); setSavedRunId(null);
                    }} />
                  {fieldErrors(configurationFieldId(dataset.name,"composite-primary"))}
                  <span className="mt-1 block text-xs text-muted-foreground">Replaces the single-column primary key. Use target column names.</span>
                </label>
                <label className="block text-sm font-medium text-foreground">Unique keys (one key per line)
                  <Textarea aria-label={`Unique keys for ${dataset.name}`} {...fieldProps(configurationFieldId(dataset.name,"unique"))} rows={3}
                    className="mt-2 min-h-28"
                    value={uniqueSpecs[dataset.name] ?? ""} placeholder={"email\ncountry, code"}
                    onChange={(event) => { setUniqueSpecs((previous) => ({ ...previous, [dataset.name]: event.target.value })); invalidateImpact(); setResult(null); setAnalytics(null); setVerificationAction(null); setSaveStatus(""); setSavedRunId(null); }} />
                  {fieldErrors(configurationFieldId(dataset.name,"unique"))}
                </label>
              </div>
              <label className="mt-5 block text-sm font-medium text-foreground">Required target columns (comma-separated)
                <Input
                  aria-label={`Required target columns (comma-separated) for ${dataset.name}`}
                  className="mt-2 block sm:max-w-md"
                  value={requiredDrafts[dataset.name] ?? config.required.join(", ")}
                  onChange={(event) => {
                    const value = event.target.value;
                    updateRules(dataset.name, {
                      ...config,
                      required: [...new Set(value.split(",").map((name) => name.trim()).filter(Boolean))],
                    });
                    // Keep delimiters and whitespace intact until the user leaves the field.
                    setRequiredDrafts((previous) => ({ ...previous, [dataset.name]: value }));
                  }}
                  onBlur={() => clearRequiredDraft(dataset.name)}
                  {...fieldProps(configurationFieldId(dataset.name,"required"),`required-help-${dataset.name}`)}
                />
              </label>
              {fieldErrors(configurationFieldId(dataset.name,"required"))}
              <p id={`required-help-${dataset.name}`} className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">Use target column names. You can include missing fields; validation will report them as schema errors.</p>
            </div>
          </Card>
        );
      })}

      {datasets.length > 0 && <Card {...fieldProps("rehearsal-relationships")} tabIndex={-1} aria-labelledby="relationships-title" className="scroll-mt-44 space-y-5">
        {fieldErrors("rehearsal-relationships")}
        <h2 id="relationships-title" className="text-xl font-semibold tracking-tight text-foreground">Foreign-key relationships</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">Link child target columns to parent keys. Choose a suggested target name or type one.</p>
        {relationships.length === 0 && <p className="text-sm text-muted-foreground">No single-column relationships configured. Add one only when a child column references a declared parent key.</p>}
        {relationships.map((rel, index) => <fieldset key={index} aria-label={`Relationship ${index + 1}`} className="grid min-w-0 gap-4 rounded-lg border border-border bg-surface-muted/50 p-4 sm:grid-cols-2">
          <label className="text-sm">Child dataset (references parent)
            <Select aria-label={`Child dataset for relationship ${index + 1}`} {...fieldProps(relationshipFieldId(false,index,"child-dataset"))} className="mt-2" value={rel.childDataset} onChange={(e) => editRelationship(index, { childDataset: e.target.value })}>
              {datasets.map((d) => <option key={d.name}>{d.name}</option>)}
            </Select>
          {fieldErrors(relationshipFieldId(false,index,"child-dataset"))}
          </label>
          <label className="text-sm">Child column
            <Input aria-label={`Child column for relationship ${index + 1}`} list={relationshipFieldId(false,index,"child-column") + "-options"} autoComplete="off" {...fieldProps(relationshipFieldId(false,index,"child-column"))} className="mt-2" value={rel.childColumn} onChange={(e) => editRelationship(index, { childColumn: e.target.value })} />
            <datalist id={relationshipFieldId(false,index,"child-column") + "-options"}>{relationshipColumnOptions(mappings[rel.childDataset] ?? []).map(value => <option key={value} value={value} />)}</datalist>
          {fieldErrors(relationshipFieldId(false,index,"child-column"))}
          </label>
          <label className="text-sm">Parent dataset (referenced key)
            <Select aria-label={`Parent dataset for relationship ${index + 1}`} {...fieldProps(relationshipFieldId(false,index,"parent-dataset"))} className="mt-2" value={rel.parentDataset} onChange={(e) => editRelationship(index, { parentDataset: e.target.value })}>
              {datasets.map((d) => <option key={d.name}>{d.name}</option>)}
            </Select>
          {fieldErrors(relationshipFieldId(false,index,"parent-dataset"))}
          </label>
          <label className="text-sm">Parent column
            <Input aria-label={`Parent column for relationship ${index + 1}`} list={relationshipFieldId(false,index,"parent-column") + "-options"} autoComplete="off" {...fieldProps(relationshipFieldId(false,index,"parent-column"))} className="mt-2" value={rel.parentColumn} onChange={(e) => editRelationship(index, { parentColumn: e.target.value })} />
            <datalist id={relationshipFieldId(false,index,"parent-column") + "-options"}>{relationshipColumnOptions(mappings[rel.parentDataset] ?? []).map(value => <option key={value} value={value} />)}</datalist>
          {fieldErrors(relationshipFieldId(false,index,"parent-column"))}
          </label>
          <Button type="button" variant="danger" className="sm:col-span-2 sm:justify-self-start" onClick={() => { setRelationships((all) => all.filter((_, i) => i !== index)); invalidateImpact(); setResult(null); setAnalytics(null); setVerificationAction(null); setSaveStatus(""); setSavedRunId(null); }}>
            Remove relationship
          </Button>
        </fieldset>)}
        <Button type="button" className="w-full sm:w-auto" onClick={() => {
          setRelationships((all) => [...all, {
            childDataset: datasets[0].name,
            parentDataset: datasets[1]?.name ?? datasets[0].name,
            childColumn: "",
            parentColumn: "",
          }]);
          invalidateImpact(); setResult(null); setAnalytics(null); setVerificationAction(null);
          setSaveStatus(""); setSavedRunId(null);
        }}>Add relationship</Button>
      </Card>}

      {datasets.length > 0 && <Card aria-labelledby="composite-relations-title" className="space-y-4">
        <h2 id="composite-relations-title" className="text-xl font-semibold">Composite foreign keys</h2>
        <p className="text-sm text-muted-foreground">Link multiple target columns in matching order. Parent columns must form a declared composite primary or unique key. Add a comma for another column; suggestions keep your order.</p>
        {compositeRelationships.map((rel, index) => <fieldset key={index} aria-label={`Composite relationship ${index + 1}`} className="grid min-w-0 gap-4 rounded-lg border border-border bg-surface-muted/50 p-4 sm:grid-cols-2">
          <label className="text-sm">Child dataset (references parent)
            <Select aria-label={`Composite child dataset ${index + 1}`} {...fieldProps(relationshipFieldId(true,index,"child-dataset"))} className="mt-2" value={rel.childDataset}
              onChange={(event) => updateComposite(index, { childDataset: event.target.value })}>
              {datasets.map((ds) => <option key={ds.name} value={ds.name}>{ds.name}</option>)}
            </Select>
          {fieldErrors(relationshipFieldId(true,index,"child-dataset"))}
          </label>
          <label className="text-sm">Child columns, comma-separated
            <Input aria-label={`Composite child columns ${index + 1}`} list={relationshipFieldId(true,index,"child-column") + "-options"} autoComplete="off" {...fieldProps(relationshipFieldId(true,index,"child-column"))} className="mt-2" value={rel.childColumns.join(", ")}
              onChange={(event) => updateComposite(index, { childColumns: event.target.value.split(",").map((v) => v.trim()) })} />
            <datalist id={relationshipFieldId(true,index,"child-column") + "-options"}>{relationshipColumnOptions(mappings[rel.childDataset] ?? [],rel.childColumns).map(value => <option key={value} value={value} />)}</datalist>
          {fieldErrors(relationshipFieldId(true,index,"child-column"))}
          </label>
          <label className="text-sm">Parent dataset (referenced key)
            <Select aria-label={`Composite parent dataset ${index + 1}`} {...fieldProps(relationshipFieldId(true,index,"parent-dataset"))} className="mt-2" value={rel.parentDataset}
              onChange={(event) => updateComposite(index, { parentDataset: event.target.value })}>
              {datasets.map((ds) => <option key={ds.name} value={ds.name}>{ds.name}</option>)}
            </Select>
          {fieldErrors(relationshipFieldId(true,index,"parent-dataset"))}
          </label>
          <label className="text-sm">Parent columns, comma-separated
            <Input aria-label={`Composite parent columns ${index + 1}`} list={relationshipFieldId(true,index,"parent-column") + "-options"} autoComplete="off" {...fieldProps(relationshipFieldId(true,index,"parent-column"))} className="mt-2" value={rel.parentColumns.join(", ")}
              onChange={(event) => updateComposite(index, { parentColumns: event.target.value.split(",").map((v) => v.trim()) })} />
            <datalist id={relationshipFieldId(true,index,"parent-column") + "-options"}>{relationshipColumnOptions(mappings[rel.parentDataset] ?? [],rel.parentColumns).map(value => <option key={value} value={value} />)}</datalist>
          {fieldErrors(relationshipFieldId(true,index,"parent-column"))}
          </label>
          <Button type="button" variant="danger" onClick={() => { setCompositeRelationships((all) => all.filter((_, i) => i !== index)); invalidateImpact(); setResult(null); setAnalytics(null); setVerificationAction(null); setSaveStatus(""); setSavedRunId(null); }} className="w-full sm:col-span-2 sm:w-auto sm:justify-self-start">Remove composite relationship</Button>
        </fieldset>)}
        <Button type="button" className="w-full sm:w-auto" onClick={() => { setCompositeRelationships((all) => [...all, {
          childDataset: datasets[0].name, childColumns: [""], parentDataset: datasets[1]?.name ?? datasets[0].name, parentColumns: [""],
        }]); invalidateImpact(); setResult(null); setAnalytics(null); setVerificationAction(null); setSaveStatus(""); setSavedRunId(null); }}>Add composite relationship</Button>
      </Card>}

      </section>
      {configurationFindings.length > 0 && (activeStep === "validate" || activeStep === "review") && <section aria-labelledby="configuration-errors-title" className="space-y-3 rounded-lg border border-danger bg-danger-surface p-4">
        <h2 id="configuration-errors-title" className="font-semibold">Review configuration</h2>
        <ul className="space-y-2 text-sm [overflow-wrap:anywhere]">{configurationFindings.map(({issue,location}) => <li key={issue.id}>
          <a href={`#${encodeURIComponent(location.id)}`} className="rounded-md font-medium text-danger underline">{location.label}: {issue.explanation}</a>
        </li>)}</ul>
      </section>}

      <section data-workspace-step="validate" hidden={activeStep !== "validate"} aria-labelledby="workspace-validate-heading" className="space-y-5">
      {stepHeading("validate")}
      {Object.keys(mappingDrafts).length > 0 && <p className="rounded-lg border border-warning bg-warning-surface p-3 text-sm">Unapplied mapping drafts are excluded. Return to Configure to Apply or Cancel them.</p>}
      {datasets.length > 0 && <RehearsalExecution
        report={result} datasetCount={datasets.length}
        relationshipCount={relationships.length + compositeRelationships.length}
        busy={busy} error={error} onRun={validate}
      />}

      </section>
      <section data-workspace-step="review" hidden={activeStep !== "review"} aria-labelledby="workspace-review-heading" className="min-w-0 space-y-5">
      {stepHeading("review")}
      <div className="flex flex-wrap gap-2"><Button type="button" onClick={() => goStep("correct")}>Correct records (optional)</Button><Button type="button" onClick={() => goStep("configure")}>Edit configuration</Button><Button type="button" onClick={generateSchemaDiagram} disabled={blocked || !result || Boolean(Object.keys(mappingDrafts).length || Object.keys(requiredDrafts).length)}>Generate schema diagram</Button></div>
      {result && <Card id="validation-results" tabIndex={-1} className="scroll-mt-44 space-y-5" aria-label="Validation results">
        <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">Validation report</h2>
        {verificationAction && <RevalidationStatus action={verificationAction} status={result.status} />}
        <label className="block max-w-md text-sm font-medium">Review section<Select aria-label="Review section" className="mt-2" value={reviewView} onChange={event => setReviewView(event.target.value as ReviewView)}><option value="summary">Summary and readiness</option><option value="issues">Issues</option><option value="dependencies">Dependencies</option><option value="analytics">Dataset analytics</option><option value="schema">Schema diagram</option></Select></label>
        {analytics ? <ReportAnalyticsDashboard analytics={analytics} view={reviewView}>
          <details hidden={reviewView !== "summary"} className="rounded-lg border border-border p-4"><summary className="min-h-11 cursor-pointer content-center rounded-md font-semibold">Recommended next actions</summary><div className="mt-4"><ReadinessInsightsPanel report={result} relationships={[...relationships, ...compositeRelationships]} /></div></details>
          <div data-review-view="issues" hidden={reviewView !== "issues"}><IssueExplorer key={issueFocus?.report === result ? issueFocus.ids.join(":") : "all"} issues={result.issues}
              focusIssueIds={issueFocus?.report === result ? issueFocus.ids : undefined} onClearFocus={() => setIssueFocus(null)}
              onExplain={!blocked && impactSnapshot?.report === result && impactSnapshot.evidence ? explainIssue : undefined}
              canLocate={issue => Boolean(correctionState && issueCorrectionLocation(issue,correctionState,mappings))}
              onLocate={locateIssue} /></div>
        </ReportAnalyticsDashboard> : <>
          <details hidden={reviewView !== "summary"} className="rounded-lg border border-border p-4"><summary className="min-h-11 cursor-pointer content-center rounded-md font-semibold">Recommended next actions</summary><div className="mt-4"><ReadinessInsightsPanel report={result} relationships={[...relationships, ...compositeRelationships]} /></div></details>
          <div data-review-view="issues" hidden={reviewView !== "issues"}><IssueExplorer key={issueFocus?.report === result ? issueFocus.ids.join(":") : "all"} issues={result.issues}
              focusIssueIds={issueFocus?.report === result ? issueFocus.ids : undefined} onClearFocus={() => setIssueFocus(null)}
              onExplain={!blocked && impactSnapshot?.report === result && impactSnapshot.evidence ? explainIssue : undefined}
              canLocate={issue => Boolean(correctionState && issueCorrectionLocation(issue,correctionState,mappings))}
              onLocate={locateIssue} /></div>
        </>}
        <div data-review-view="summary" hidden={reviewView !== "summary"}><RootCauseAnalyzer report={result}
          evidence={impactSnapshot?.report === result && impactSnapshot.analytics === analytics ? impactSnapshot.evidence : null}
          evidenceError={impactSnapshot?.report === result ? impactSnapshot.error : undefined} revision={aiRevision}
          disabled={blocked} draftsPending={Object.keys(mappingDrafts).length > 0}
          focusIssueIds={analysisFocus?.report === result ? analysisFocus.ids : undefined} onClearFocus={() => setAnalysisFocus(null)}
          onViewIssues={viewCitedIssues} onLocate={locateIssue} onViewDependencies={() => { revealTarget("dependency-heading"); }}
          canLocate={issue => Boolean(correctionState && issueCorrectionLocation(issue, correctionState, mappings))} /></div>
        {correctionState && <details hidden={reviewView !== "summary"} className="rounded-lg border border-border p-4">
          <summary className="min-h-11 cursor-pointer content-center rounded-md font-semibold">Compare original and corrected results</summary>
          <ReportComparisonPanel state={correctionState} verifiedReport={result} config={comparisonConfig} />
        </details>}
        <div data-review-view="dependencies" hidden={reviewView !== "dependencies"}><DependencyGraphSection report={result} relationships={[...relationships, ...compositeRelationships]} /></div>
        <details hidden={reviewView !== "summary"} className="rounded-lg border border-border p-4 text-sm">
          <summary className="cursor-pointer font-semibold">Preflight assumptions and limitations</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5">{result.assumptions.map((item) => <li key={item}>{item}</li>)}</ul>
        </details>
      </Card>}
      <div data-review-view="schema" hidden={reviewView !== "schema"}>
        <SchemaDiagramSection ref={schemaDiagram} configuration={schemaConfiguration} report={result}
          draftsPending={Boolean(Object.keys(mappingDrafts).length || Object.keys(requiredDrafts).length)} disabled={blocked}
          active={activeStep === "review" && reviewView === "schema"} />
      </div>
      </section>
      <section data-workspace-step="correct" hidden={activeStep !== "correct"} aria-labelledby="workspace-correct-heading" className="min-w-0 space-y-5">
      {stepHeading("correct")}
      <Button type="button" disabled={!result} onClick={() => goStep("review")}>Review current results</Button>
      {correctionState && <CorrectionWorkspace
        active={activeStep === "correct"}
        navigationRef={correctionNavigation}
        key={correctionSessionId}
        state={correctionState}
        repairSource={repairSource}
        repairDisabled={blocked}
        onPreview={previewCorrection}
        previewContextKey={JSON.stringify([mappings, rules, relationships, compositeRelationships, primaryOverrides, uniqueSpecs])}
        issues={result?.issues ?? []}
        validationStatus={result?.status ?? null}
        validationError={error}
        mappings={mappings}
        onApprove={approveCorrection}
        onUndo={undoApprovedCorrection}
        onRedo={redoApprovedCorrection}
        onDiscard={discardApprovedCorrections}
      />}

      </section>
      <section data-workspace-step="export" hidden={activeStep !== "export"} aria-labelledby="workspace-export-heading" className="min-w-0 space-y-5">
      {stepHeading("export")}
      <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">Choose corrected records, validation metadata or target-specific files. Downloads stay local; generating a file does not import data.</p>
      <p className="rounded-lg border border-warning bg-warning-surface p-3 text-sm">CSV records exist only in this browser tab. A saved validation summary is not a CSV backup. Download approved corrections before leaving; refreshing loses browser-memory records.</p>
      {!result && <p role="status" className="text-sm text-muted-foreground">No current validation report. Run validation after configuration changes to enable report exports and summary saving.</p>}
      {result && <Card className="space-y-5">        <div className="space-y-2">
          <h3 className="text-base font-semibold">Full report with explanations</h3>
          <Button type="button" onClick={downloadReport} className="w-full sm:w-auto">Download JSON report</Button>
          <p className="text-sm leading-relaxed text-muted-foreground">Full JSON report includes issue explanations and configuration metadata. Review before sharing.</p>
        </div>
        {analytics && <ReportExportControls report={result} analytics={analytics} onDownloadStarted={() => setDownloaded({ state: correctionState, report: result })} />}
        <div className="space-y-4 rounded-lg border border-border bg-surface-muted/50 p-4 sm:p-5">
          <label htmlFor="save-project" className="block text-base font-semibold text-foreground">Save summary to project (optional)</label>
          <Select disabled={saving || (projectsLoading && projects.length === 0)} id="save-project" className="sm:max-w-md" value={projectId} onChange={(e) => { setProjectId(e.target.value); setSavedRunId(null); setSaveStatus(""); }}>
            <option value="">Choose project</option>
            {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
          </Select>
          <div><Button type="button" pending={saving} disabled={!projectId || !toValidationRunSummary(result)} onClick={() => void saveSummary()} variant="primary" className="w-full sm:w-auto">
            {saving ? "Saving..." : "Save validation summary"}
          </Button></div>
          {!toValidationRunSummary(result) && <p role="status" className="text-sm text-danger">
            {result.status} cannot be saved because the report counts or issue metadata are inconsistent. No fabricated row counts will be sent.
          </p>}
          {saveStatus && <p role="status" className="rounded-lg border border-border bg-surface p-3 text-sm text-foreground">{saveStatus}</p>}
          {savedRunId && <Link
            href={`/results/${encodeURIComponent(savedRunId)}`}
            className="inline-flex min-h-11 items-center rounded-lg border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground"
          >View saved summary</Link>}
          <p className="text-sm text-muted-foreground">Only client-calculated summary counts are sent. Raw CSV rows and structured issues are not sent to the API; the server has not independently validated them.</p>
        </div>
      </Card>}
      {correctionState && <CorrectedCsvExportControls onDownloadStarted={() => setDownloaded({ state: correctionState, report: result })} key={`corrected-export-${correctionSessionId}`} state={correctionState} />}
      {datasets.length > 0 && <PostgresqlSchemaExport scope={postgresScope} active={activeStep === "export"} disabled={blocked} />}
      {datasets.length > 0 && <MongodbExport scope={postgresScope} active={activeStep === "export"} disabled={blocked} />}
      {datasets.length > 0 && <MysqlExport scope={postgresScope} active={activeStep === "export"} disabled={blocked} />}

      </section>
    </div>
  );
}
