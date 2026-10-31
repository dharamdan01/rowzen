import { z } from "zod";
import { templateConfigurationSchema } from "../templates/schema";
import type { IssueCode, ReadinessStatus } from "../rehearsal/types";

export const AI_MAX_CONTEXT_BYTES = 2048;
export const AI_MAX_RESPONSE_BYTES = 128 * 1024;
const counter = z.number().int().nonnegative().safe();
export const aiVersionSchema = z.object({
  sessionId: z.uuid(), configuration: counter, corrections: counter, report: counter,
}).strict();
export type AiVersion = Readonly<z.infer<typeof aiVersionSchema>>;

export function sameAiVersion(a: AiVersion, b: AiVersion): boolean {
  return a.sessionId === b.sessionId && a.configuration === b.configuration &&
    a.corrections === b.corrections && a.report === b.report;
}
export function createAiVersion(): AiVersion {
  return Object.freeze({ sessionId: crypto.randomUUID(), configuration: 0, corrections: 0, report: 0 });
}
/** Call corrections for Apply, Undo, Redo and Restore; nextSequence is not a revision. */
export function advanceAiVersion(version: AiVersion, change: "session" | "configuration" | "corrections" | "report"): AiVersion {
  const parsed = aiVersionSchema.parse(version);
  return Object.freeze(change === "session" ? createAiVersion() :
    aiVersionSchema.parse({ ...parsed, [change]: parsed[change] + 1 }));
}

const codes = {
  REQUIRED: true, INVALID_TYPE: true, DUPLICATE_PK: true, DUPLICATE_UNIQUE: true,
  FK_NOT_FOUND: true, MISSING_REFERENCE_DATASET: true, BAD_SCHEMA: true,
  INCOMPATIBLE_COLUMN_TYPE: true, FK_TARGET_NOT_UNIQUE: true,
  UNSUPPORTED_CONSTRAINT: true, DEPENDENCY_CYCLE: true,
} satisfies Record<IssueCode, true>;
const statuses = { READY: true, READY_WITH_WARNINGS: true, BLOCKED: true, CONFIG_ERROR: true } satisfies Record<ReadinessStatus, true>;
const code = z.enum(Object.keys(codes) as [IssueCode, ...IssueCode[]]);
const status = z.enum(Object.keys(statuses) as [ReadinessStatus, ...ReadinessStatus[]]);
export const aiCounterSchema = counter;
export const aiIssueCodeSchema = code;
export const aiReadinessStatusSchema = status;
const fieldType = templateConfigurationSchema.shape.rules.valueType.shape.types.valueType;
const id = z.string().regex(/^[rdifg]\d{1,4}$/).max(5);
export const aiFactSchema = z.discriminatedUnion("kind", [
  z.object({ id, kind: z.literal("report"), status, totalRows: counter, validRows: counter.nullable(), invalidRows: counter.nullable(), errors: counter, warnings: counter }).strict(),
  z.object({ id, kind: z.literal("dataset"), columns: counter, required: counter, primaryWidth: counter,
    uniqueWidths: z.array(counter).max(256), types: z.array(z.object({ type: fieldType, count: counter }).strict()).max(6) }).strict(),
  z.object({ id, kind: z.literal("issues"), code, severity: z.enum(["ERROR", "WARNING"]), category: z.enum(["DATA", "SCHEMA", "DEPENDENCY"]), count: counter }).strict(),
  z.object({ id, kind: z.literal("relationship"), parent: id.nullable(), child: id.nullable(), width: counter }).strict(),
  z.object({ id, kind: z.literal("dependency"), order: z.array(id).max(5), cycles: z.array(z.array(id).max(5)).max(5) }).strict(),
]);
export type AiFact = z.infer<typeof aiFactSchema>;
export const aiWireContextSchema = z.object({ schemaVersion: z.literal(1), version: aiVersionSchema, facts: z.array(aiFactSchema).min(1).max(128) }).strict();

// Foundation diagnostic only. No mapping, explanation, repair or executable output yet.
export const aiAcknowledgementSchema = z.object({
  schemaVersion: z.literal(1), acknowledgedFactIds: z.array(id).max(8), abstained: z.boolean(),
}).strict().superRefine((value, ctx) => {
  if (new Set(value.acknowledgedFactIds).size !== value.acknowledgedFactIds.length ||
      (value.abstained ? value.acknowledgedFactIds.length !== 0 : value.acknowledgedFactIds.length === 0)) {
    ctx.addIssue({ code: "custom", message: "Invalid acknowledgement" });
  }
});
export type AiAcknowledgement = Readonly<Omit<z.infer<typeof aiAcknowledgementSchema>, "acknowledgedFactIds"> & { acknowledgedFactIds: readonly string[] }>;

export const aiErrorMessages = {
  CONSENT_REQUIRED: "Allow this local metadata request explicitly before continuing.",
  INVALID_CONTEXT: "AI context is invalid. Refresh the verified report and configuration.",
  CONTEXT_TOO_LARGE: "This metadata exceeds the local AI context budget. Validation remains available.",
  STALE: "The report or configuration changed. Refresh the context before retrying.",
  UNAVAILABLE: "The local model service is unavailable. Check Ollama, browser permissions and allowed origins.",
  MODEL_UNAVAILABLE: "The approved local model is not available. Follow the local setup instructions.",
  UNSAFE_PROVIDER: "Only an approved local model on a loopback endpoint is permitted.",
  TIMEOUT: "The local model request timed out. You can retry without changing your data.",
  CANCELLED: "The local model request was cancelled. Your data is unchanged.",
  INVALID_RESPONSE: "The model returned an invalid response. No output was accepted.",
  INCOMPATIBLE_SUGGESTION: "The model suggested settings unsupported by the local column evidence. No suggestions were accepted. Review the column evidence or retry; current settings are unchanged.",
  RESPONSE_TOO_LARGE: "The model response exceeded the safety limit. No output was accepted.",
  BUSY: "A local model request is already running.",
  AUTH_REQUIRED: "Sign in again before using hosted AI. Your data is unchanged.",
  HOSTED_CONFIGURATION: "Hosted AI is not configured. Contact the site owner; manual workflows remain available.",
  HOSTED_UNAVAILABLE: "Hosted AI is unavailable. Retry later; manual validation and correction remain available.",
  HOSTED_TIMEOUT: "The hosted AI request timed out. Retry without changing your data.",
  RATE_LIMITED: "The AI request limit was reached. Wait before retrying; no changes were applied.",
  ORIGIN_REJECTED: "This AI request origin is not allowed. Open the site's configured address and try again.",
} as const;
export type AiErrorCode = keyof typeof aiErrorMessages;
// Fixed categories only: never include raw responses, Zod issues, field names or cell values.
export const aiDiagnosticMessages = {
  HTTP_FORMAT: "The local service response was not JSON.",
  HTTP_JSON: "The local service returned malformed JSON.",
  UTF8: "The local service returned invalid UTF-8.",
  SERVICE_SCHEMA: "The local service metadata did not match the expected format.",
  RESPONSE_ENVELOPE: "The model response envelope was incomplete or unexpected.",
  TRUNCATED: "Generation stopped before completion. No partial output was accepted.",
  MODEL_JSON: "The generated content was not valid JSON.",
  OUTPUT_SCHEMA: "The generated JSON has missing fields, extra fields or invalid field types.",
  UNKNOWN_REFERENCE: "The response used a column or target ID outside the current schema.",
  DUPLICATE_REFERENCE: "The response repeated a source column or target ID.",
  TEMPLATE_EVIDENCE: "The response claimed a template match without a matching selected-template target.",
  UNKNOWN_EVIDENCE: "The response cited evidence outside the requested snapshot or scope.",
  DUPLICATE_EVIDENCE: "The response repeated evidence across explanations.",
  UNSUPPORTED_CLAIM: "The explanation or impact claim is not supported by the cited evidence.",
} as const;
export type AiDiagnostic = keyof typeof aiDiagnosticMessages;
export class AiError extends Error {
  constructor(readonly code: AiErrorCode, readonly diagnostic?: AiDiagnostic) {
    super(aiErrorMessages[code] + (diagnostic ? ` ${aiDiagnosticMessages[diagnostic]}` : "")); this.name = "AiError";
  }
}
export function safeAiError(error: unknown): AiError {
  return error instanceof AiError ? error : new AiError("INVALID_RESPONSE");
}
