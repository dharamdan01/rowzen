import { z } from "zod";
import type { VerifiedCorrectionReport } from "../corrections/revalidation";
import type { RehearsalIssue, RehearsalReportV1 } from "../rehearsal/types";
import { analyzeDependencyGraph } from "../rehearsal/graph";
import { toValidationRunSummary } from "../rehearsal/report-persistence";
import { buildReadinessInsights } from "../reports/readiness-insights";
import { prepareReportExport, reportInvestigationForCode } from "../reports/export";
import type { ReportAnalytics } from "../reports/types";
import { templateConfigurationSchema, type TemplateConfiguration } from "../templates/schema";
import {
  AI_MAX_CONTEXT_BYTES, AiError, advanceAiVersion, aiCounterSchema as count, aiIssueCodeSchema,
  aiReadinessStatusSchema, aiVersionSchema, createAiVersion, sameAiVersion, type AiVersion,
} from "./contracts";
import { impactEvidenceSchema, type ImpactEvidenceData } from "./impact-evidence-contracts";

const cmp = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const label = z.string().min(1).max(512);
const issueSchema = z.object({
  id: z.string().regex(/^issue_[0-9a-f]{16}$/), code: aiIssueCodeSchema,
  category: z.enum(["DATA", "SCHEMA", "DEPENDENCY"]), severity: z.enum(["ERROR", "WARNING"]),
  dataset: label, column: label.nullable(), rowNumber: count.min(1).nullable(), ruleId: z.string().min(1).max(16_384),
  relatedIssueIds: z.array(z.string()).max(10_000),
  referencedRecords: z.array(z.object({ dataset: label, rowNumber: count.min(1), column: label.nullable() }).strict()).max(10_000),
}).strict();
const metricsSchema = z.object({
  dataset: label, totalRows: count, validRows: count.nullable(), invalidRows: count.nullable(),
  blockingErrors: count, warnings: count, issueCount: count,
}).strict();

declare const impactBrand: unique symbol;
export type ImpactEvidence = Readonly<{ version: AiVersion; issueCount: number; [impactBrand]: true }>;
export type ImpactIssueLocation = Readonly<{ id: string; dataset: string; rowNumber: number | null; column: string | null }>;
export type ImpactRelationshipLocation = Readonly<{ parentDataset: string; childDataset: string; parentColumns: string[]; childColumns: string[] }>;
type Entry = {
  data: ImpactEvidenceData;
  locations: Map<string, ImpactIssueLocation>;
  datasetLabels: Map<string, string>;
  relationshipLabels: Map<string, ImpactRelationshipLocation>;
  isCurrent: () => boolean;
};
const entries = new WeakMap<object, Entry>();

export type ImpactReportInput = {
  source: "LIVE_REPORT";
  verified: VerifiedCorrectionReport;
  configuration: TemplateConfiguration | null;
  expectedVersion: AiVersion;
};

/** Reuse canonical checks on an explicit metadata projection; never retain issue prose or rows. */
function checkedInput(input: ImpactReportInput) {
  if (input.source !== "LIVE_REPORT" || !input.verified?.report || !input.verified.analytics) throw new AiError("INVALID_CONTEXT");
  const source = input.verified.report, supplied = input.verified.analytics;
  if (!Array.isArray(source.issues)) throw new AiError("INVALID_CONTEXT");
  if (source.issues.length > 10_000) throw new AiError("CONTEXT_TOO_LARGE");
  let references = 0;
  for (const issue of source.issues) {
    if (!Array.isArray(issue?.relatedIssueIds) || !Array.isArray(issue.referencedRecords)) throw new AiError("INVALID_CONTEXT");
    references += issue.relatedIssueIds.length + issue.referencedRecords.length;
    if (references > 100_000) throw new AiError("CONTEXT_TOO_LARGE");
  }
  const issues = source.issues.map(issue => issueSchema.parse({
    id: issue.id, code: issue.code, category: issue.category, severity: issue.severity,
    dataset: issue.dataset, column: issue.column, rowNumber: issue.rowNumber, ruleId: issue.ruleId,
    relatedIssueIds: issue.relatedIssueIds, referencedRecords: issue.referencedRecords,
  })).sort((a, b) => cmp(a.id, b.id));
  const names = z.array(label).min(1).max(5).parse(source.datasets).sort(cmp);
  const totals = z.object({ totalRows: count, validRows: count.nullable(), invalidRows: count.nullable(), errors: count, warnings: count }).strict().parse(source.totals);
  const report: RehearsalReportV1 = {
    schemaVersion: z.literal("1").parse(source.schemaVersion), mode: z.literal("STATIC_PREFLIGHT").parse(source.mode),
    status: aiReadinessStatusSchema.parse(source.status), datasets: names, totals,
    issues: issues.map(issue => ({ ...issue, explanation: "", suggestedInvestigation: "" })),
    importOrder: z.array(label).max(5).parse(source.importOrder),
    cycleGroups: z.array(z.array(label).min(1).max(5)).max(5).parse(source.cycleGroups).map(group => group.sort(cmp)).sort((a, b) => cmp(JSON.stringify(a), JSON.stringify(b))),
    assumptions: [],
  };
  const analytics: ReportAnalytics = {
    status: aiReadinessStatusSchema.parse(supplied.status),
    summary: z.object({ totalDatasets: count, totalRecords: count, validRows: count.nullable(), invalidRows: count.nullable(), blockingErrors: count, warnings: count, totalIssues: count }).strict().parse(supplied.summary),
    datasets: supplied.datasets.map(metric => metricsSchema.parse({ dataset: metric.dataset, totalRows: metric.totalRows, validRows: metric.validRows, invalidRows: metric.invalidRows, blockingErrors: metric.blockingErrors, warnings: metric.warnings, issueCount: metric.issueCount })).sort((a, b) => cmp(a.dataset, b.dataset)),
    issueDistribution: supplied.issueDistribution.map(item => z.object({ code: aiIssueCodeSchema, category: issueSchema.shape.category, severity: issueSchema.shape.severity, count }).strict().parse(item)),
    unassignedIssues: count.parse(supplied.unassignedIssues), readinessExplanation: "",
  };
  prepareReportExport(report, analytics, "json");
  if (!toValidationRunSummary(report)) throw new AiError("INVALID_CONTEXT");
  if (new Set(analytics.datasets.map(dataset => dataset.dataset)).size !== names.length) throw new AiError("INVALID_CONTEXT");
  const configuration = input.configuration === null ? null : templateConfigurationSchema.parse(input.configuration);
  if (!configuration && report.status !== "CONFIG_ERROR") throw new AiError("INVALID_CONTEXT");
  if (configuration && JSON.stringify(configuration.datasets.map(dataset => dataset.name).sort(cmp)) !== JSON.stringify(names)) throw new AiError("INVALID_CONTEXT");
  checkReferencesAndMetrics(report, analytics);
  return { report, analytics, configuration };
}

const rowKey = (dataset: string, line: number) => JSON.stringify([dataset, line]);
function rowsFor(issues: readonly RehearsalIssue[], errorsOnly = false): Set<string> {
  return new Set(issues.filter(issue => issue.category === "DATA" && issue.rowNumber !== null && (!errorsOnly || issue.severity === "ERROR")).map(issue => rowKey(issue.dataset, issue.rowNumber!)));
}
function checkReferencesAndMetrics(report: RehearsalReportV1, analytics: ReportAnalytics) {
  const ids = new Set(report.issues.map(issue => issue.id));
  const locations = new Set(report.issues.filter(issue => issue.rowNumber !== null).map(issue => JSON.stringify([issue.dataset, issue.rowNumber, issue.column])));
  const known = new Set(report.datasets), configError = report.status === "CONFIG_ERROR";
  for (const issue of report.issues) {
    if ((issue.category === "DATA" && (issue.rowNumber === null || !known.has(issue.dataset))) ||
      (issue.category !== "DATA" && issue.rowNumber !== null) ||
      new Set(issue.relatedIssueIds).size !== issue.relatedIssueIds.length ||
      issue.relatedIssueIds.some(id => id === issue.id || !ids.has(id)) ||
      issue.referencedRecords.some(reference => !locations.has(JSON.stringify([reference.dataset, reference.rowNumber, reference.column])))) throw new AiError("INVALID_CONTEXT");
  }
  for (const metric of analytics.datasets) {
    const issues = report.issues.filter(issue => issue.dataset === metric.dataset);
    const invalid = rowsFor(issues, true).size;
    if (metric.issueCount !== issues.length || metric.blockingErrors !== issues.filter(issue => issue.severity === "ERROR").length || metric.warnings !== issues.filter(issue => issue.severity === "WARNING").length ||
      rowsFor(issues).size > metric.totalRows ||
      (configError ? metric.validRows !== null || metric.invalidRows !== null : metric.invalidRows !== invalid || metric.validRows !== metric.totalRows - invalid)) throw new AiError("INVALID_CONTEXT");
  }
  if ((!configError && rowsFor(report.issues, true).size !== report.totals.invalidRows) ||
    analytics.unassignedIssues !== report.issues.filter(issue => !known.has(issue.dataset)).length) throw new AiError("INVALID_CONTEXT");
  const distribution = (items: readonly { code: string; category: string; severity: string; count: number }[]) => items.map(item => JSON.stringify([item.code, item.category, item.severity, item.count])).sort(cmp);
  const groups = new Map<string, { code: RehearsalIssue["code"]; category: RehearsalIssue["category"]; severity: RehearsalIssue["severity"]; count: number }>();
  for (const issue of report.issues) { const key = JSON.stringify([issue.code, issue.category, issue.severity]); const group = groups.get(key); if (group) group.count++; else groups.set(key, { code: issue.code, category: issue.category, severity: issue.severity, count: 1 }); }
  if (JSON.stringify(distribution([...groups.values()])) !== JSON.stringify(distribution(analytics.issueDistribution))) throw new AiError("INVALID_CONTEXT");
  for (const group of report.cycleGroups) if (new Set(group).size !== group.length || group.some(name => !known.has(name))) throw new AiError("INVALID_CONTEXT");
}

function buildEvidence(input: ImpactReportInput, version: AiVersion) {
  const { report, analytics, configuration } = checkedInput(input), evaluated = report.status !== "CONFIG_ERROR";
  const datasetIds = new Map(report.datasets.map((name, index) => [name, `d${index}`]));
  const datasetId = (name: string) => { const id = datasetIds.get(name); if (!id) throw new AiError("INVALID_CONTEXT"); return id; };
  const issueIds = new Map(report.issues.map((issue, index) => [issue.id, `i${index}`]));
  const ruleIds = new Map([...new Set(report.issues.map(issue => issue.ruleId))].sort(cmp).map((rule, index) => [rule, `r${index}`]));
  const declarations = configuration ? [...configuration.relationships, ...configuration.compositeRelationships].map(relation => ({
    childDataset: relation.childDataset.trim(), parentDataset: relation.parentDataset.trim(),
    childColumns: ("childColumns" in relation ? [...relation.childColumns] : [relation.childColumn]).map(column => column.trim()),
    parentColumns: ("parentColumns" in relation ? [...relation.parentColumns] : [relation.parentColumn]).map(column => column.trim()),
  })) : [];
  const relationKey = (relation: typeof declarations[number], prefix = "fk-v1") => JSON.stringify([prefix, relation.childDataset, relation.childColumns, relation.parentDataset, relation.parentColumns]);
  declarations.sort((a, b) => cmp(relationKey(a), relationKey(b)));
  const columns = new Set(report.issues.filter(issue => issue.column !== null).map(issue => JSON.stringify([issue.dataset, issue.column])));
  for (const relation of declarations) {
    relation.childColumns.forEach(column => columns.add(JSON.stringify([relation.childDataset, column])));
    relation.parentColumns.forEach(column => columns.add(JSON.stringify([relation.parentDataset, column])));
  }
  const columnIds = new Map([...columns].sort(cmp).map((key, index) => [key, `c${index}`]));
  const columnId = (dataset: string, column: string) => columnIds.get(JSON.stringify([dataset, column]))!;
  const insights = buildReadinessInsights(report, declarations);
  const graph = configuration ? analyzeDependencyGraph(report.datasets, declarations) : null;
  if (graph && (JSON.stringify(graph.importOrder) !== JSON.stringify(report.importOrder) || JSON.stringify(graph.cycleGroups) !== JSON.stringify(report.cycleGroups))) throw new AiError("INVALID_CONTEXT");
  const verifiedGraph = Boolean(graph && evaluated && !graph.issues.some(issue => issue.category === "SCHEMA" && issue.severity === "ERROR"));
  const relationships = declarations.map((relation, index) => ({
    id: `f${index}`, parentId: datasetId(relation.parentDataset), childId: datasetId(relation.childDataset),
    parentColumnIds: relation.parentColumns.map(column => columnId(relation.parentDataset, column)), childColumnIds: relation.childColumns.map(column => columnId(relation.childDataset, column)),
    evidence: verifiedGraph ? "VERIFIED_DEPENDENCY" as const : "CONFIGURATION_ONLY" as const,
  }));
  function relationshipIds(rule: string): string[] {
    let identity = rule;
    try { const parsed: unknown = JSON.parse(rule); if (Array.isArray(parsed) && typeof parsed[0] === "string" && parsed[0].startsWith("[")) identity = parsed[0]; } catch { /* An opaque rule need not have an FK identity. */ }
    return declarations.flatMap((relation, index) => [relationKey(relation), relationKey(relation, "graph-fk-v1")].includes(identity) ? [`f${index}`] : []);
  }
  const actionKey = (value: { code: string; category: string; severity: string }) => JSON.stringify([value.code, value.category, value.severity]);
  const actionIds = new Map(insights.actions.map((action, index) => [actionKey(action), `a${index}`]));
  const edges = verifiedGraph ? insights.dependency.edges.map(edge => ({
    parentId: datasetId(edge.parentDataset), childId: datasetId(edge.childDataset),
    relationshipIds: relationships.filter(relation => relation.parentId === datasetId(edge.parentDataset) && relation.childId === datasetId(edge.childDataset)).map(relation => relation.id),
  })) : [];
  const potentialDownstream = verifiedGraph ? report.datasets.flatMap(name => {
    const sourceId = datasetId(name), reached = new Set([sourceId]), queue = [sourceId];
    for (let index = 0; index < queue.length; index++) for (const edge of edges) if (edge.parentId === queue[index] && !reached.has(edge.childId)) { reached.add(edge.childId); queue.push(edge.childId); }
    reached.delete(sourceId);
    return reached.size ? [{ sourceId, datasetIds: [...reached].sort(cmp), affectedRecords: null, evidence: "CONFIGURED_DEPENDENCY_ONLY" as const }] : [];
  }) : [];
  const data = impactEvidenceSchema.parse({
    schemaVersion: 1, source: "LIVE_REPORT", version,
    report: { ...report.totals, status: report.status, rowValidity: evaluated ? "EVALUATED" : "UNEVALUATED", issueCount: report.issues.length, affectedRecords: evaluated ? rowsFor(report.issues).size : null },
    datasets: analytics.datasets.map(metric => ({ id: datasetId(metric.dataset), totalRows: metric.totalRows, validRows: metric.validRows, invalidRows: metric.invalidRows, errors: metric.blockingErrors, warnings: metric.warnings, issueCount: metric.issueCount, affectedRecords: evaluated ? rowsFor(report.issues.filter(issue => issue.dataset === metric.dataset)).size : null })),
    issues: report.issues.map(issue => ({
      id: issueIds.get(issue.id)!, code: issue.code, severity: issue.severity, category: issue.category,
      datasetId: datasetIds.get(issue.dataset) ?? null, columnId: issue.column === null ? null : columnId(issue.dataset, issue.column), ruleId: ruleIds.get(issue.ruleId)!,
      relationshipIds: relationshipIds(issue.ruleId), relatedIssueIds: issue.relatedIssueIds.map(id => issueIds.get(id)!).sort(cmp), actionId: actionIds.get(actionKey(issue))!,
    })),
    actions: insights.actions.map(action => ({ id: actionIds.get(actionKey(action))!, code: action.code, severity: action.severity, category: action.category, count: action.count, datasetIds: action.datasets.map(datasetId), affectedRecords: evaluated && action.category === "DATA" ? action.affectedRows : null })),
    relationships,
    dependency: {
      evidence: verifiedGraph ? "VERIFIED" : "UNAVAILABLE", orderKind: verifiedGraph ? insights.dependency.orderKind : "UNAVAILABLE", edges,
      importOrder: verifiedGraph ? insights.dependency.importOrder.map(datasetId) : [], cycleGroups: report.cycleGroups.map(group => group.map(datasetId)),
      blockedByCycles: verifiedGraph ? insights.dependency.blockedByCycles.map(datasetId) : [], unresolvedDatasets: verifiedGraph ? insights.dependency.unresolvedDatasets.map(datasetId) : report.datasets.map(datasetId),
    }, potentialDownstream,
  });
  return { data,
    locations: new Map(report.issues.map(issue => [issueIds.get(issue.id)!, { id: issue.id, dataset: issue.dataset, rowNumber: issue.rowNumber, column: issue.column }])),
    datasetLabels: new Map([...datasetIds].map(([name, id]) => [id, name])),
    relationshipLabels: new Map(declarations.map((relation, index) => [`f${index}`, { ...relation, parentColumns: [...relation.parentColumns], childColumns: [...relation.childColumns] }])),
  };
}

/** Library owner only: the workspace must invalidate at real state transitions before future UI integration. */
export function createImpactEvidenceOwner() {
  let version = createAiVersion();
  const isCurrent = (candidate: AiVersion) => { const parsed = aiVersionSchema.safeParse(candidate); return parsed.success && sameAiVersion(version, parsed.data); };
  return {
    getVersion: () => version,
    isCurrent,
    invalidate(change: "session" | "configuration" | "corrections" | "report") {
      try { version = advanceAiVersion(version, change); return version; }
      catch { throw new AiError("INVALID_CONTEXT"); }
    },
    captureReport(input: ImpactReportInput): ImpactEvidence {
      try {
        if (!isCurrent(input.expectedVersion)) throw new AiError("STALE");
        const next = advanceAiVersion(version, "report"), prepared = buildEvidence(input, next);
        version = next;
        const context = Object.freeze({ version, issueCount: prepared.data.report.issueCount }) as ImpactEvidence;
        entries.set(context, { ...prepared, isCurrent: () => isCurrent(next) });
        return context;
      } catch (error) { throw error instanceof AiError ? error : new AiError("INVALID_CONTEXT"); }
    },
  };
}
function entryFor(context: ImpactEvidence): Entry {
  const entry = entries.get(context);
  if (!entry) throw new AiError("INVALID_CONTEXT");
  if (!entry.isCurrent()) throw new AiError("STALE");
  return entry;
}
export function readImpactEvidence(context: ImpactEvidence): ImpactEvidenceData { return structuredClone(entryFor(context).data); }
export function assertImpactEvidenceCurrent(context: ImpactEvidence): void { entryFor(context); }
export function serializeImpactEvidence(context: ImpactEvidence): string {
  const json = JSON.stringify(entryFor(context).data);
  if (new TextEncoder().encode(json).byteLength > AI_MAX_CONTEXT_BYTES) throw new AiError("CONTEXT_TOO_LARGE");
  return json;
}
/** Browser-local resolution only. Do not pass this lookup to a model or persist it. */
export function resolveImpactIssue(context: ImpactEvidence, id: string): ImpactIssueLocation | null { return structuredClone(entryFor(context).locations.get(id) ?? null); }
export function resolveImpactDataset(context: ImpactEvidence, id: string): string | null { return entryFor(context).datasetLabels.get(id) ?? null; }
export function resolveImpactRelationship(context: ImpactEvidence, id: string): ImpactRelationshipLocation | null { return structuredClone(entryFor(context).relationshipLabels.get(id) ?? null); }
export function resolveImpactAction(context: ImpactEvidence, id: string): string | null {
  const action = entryFor(context).data.actions.find(action => action.id === id);
  return action ? reportInvestigationForCode(action.code) : null;
}
