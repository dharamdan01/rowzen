import { z } from "zod";
import { aiCounterSchema, aiIssueCodeSchema, aiReadinessStatusSchema, aiVersionSchema } from "./contracts";

export const SMART_REPAIR_STRATEGIES = Object.freeze([
  "BOOLEAN_FROM_CONFIRMED_CONVENTION",
  "DATE_FROM_CONFIRMED_FORMAT",
] as const);
export const smartRepairStrategySchema = z.enum(SMART_REPAIR_STRATEGIES);
export type SmartRepairStrategy = z.infer<typeof smartRepairStrategySchema>;

/** Supplied by the browser's consent/intent owner, never by a model response. */
export const smartRepairIntentSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("UNCONFIRMED") }).strict(),
  z.object({ kind: z.literal("AMBIGUOUS") }).strict(),
  z.object({ kind: z.literal("CONFIRMED_BOOLEAN"), convention: z.enum(["YES_NO", "ONE_ZERO"]) }).strict(),
  z.object({ kind: z.literal("CONFIRMED_DATE"), format: z.enum(["YYYY/MM/DD", "YYYY-M-D"]) }).strict(),
]);
export type SmartRepairIntent = z.infer<typeof smartRepairIntentSchema>;

const alias = (prefix: string) => z.string().regex(new RegExp(`^${prefix}\\d{1,5}$`));
export const smartRepairCellTargetSchema = z.object({
  issueId: alias("i"), datasetId: alias("d"), rowId: alias("r"), columnId: alias("c"),
}).strict();
export const smartRepairTargetSchema = smartRepairCellTargetSchema.extend({
  datasetId: alias("d").nullable(), rowId: alias("r").nullable(), columnId: alias("c").nullable(),
}).strict();
export type SmartRepairTarget = z.infer<typeof smartRepairTargetSchema>;

export const smartRepairInputRequestSchema = z.enum([
  "CONFIRM_BOOLEAN_CONVENTION", "CONFIRM_DATE_FORMAT", "PROVIDE_REPLACEMENT",
]);
export const smartRepairGuidanceSchema = z.enum([
  "REVIEW_KEY_RECORDS", "REVIEW_REFERENCE", "REVIEW_CONFIGURATION", "REVIEW_DEPENDENCIES",
]);
export const smartRepairUnsupportedReasonSchema = z.enum([
  "UNSUPPORTED_TRANSFORMATION", "INSUFFICIENT_EVIDENCE", "AMBIGUOUS_INTENT", "ROW_VALIDITY_UNEVALUATED",
]);

const envelope = { schemaVersion: z.literal(1), requestId: z.uuid(), target: smartRepairTargetSchema };
/** One recommendation only; no values, operations, prose, intent confirmation or verification fields. */
export const smartRepairRecommendationSchema = z.discriminatedUnion("outcome", [
  z.object({ ...envelope, target: smartRepairCellTargetSchema,
    outcome: z.literal("ACTIONABLE_CANDIDATE"), strategyId: smartRepairStrategySchema }).strict(),
  z.object({ ...envelope, outcome: z.literal("REQUIRES_USER_INPUT"), input: smartRepairInputRequestSchema }).strict(),
  z.object({ ...envelope, outcome: z.literal("GUIDANCE_ONLY"), guidance: smartRepairGuidanceSchema }).strict(),
  z.object({ ...envelope, outcome: z.literal("UNSUPPORTED_OR_INSUFFICIENT_EVIDENCE"), reason: smartRepairUnsupportedReasonSchema }).strict(),
]);
export type SmartRepairRecommendation = z.infer<typeof smartRepairRecommendationSchema>;

export const smartRepairWireContextSchema = z.object({
  ...envelope,
  issue: z.object({ code: aiIssueCodeSchema, category: z.enum(["DATA", "SCHEMA", "DEPENDENCY"]),
    severity: z.enum(["ERROR", "WARNING"]), rowValidity: z.enum(["EVALUATED", "UNEVALUATED"]),
    configuredType: z.enum(["string", "integer", "number", "boolean", "date", "email"]).nullable() }).strict(),
  evidence: z.object({ reportStatus: aiReadinessStatusSchema, totalIssues: aiCounterSchema,
    matchingIssues: aiCounterSchema.min(1), errors: aiCounterSchema, warnings: aiCounterSchema }).strict(),
  allowedStrategies: z.array(smartRepairStrategySchema).max(1),
  inputRequests: z.array(smartRepairInputRequestSchema).max(1),
  guidanceOptions: z.array(smartRepairGuidanceSchema).max(1),
  unsupportedReasons: z.array(smartRepairUnsupportedReasonSchema).min(1).max(4),
}).strict();
export type SmartRepairWireContext = z.infer<typeof smartRepairWireContextSchema>;

export const smartRepairRevisionsSchema = z.object({
  version: aiVersionSchema, workspaceRevision: aiCounterSchema,
}).strict();

const verificationBinding = {
  schemaVersion: z.literal(1), source: z.literal("DETERMINISTIC_PREFLIGHT"),
  candidateId: z.uuid(), revisions: smartRepairRevisionsSchema, target: smartRepairCellTargetSchema,
};
/** Structural result shape; the local verifier mints a separate capability. Parsing is not verification or approval. */
export const smartRepairVerificationResultSchema = z.discriminatedUnion("outcome", [
  z.object({ ...verificationBinding, outcome: z.literal("NOT_RUN") }).strict(),
  z.object({ ...verificationBinding, outcome: z.literal("REJECTED"), reason: z.enum([
    "STALE", "NO_CHANGE", "TARGET_NOT_RESOLVED", "INTRODUCED_FINDINGS", "WORSENED_METRICS", "INVALID_CONFIGURATION", "UNSUPPORTED_VALUE",
  ]) }).strict(),
  z.object({ ...verificationBinding, outcome: z.literal("PREDICTED_NOT_APPLIED"),
    selectedIssueResolved: z.literal(true), resolvedIssueCount: aiCounterSchema.min(1),
    introducedIssueCount: z.literal(0) }).strict(),
]);
export type SmartRepairVerificationResult = z.infer<typeof smartRepairVerificationResultSchema>;
