import { z } from "zod";
import type { CellAddress, CorrectionState } from "../corrections/types";
import { getCurrentCellValue } from "../corrections/engine";
import type { WhatIfConfiguration } from "../corrections/what-if";
import { issueCorrectionLocation } from "../corrections/navigation";
import type { RehearsalIssue, RehearsalReportV1 } from "../rehearsal/types";
import { buildWorkspaceKeyRules } from "../rehearsal/workspace-config";
import { templateConfigurationSchema, type TemplateConfiguration } from "../templates/schema";
import { AI_MAX_CONTEXT_BYTES, AiError, sameAiVersion, type AiVersion } from "./contracts";
import { readImpactEvidence, resolveImpactDataset, resolveImpactIssue, type ImpactEvidence } from "./impact-evidence";
import {
  smartRepairIntentSchema, smartRepairRecommendationSchema, smartRepairRevisionsSchema, smartRepairWireContextSchema,
  type SmartRepairIntent, type SmartRepairRecommendation, type SmartRepairWireContext,
} from "./smart-repair-contracts";

/** Trusted browser owner must advance workspaceRevision for drafts, policy and scope changes. */
export interface SmartRepairWorkspaceSnapshot {
  readonly version: AiVersion;
  readonly workspaceRevision: number;
  readonly evidence: ImpactEvidence;
  readonly report: RehearsalReportV1;
  readonly corrections: CorrectionState;
  readonly configuration: TemplateConfiguration | null;
  readonly intent: SmartRepairIntent;
  readonly draftsPending: boolean;
}

declare const smartRepairBrand: unique symbol;
export type SmartRepairContext = Readonly<{
  version: AiVersion; workspaceRevision: number; [smartRepairBrand]: true;
}>;
type LocalTarget = Readonly<{
  issueId: string; dataset: string; rowNumber: number | null;
  sourceColumn: string | null; targetColumn: string | null;
}>;
type Entry = {
  initial: SmartRepairWorkspaceSnapshot;
  getSnapshot: () => SmartRepairWorkspaceSnapshot;
  binding: string;
  wire: SmartRepairWireContext;
  json: string;
  local: LocalTarget;
};
const contexts = new WeakMap<object, Entry>();

function binding(snapshot: SmartRepairWorkspaceSnapshot): string {
  const revisions = smartRepairRevisionsSchema.parse({ version: snapshot.version, workspaceRevision: snapshot.workspaceRevision });
  if (typeof snapshot.draftsPending !== "boolean") throw new AiError("INVALID_CONTEXT");
  return JSON.stringify({ ...revisions,
    configuration: snapshot.configuration === null ? null : templateConfigurationSchema.parse(snapshot.configuration),
    intent: smartRepairIntentSchema.parse(snapshot.intent), draftsPending: snapshot.draftsPending,
    report: { schemaVersion: snapshot.report.schemaVersion, mode: snapshot.report.mode,
      status: snapshot.report.status, totals: snapshot.report.totals, datasets: snapshot.report.datasets,
      issues: snapshot.report.issues.map(issue => [issue.id, issue.code, issue.category, issue.severity,
        issue.dataset, issue.rowNumber, issue.column, issue.ruleId]) },
  });
}

function entryFor(context: SmartRepairContext): Entry {
  const entry = contexts.get(context);
  if (!entry) throw new AiError("INVALID_CONTEXT");
  try {
    const current = entry.getSnapshot(), initial = entry.initial;
    if (current.evidence !== initial.evidence || current.report !== initial.report ||
        current.corrections !== initial.corrections || binding(current) !== entry.binding) throw new AiError("STALE");
    const evidence = readImpactEvidence(current.evidence);
    if (!sameAiVersion(evidence.version, context.version)) throw new AiError("STALE");
  } catch { throw new AiError("STALE"); }
  return entry;
}

function protectedColumn(configuration: TemplateConfiguration, dataset: string, column: string): "key" | "reference" | null {
  const keys = buildWorkspaceKeyRules(configuration.rules, configuration.primaryOverrides, configuration.uniqueSpecs)[dataset];
  if (configuration.rules[dataset].primaryKey === column || keys?.primaryKey?.includes(column) ||
      keys?.uniqueKeys?.some(columns => columns.includes(column))) return "key";
  for (const relation of [...configuration.relationships, ...configuration.compositeRelationships]) {
    const child = "childColumns" in relation ? relation.childColumns : [relation.childColumn];
    const parent = "parentColumns" in relation ? relation.parentColumns : [relation.parentColumn];
    if ((relation.childDataset === dataset && child.includes(column)) ||
        (relation.parentDataset === dataset && parent.includes(column))) return "reference";
  }
  return null;
}

function optionsFor(issue: RehearsalIssue, snapshot: SmartRepairWorkspaceSnapshot, cell: boolean): Omit<SmartRepairWireContext, "schemaVersion" | "requestId" | "target" | "evidence"> {
  const configuredType = snapshot.configuration?.rules[issue.dataset]?.types[issue.column ?? ""] ?? null;
  const wire: Omit<SmartRepairWireContext, "schemaVersion" | "requestId" | "target" | "evidence"> = {
    issue: { code: issue.code, category: issue.category, severity: issue.severity,
      rowValidity: snapshot.report.status === "CONFIG_ERROR" ? "UNEVALUATED" : "EVALUATED", configuredType },
    allowedStrategies: [], inputRequests: [], guidanceOptions: [], unsupportedReasons: ["INSUFFICIENT_EVIDENCE"],
  };
  if (snapshot.report.status === "CONFIG_ERROR") {
    wire.guidanceOptions = ["REVIEW_CONFIGURATION"];
    wire.unsupportedReasons.push("ROW_VALIDITY_UNEVALUATED");
  } else if (snapshot.draftsPending || issue.category === "SCHEMA") {
    wire.guidanceOptions = ["REVIEW_CONFIGURATION"];
  } else if (issue.category === "DEPENDENCY") {
    wire.guidanceOptions = ["REVIEW_DEPENDENCIES"];
  } else if (["DUPLICATE_PK", "DUPLICATE_UNIQUE"].includes(issue.code)) {
    wire.guidanceOptions = ["REVIEW_KEY_RECORDS"];
  } else if (issue.code === "FK_NOT_FOUND") {
    wire.guidanceOptions = ["REVIEW_REFERENCE"];
  } else {
    const protectedKind = snapshot.configuration && issue.column !== null
      ? protectedColumn(snapshot.configuration, issue.dataset, issue.column) : null;
    if (protectedKind) wire.guidanceOptions = [protectedKind === "key" ? "REVIEW_KEY_RECORDS" : "REVIEW_REFERENCE"];
    else if (cell && issue.code === "REQUIRED") wire.inputRequests = ["PROVIDE_REPLACEMENT"];
    else if (cell && issue.code === "INVALID_TYPE" && configuredType === "boolean") {
      if (snapshot.intent.kind === "CONFIRMED_BOOLEAN") wire.allowedStrategies = ["BOOLEAN_FROM_CONFIRMED_CONVENTION"];
      else wire.inputRequests = ["CONFIRM_BOOLEAN_CONVENTION"];
    } else if (cell && issue.code === "INVALID_TYPE" && configuredType === "date") {
      if (snapshot.intent.kind === "CONFIRMED_DATE") wire.allowedStrategies = ["DATE_FROM_CONFIRMED_FORMAT"];
      else wire.inputRequests = ["CONFIRM_DATE_FORMAT"];
    }
  }
  if (snapshot.intent.kind === "AMBIGUOUS" || wire.inputRequests.some(request => request.startsWith("CONFIRM_"))) {
    wire.unsupportedReasons.push("AMBIGUOUS_INTENT");
  }
  if (!wire.allowedStrategies.length && !wire.inputRequests.length) wire.unsupportedReasons.push("UNSUPPORTED_TRANSFORMATION");
  return wire;
}

/** Contract construction only: no replacement computation, preview, mutation, inference or persistence. */
export function buildSmartRepairContext({ getSnapshot, issueId }: {
  getSnapshot: () => SmartRepairWorkspaceSnapshot; issueId: string;
}): SmartRepairContext {
  try {
    const snapshot = getSnapshot();
    const capturedBinding = binding(snapshot), evidence = readImpactEvidence(snapshot.evidence);
    if (!sameAiVersion(snapshot.version, evidence.version) || snapshot.report.schemaVersion !== "1" ||
        snapshot.report.mode !== "STATIC_PREFLIGHT" || snapshot.report.status !== evidence.report.status ||
        snapshot.report.issues.length !== evidence.report.issueCount ||
        Object.keys(snapshot.report.totals).length !== 5 ||
        (["totalRows", "validRows", "invalidRows", "errors", "warnings"] as const)
          .some(key => snapshot.report.totals[key] !== evidence.report[key])) throw new AiError("INVALID_CONTEXT");
    const issue = snapshot.report.issues.find(issue => issue.id === issueId);
    const fact = evidence.issues.find(fact => resolveImpactIssue(snapshot.evidence, fact.id)?.id === issueId);
    if (!issue || !fact) throw new AiError("INVALID_CONTEXT");
    const location = resolveImpactIssue(snapshot.evidence, fact.id)!;
    if (issue.dataset !== location.dataset || issue.rowNumber !== location.rowNumber || issue.column !== location.column ||
        issue.code !== fact.code || issue.category !== fact.category || issue.severity !== fact.severity ||
        (fact.datasetId !== null && resolveImpactDataset(snapshot.evidence, fact.datasetId) !== issue.dataset)) throw new AiError("INVALID_CONTEXT");
    const dataset = snapshot.corrections.current.find(dataset => dataset.name === issue.dataset);
    if (issue.category === "DATA" && (!dataset || issue.rowNumber === null || !dataset.rowNumbers.includes(issue.rowNumber))) throw new AiError("INVALID_CONTEXT");
    const sourceLocation = snapshot.configuration
      ? issueCorrectionLocation(issue, snapshot.corrections, snapshot.configuration.mappings) : null;
    if (issue.category === "DATA" && issue.column !== null && !sourceLocation?.column) throw new AiError("INVALID_CONTEXT");
    const target = { issueId: fact.id, datasetId: fact.datasetId,
      rowId: sourceLocation ? "r0" : null, columnId: sourceLocation?.column ? "c0" : null };
    const cell = target.datasetId !== null && target.rowId !== null && target.columnId !== null;
    const wire = smartRepairWireContextSchema.parse({ schemaVersion: 1, requestId: crypto.randomUUID(), target,
      evidence: { reportStatus: evidence.report.status, totalIssues: evidence.report.issueCount,
        matchingIssues: evidence.issues.filter(other => other.code === fact.code && other.category === fact.category && other.severity === fact.severity).length,
        errors: evidence.report.errors, warnings: evidence.report.warnings }, ...optionsFor(issue, snapshot, cell) });
    const json = JSON.stringify(wire);
    if (new TextEncoder().encode(json).byteLength > AI_MAX_CONTEXT_BYTES) throw new AiError("CONTEXT_TOO_LARGE");
    const revisions = smartRepairRevisionsSchema.parse({ version: snapshot.version, workspaceRevision: snapshot.workspaceRevision });
    const context = Object.freeze({ version: Object.freeze(revisions.version), workspaceRevision: revisions.workspaceRevision }) as SmartRepairContext;
    contexts.set(context, { initial: { ...snapshot }, getSnapshot, binding: capturedBinding, wire, json,
      local: Object.freeze({ issueId: issue.id, dataset: issue.dataset, rowNumber: issue.rowNumber,
        sourceColumn: sourceLocation?.column ?? null, targetColumn: issue.column }) });
    entryFor(context);
    return context;
  } catch (error) { throw error instanceof AiError ? error : new AiError("INVALID_CONTEXT"); }
}

export function serializeSmartRepairContext(context: SmartRepairContext): string { return entryFor(context).json; }
export function assertSmartRepairCurrent(context: SmartRepairContext): void { entryFor(context); }

/** Constrain generation to the selected references and offered outcomes; runtime grounding remains mandatory. */
export function smartRepairOutputFormat(context: SmartRepairContext) {
  const { wire } = entryFor(context);
  const envelope = { schemaVersion: z.literal(1), requestId: z.literal(wire.requestId),
    target: z.object({ issueId: z.literal(wire.target.issueId), datasetId: z.literal(wire.target.datasetId),
      rowId: z.literal(wire.target.rowId), columnId: z.literal(wire.target.columnId) }).strict() };
  const branches: z.ZodType[] = [z.object({ ...envelope, outcome: z.literal("UNSUPPORTED_OR_INSUFFICIENT_EVIDENCE"),
    reason: z.enum(wire.unsupportedReasons) }).strict()];
  if (wire.allowedStrategies.length) branches.push(z.object({ ...envelope, outcome: z.literal("ACTIONABLE_CANDIDATE"), strategyId: z.enum(wire.allowedStrategies) }).strict());
  if (wire.inputRequests.length) branches.push(z.object({ ...envelope, outcome: z.literal("REQUIRES_USER_INPUT"), input: z.enum(wire.inputRequests) }).strict());
  if (wire.guidanceOptions.length) branches.push(z.object({ ...envelope, outcome: z.literal("GUIDANCE_ONLY"), guidance: z.enum(wire.guidanceOptions) }).strict());
  return z.toJSONSchema(branches.length === 1 ? branches[0] : z.union(branches as [z.ZodType, ...z.ZodType[]]));
}

export function validateSmartRepairRecommendation(context: SmartRepairContext, value: unknown): SmartRepairRecommendation {
  const entry = entryFor(context), parsed = smartRepairRecommendationSchema.safeParse(value);
  if (!parsed.success) throw new AiError("INVALID_RESPONSE", "OUTPUT_SCHEMA");
  const recommendation = parsed.data;
  if (recommendation.requestId !== entry.wire.requestId ||
      JSON.stringify(recommendation.target) !== JSON.stringify(entry.wire.target)) throw new AiError("INVALID_RESPONSE", "UNKNOWN_EVIDENCE");
  const supported = recommendation.outcome === "ACTIONABLE_CANDIDATE" ? entry.wire.allowedStrategies.includes(recommendation.strategyId)
    : recommendation.outcome === "REQUIRES_USER_INPUT" ? entry.wire.inputRequests.includes(recommendation.input)
    : recommendation.outcome === "GUIDANCE_ONLY" ? entry.wire.guidanceOptions.includes(recommendation.guidance)
    : entry.wire.unsupportedReasons.includes(recommendation.reason);
  if (!supported) throw new AiError("INVALID_RESPONSE", "UNSUPPORTED_CLAIM");
  return structuredClone(recommendation);
}

/** Browser-only coordinates. This lookup contains no replacement and cannot apply an edit. */
export function resolveSmartRepairTarget(context: SmartRepairContext, value: unknown): LocalTarget {
  validateSmartRepairRecommendation(context, value);
  return { ...entryFor(context).local };
}

/** Private-data bridge for browser-local resolution only. Never serialize this result to a provider. */
export function readSmartRepairLocalCell(context: SmartRepairContext, value: unknown) {
  const recommendation = validateSmartRepairRecommendation(context, value);
  if (recommendation.outcome !== "ACTIONABLE_CANDIDATE") throw new AiError("INVALID_RESPONSE", "UNSUPPORTED_CLAIM");
  const entry = entryFor(context), { dataset, rowNumber, sourceColumn, issueId, targetColumn } = entry.local;
  if (rowNumber === null || sourceColumn === null || targetColumn === null || entry.wire.issue.configuredType === null) {
    throw new AiError("INVALID_CONTEXT");
  }
  const address: CellAddress = Object.freeze({ dataset, rowNumber, column: sourceColumn });
  let currentValue: string;
  try { currentValue = getCurrentCellValue(entry.initial.corrections, address); }
  catch { throw new AiError("INVALID_CONTEXT"); }
  if (typeof currentValue !== "string") throw new AiError("INVALID_CONTEXT");
  return Object.freeze({ address, currentValue, issueId, targetColumn,
    configuredType: entry.wire.issue.configuredType,
    intent: Object.freeze(smartRepairIntentSchema.parse(entry.initial.intent)) });
}

/** Sensitive browser-local simulation input. Configuration is detached; CSV snapshots remain frozen. */
export function readSmartRepairSimulationSource(context: SmartRepairContext, value: unknown) {
  readSmartRepairLocalCell(context, value);
  const entry = entryFor(context);
  if (!entry.initial.configuration) throw new AiError("INVALID_CONTEXT");
  const configuration = templateConfigurationSchema.parse(entry.initial.configuration);
  const config: WhatIfConfiguration = {
    mappings: configuration.mappings, rules: configuration.rules,
    relationships: [...configuration.relationships, ...configuration.compositeRelationships],
    keyRules: buildWorkspaceKeyRules(configuration.rules, configuration.primaryOverrides, configuration.uniqueSpecs),
  };
  return { state: entry.initial.corrections, config };
}
