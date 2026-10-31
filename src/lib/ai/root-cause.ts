import { z } from "zod";
import { AI_MAX_CONTEXT_BYTES, AiError, type AiVersion } from "./contracts";
import { impactIssueIdSchema, type ImpactEvidenceData } from "./impact-evidence-contracts";
import { assertImpactEvidenceCurrent, readImpactEvidence, type ImpactEvidence } from "./impact-evidence";
import { reportInvestigationForCode } from "../reports/export";

const causeSchema = z.enum(["KEY_REVIEW", "VALUE_OR_RULE_REVIEW", "REFERENCE_REVIEW", "CONFIGURATION_REVIEW", "CYCLE_REVIEW"]);
const investigationSchema = z.enum(["REVIEW_KEY_RECORDS", "REVIEW_KEY_DECLARATION", "CHECK_SOURCE_FORMAT", "REVIEW_FIELD_RULE", "CHECK_PARENT_AND_MAPPING", "REVIEW_CONFIGURATION", "REVIEW_RELATIONSHIPS"]);
const uncertaintySchema = z.enum(["EVIDENCE_LIMITED", "ROW_VALIDITY_UNEVALUATED"]);
const explanationSchema = z.object({
  issueIds: z.array(impactIssueIdSchema).min(1).max(4), cause: causeSchema,
  investigation: investigationSchema, includePotentialImpact: z.boolean(), uncertainty: uncertaintySchema,
}).strict();
export const rootCauseResponseSchema = z.object({
  schemaVersion: z.literal(1), abstained: z.boolean(), explanations: z.array(explanationSchema).max(3),
}).strict().superRefine((value, ctx) => {
  if (value.abstained !== (value.explanations.length === 0)) ctx.addIssue({ code: "custom", message: "Invalid abstention" });
});
export type RootCauseResponse = z.infer<typeof rootCauseResponseSchema>;
type Cause = z.infer<typeof causeSchema>;
type Issue = ImpactEvidenceData["issues"][number];
const investigations: Record<Cause, z.infer<typeof investigationSchema>[]> = {
  KEY_REVIEW: ["REVIEW_KEY_RECORDS", "REVIEW_KEY_DECLARATION"],
  VALUE_OR_RULE_REVIEW: ["CHECK_SOURCE_FORMAT", "REVIEW_FIELD_RULE"],
  REFERENCE_REVIEW: ["CHECK_PARENT_AND_MAPPING"], CONFIGURATION_REVIEW: ["REVIEW_CONFIGURATION"], CYCLE_REVIEW: ["REVIEW_RELATIONSHIPS"],
};
const causeText: Record<Cause, string> = {
  KEY_REVIEW: "Repeated source identifiers or an unsuitable key declaration may explain these key conflicts. Check the linked records and intended key.",
  VALUE_OR_RULE_REVIEW: "Missing values, source formatting or a field-rule/mapping mismatch may explain these findings. The evidence does not establish which cause applies.",
  REFERENCE_REVIEW: "Missing parent keys, a mapping mismatch or differing source identifiers may explain the unresolved references. No particular missing parent record has been identified.",
  CONFIGURATION_REVIEW: "A schema, rule or relationship declaration needs review. The findings do not establish whether the source data or the intended configuration should change.",
  CYCLE_REVIEW: "The report identifies a cycle among configured datasets. Review the intended relationships; target-specific execution behavior has not been tested.",
};
const investigationText: Record<z.infer<typeof investigationSchema>, string> = {
  REVIEW_KEY_RECORDS: "Inspect the existing duplicate-key findings and their referenced records before deciding which values are correct.",
  REVIEW_KEY_DECLARATION: "Confirm that the declared primary or unique key represents the intended record identity.",
  CHECK_SOURCE_FORMAT: "Inspect the source locations for missing values or formatting differences; do not assume automatic conversion is safe.",
  REVIEW_FIELD_RULE: "Compare the mapping, required-field declaration and configured type with the intended schema.",
  CHECK_PARENT_AND_MAPPING: "Check the parent CSV and both sides of the declared foreign key. Revalidate after any approved change.",
  REVIEW_CONFIGURATION: "Open the existing configuration findings and correct the cited declarations before relying on row validity.",
  REVIEW_RELATIONSHIPS: "Review the cycle's declared relationships. Any staged load or constraint deferral requires separate database-specific review.",
};

declare const rootCauseBrand: unique symbol;
export type RootCauseContext = Readonly<{ version: AiVersion; [rootCauseBrand]: true }>;
type Entry = { evidence: ImpactEvidence; data: ImpactEvidenceData; issueIds: Set<string>; json: string; complete: boolean };
const contexts = new WeakMap<object, Entry>();

function supports(cause: Cause, issue: Issue): boolean {
  if (cause === "KEY_REVIEW") return issue.category === "DATA" && ["DUPLICATE_PK", "DUPLICATE_UNIQUE"].includes(issue.code);
  if (cause === "VALUE_OR_RULE_REVIEW") return issue.category === "DATA" && ["REQUIRED", "INVALID_TYPE"].includes(issue.code);
  if (cause === "REFERENCE_REVIEW") return issue.category === "DATA" && issue.code === "FK_NOT_FOUND";
  if (cause === "CONFIGURATION_REVIEW") return issue.category === "SCHEMA";
  return issue.category === "DEPENDENCY" && issue.code === "DEPENDENCY_CYCLE";
}
function potentialFor(data: ImpactEvidenceData, issues: readonly Issue[]) {
  if (data.report.rowValidity !== "EVALUATED" || data.dependency.evidence !== "VERIFIED") return [];
  const sources = new Set(issues.map(issue => issue.datasetId));
  return data.potentialDownstream.filter(impact => sources.has(impact.sourceId));
}
function entryFor(context: RootCauseContext): Entry {
  const entry = contexts.get(context);
  if (!entry) throw new AiError("INVALID_CONTEXT");
  assertImpactEvidenceCurrent(entry.evidence);
  return entry;
}

/** Projection of Step 2 facts only. Explicit focus never pretends to cover omitted findings. */
export function buildRootCauseContext(evidence: ImpactEvidence, focusIssueIds?: readonly string[]): RootCauseContext {
  const data = readImpactEvidence(evidence);
  const selected = focusIssueIds === undefined ? data.issues.map(issue => issue.id) : [...focusIssueIds];
  if (selected.length > 8) throw new AiError("CONTEXT_TOO_LARGE");
  if (new Set(selected).size !== selected.length || selected.some(id => !data.issues.some(issue => issue.id === id)) || (data.issues.length > 0 && !selected.length)) throw new AiError("INVALID_CONTEXT");
  const issueIds = new Set(selected), issues = data.issues.filter(issue => issueIds.has(issue.id));
  const complete = selected.length === data.issues.length;
  const json = JSON.stringify({
    schemaVersion: data.schemaVersion,
    scope: { complete, selectedIssueIds: issues.map(issue => issue.id), totalIssueCount: data.report.issueCount },
    report: data.report,
    datasets: data.datasets.map(dataset => ({ id: dataset.id })),
    issues: issues.map(issue => ({ ...issue, relatedIssueIds: issue.relatedIssueIds.filter(id => issueIds.has(id)) })),
    actions: data.actions.filter(action => issues.some(issue => issue.actionId === action.id)).map(action => ({ id: action.id, code: action.code })),
    relationships: data.relationships.map(relation => ({ id: relation.id, parentId: relation.parentId, childId: relation.childId, evidence: relation.evidence })),
    dependency: data.dependency, potentialDownstream: data.potentialDownstream,
  });
  if (new TextEncoder().encode(json).byteLength > AI_MAX_CONTEXT_BYTES) throw new AiError("CONTEXT_TOO_LARGE");
  const context = Object.freeze({ version: evidence.version }) as RootCauseContext;
  contexts.set(context, { evidence, data, issueIds, json, complete });
  return context;
}
export function serializeRootCauseContext(context: RootCauseContext): string { return entryFor(context).json; }
export function assertRootCauseCurrent(context: RootCauseContext): void { entryFor(context); }

/** Constrain generation as well as validation; grammar restrictions are not a grounding proof. */
export function rootCauseOutputFormat(context: RootCauseContext) {
  const entry = entryFor(context);
  const branches = causeSchema.options.flatMap(cause => {
    const issues = entry.data.issues.filter(issue => entry.issueIds.has(issue.id) && supports(cause, issue) && !(entry.data.report.rowValidity === "UNEVALUATED" && issue.category === "DATA"));
    if (!issues.length) return [];
    return [explanationSchema.extend({
      cause: z.literal(cause), issueIds: z.array(z.enum(issues.map(issue => issue.id) as [string, ...string[]])).min(1).max(Math.min(4, issues.length)),
      investigation: z.enum(investigations[cause] as [z.infer<typeof investigationSchema>, ...z.infer<typeof investigationSchema>[]]),
      includePotentialImpact: potentialFor(entry.data, issues).length ? z.boolean() : z.literal(false),
      uncertainty: z.literal(entry.data.report.rowValidity === "UNEVALUATED" ? "ROW_VALIDITY_UNEVALUATED" : "EVIDENCE_LIMITED"),
    })];
  });
  const item = branches.length === 0 ? explanationSchema : branches.length === 1 ? branches[0] : z.union(branches);
  return z.toJSONSchema(z.object({ schemaVersion: z.literal(1), abstained: branches.length ? z.boolean() : z.literal(true), explanations: z.array(item).max(branches.length ? 3 : 0) }).strict());
}
export function validateRootCauseResponse(context: RootCauseContext, value: unknown): RootCauseResponse {
  const entry = entryFor(context), parsed = rootCauseResponseSchema.safeParse(value);
  if (!parsed.success) throw new AiError("INVALID_RESPONSE", "OUTPUT_SCHEMA");
  const seen = new Set<string>();
  for (const explanation of parsed.data.explanations) {
    if (explanation.issueIds.some(id => !entry.issueIds.has(id))) throw new AiError("INVALID_RESPONSE", "UNKNOWN_EVIDENCE");
    for (const id of explanation.issueIds) { if (seen.has(id)) throw new AiError("INVALID_RESPONSE", "DUPLICATE_EVIDENCE"); seen.add(id); }
    const issues = explanation.issueIds.map(id => entry.data.issues.find(issue => issue.id === id)!);
    const unevaluated = entry.data.report.rowValidity === "UNEVALUATED";
    if (issues.some(issue => !supports(explanation.cause, issue) || (unevaluated && issue.category === "DATA")) ||
      !investigations[explanation.cause].includes(explanation.investigation) ||
      explanation.uncertainty !== (unevaluated ? "ROW_VALIDITY_UNEVALUATED" : "EVIDENCE_LIMITED") ||
      (explanation.includePotentialImpact && !potentialFor(entry.data, issues).length)) throw new AiError("INVALID_RESPONSE", "UNSUPPORTED_CLAIM");
  }
  return structuredClone(parsed.data);
}

/** Application-owned explanation text, verified facts and nullable potential impact; no model prose. */
export function explainRootCauses(context: RootCauseContext, response: RootCauseResponse) {
  const checked = validateRootCauseResponse(context, response), entry = entryFor(context);
  return structuredClone({
    scope: { complete: entry.complete, selectedIssueIds: [...entry.issueIds].sort(), totalIssueCount: entry.data.report.issueCount },
    verifiedReport: entry.data.report, abstained: checked.abstained,
    explanations: checked.explanations.map(explanation => {
      const issues = explanation.issueIds.map(id => entry.data.issues.find(issue => issue.id === id)!);
      return {
        possibleCause: causeText[explanation.cause], supportingFindings: issues,
        potentialDownstream: explanation.includePotentialImpact ? potentialFor(entry.data, issues) : [],
        investigationSteps: [...new Set([investigationText[explanation.investigation], ...issues.map(issue => reportInvestigationForCode(issue.code))])],
        uncertainty: (entry.complete ? "" : "Only selected findings were analyzed; omitted findings may change the interpretation. ") + (explanation.uncertainty === "ROW_VALIDITY_UNEVALUATED" ? "Configuration errors prevent row validity assessment. No affected-row or downstream-record estimate is available." : "The findings support investigation, not a proven root cause or a verified database migration outcome. Potential downstream datasets do not establish affected records."),
      };
    }),
  });
}
