import { z } from "zod";
import { aiCounterSchema as count, AiError } from "../contracts";
import { impactEvidenceSchema } from "../impact-evidence-contracts";
import { schemaMappingWireResponseSchema } from "../schema-mapping";
import { rootCauseResponseSchema } from "../root-cause";
import { smartRepairRecommendationSchema, smartRepairWireContextSchema } from "../smart-repair-contracts";

const type = z.enum(["string", "integer", "number", "boolean", "date", "email"]);
const sourceId = z.string().regex(/^c\d{1,2}$/), targetId = z.string().regex(/^t\d{1,2}$/);
const label = z.string().min(1).max(128);
const formatCounts = z.object({ valid: count, invalid: count }).strict();
/** Exact projections of existing serializers. No arbitrary prompt, schema, records, values or history. */
export const schemaMappingMetadataSchema = z.object({
  schemaVersion: z.literal(1), baselineAvailable: z.boolean(), previousColumns: z.array(label).max(16),
  columns: z.array(z.object({
    id: sourceId, name: label, currentTarget: targetId,
    configuredType: type.nullable(), configuredRequired: z.boolean(), configuredPrimary: z.boolean(),
    allowedTargets: z.array(targetId).min(1).max(48), allowedKeys: z.array(z.enum(["primary", "unique"])).max(2),
    profile: z.object({ inferredType: type.nullable(), nonEmpty: count, empty: count,
      duplicateRows: count, leadingZeros: count, unsafeIntegers: count,
      formatHints: z.object({ email: formatCounts.optional(), date: formatCounts.optional() }).strict(),
    }).strict().nullable(),
  }).strict()).min(1).max(16),
  targets: z.array(z.object({ id: targetId, name: label, template: z.boolean(), type: type.nullable(),
    required: z.boolean().nullable(), primary: z.boolean().nullable() }).strict()).min(1).max(48),
}).strict();
const impact = impactEvidenceSchema.shape;
export const rootCauseMetadataSchema = z.object({
  schemaVersion: z.literal(1),
  scope: z.object({ complete: z.boolean(), selectedIssueIds: z.array(impact.issues.element.shape.id).max(8), totalIssueCount: count }).strict(),
  report: impact.report,
  datasets: z.array(impact.datasets.element.pick({ id: true }).strict()).min(1).max(5),
  issues: z.array(impact.issues.element).max(8),
  actions: z.array(impact.actions.element.pick({ id: true, code: true }).strict()).max(8),
  relationships: z.array(impact.relationships.element.pick({ id: true, parentId: true, childId: true, evidence: true }).strict()).max(200),
  dependency: impact.dependency, potentialDownstream: impact.potentialDownstream,
}).strict();
export const hostedRequestSchema = z.discriminatedUnion("feature", [
  z.object({ feature: z.literal("schema-mapping"), consent: z.literal(true), metadata: schemaMappingMetadataSchema }).strict(),
  z.object({ feature: z.literal("root-cause"), consent: z.literal(true), metadata: rootCauseMetadataSchema }).strict(),
  z.object({ feature: z.literal("smart-repair"), consent: z.literal(true), metadata: smartRepairWireContextSchema }).strict(),
]);
export type HostedRequest = z.infer<typeof hostedRequestSchema>;
export type AiFeature = HostedRequest["feature"];

export function parseHostedRequest(value: unknown): HostedRequest {
  const parsed = hostedRequestSchema.safeParse(value);
  if (!parsed.success) throw new AiError("INVALID_CONTEXT");
  const request = parsed.data;
  // Keep each feature's original context budget, independently of the HTTP envelope limit.
  if (new TextEncoder().encode(JSON.stringify(request.metadata)).byteLength > (request.feature === "schema-mapping" ? 6144 : 2048)) {
    throw new AiError("CONTEXT_TOO_LARGE");
  }
  return request;
}

/** Shared response contracts; browser capability/semantic validators still run before any advice is accepted. */
export function hostedResponseSchema(request: HostedRequest) {
  if (request.feature === "schema-mapping") return schemaMappingWireResponseSchema;
  if (request.feature === "root-cause") return rootCauseResponseSchema;
  return smartRepairRecommendationSchema;
}
export function validateHostedResponse(request: HostedRequest, value: unknown): unknown {
  const parsed = hostedResponseSchema(request).safeParse(value);
  if (!parsed.success) throw new AiError("INVALID_RESPONSE", "OUTPUT_SCHEMA");
  if (request.feature === "schema-mapping") {
    const result = schemaMappingWireResponseSchema.parse(parsed.data), seen = new Set<string>(), targets = new Set<string>();
    for (const suggestion of result.suggestions) {
      const column = request.metadata.columns.find(column => column.id === suggestion.sourceId);
      const target = request.metadata.targets.find(target => target.id === suggestion.targetId);
      if (!column || (suggestion.targetId !== null && (!target || !column.allowedTargets.includes(suggestion.targetId)))) throw new AiError("INVALID_RESPONSE", "UNKNOWN_REFERENCE");
      if (seen.has(suggestion.sourceId) || suggestion.targetId !== null && targets.has(suggestion.targetId)) throw new AiError("INVALID_RESPONSE", "DUPLICATE_REFERENCE");
      if (suggestion.reason === "template_match" && (!request.metadata.baselineAvailable || !target?.template)) throw new AiError("INVALID_RESPONSE", "TEMPLATE_EVIDENCE");
      if (suggestion.key !== "none" && !column.allowedKeys.includes(suggestion.key)) throw new AiError("INVALID_RESPONSE", "UNSUPPORTED_CLAIM");
      seen.add(suggestion.sourceId); if (suggestion.targetId !== null) targets.add(suggestion.targetId);
    }
    return result;
  }
  if (request.feature === "root-cause") {
    const result = rootCauseResponseSchema.parse(parsed.data), seen = new Set<string>();
    for (const explanation of result.explanations) for (const id of explanation.issueIds) {
      if (!request.metadata.scope.selectedIssueIds.includes(id) || !request.metadata.issues.some(issue => issue.id === id)) throw new AiError("INVALID_RESPONSE", "UNKNOWN_EVIDENCE");
      if (seen.has(id)) throw new AiError("INVALID_RESPONSE", "DUPLICATE_EVIDENCE");
      seen.add(id);
    }
    return result;
  }
  const result = smartRepairRecommendationSchema.parse(parsed.data), wire = request.metadata;
  if (result.requestId !== wire.requestId || Object.entries(wire.target).some(([key, value]) => result.target[key as keyof typeof result.target] !== value)) throw new AiError("INVALID_RESPONSE", "UNKNOWN_EVIDENCE");
  const supported = result.outcome === "ACTIONABLE_CANDIDATE" ? wire.allowedStrategies.includes(result.strategyId)
    : result.outcome === "REQUIRES_USER_INPUT" ? wire.inputRequests.includes(result.input)
    : result.outcome === "GUIDANCE_ONLY" ? wire.guidanceOptions.includes(result.guidance) : wire.unsupportedReasons.includes(result.reason);
  if (!supported) throw new AiError("INVALID_RESPONSE", "UNSUPPORTED_CLAIM");
  return result;
}
