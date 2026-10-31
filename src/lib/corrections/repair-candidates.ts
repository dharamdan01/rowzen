import { AiError, type AiVersion } from "../ai/contracts";
import {
  assertSmartRepairCurrent, readSmartRepairLocalCell, readSmartRepairSimulationSource, validateSmartRepairRecommendation,
  type SmartRepairContext,
} from "../ai/smart-repair";
import type { SmartRepairIntent, SmartRepairRecommendation, SmartRepairStrategy } from "../ai/smart-repair-contracts";
import { matchesConfiguredType } from "../rehearsal/fields";
import type { CellEditRequest } from "./types";

export const repairResolutionMessages = Object.freeze({
  BOOLEAN_NORMALIZED: "The value matches the confirmed boolean convention. One canonical boolean replacement was constructed locally; impact has not been verified.",
  DATE_NORMALIZED: "The value matches the confirmed year-first date format and passes the existing date-format check. Impact has not been verified.",
  CONFIRM_BOOLEAN_CONVENTION: "Confirm the source boolean convention before constructing a replacement.",
  CONFIRM_DATE_FORMAT: "Confirm the source date format before constructing a replacement. Day/month order will not be guessed.",
  PROVIDE_REPLACEMENT: "Supply the intended value explicitly. Missing business data cannot be inferred.",
  BOOLEAN_TOKEN_UNRECOGNIZED: "The value is not an exact token in the confirmed boolean convention. Supply the intended value explicitly.",
  DATE_FORMAT_MISMATCH: "The value does not match the confirmed date format. Confirm its source format; no conversion was attempted.",
  INVALID_CALENDAR_DATE: "The constructed date fails the existing calendar/date policy. Supply the intended date explicitly.",
  MISSING_VALUE: "The cell is empty. Supply the intended value explicitly; no default will be invented.",
  REVIEW_KEY_RECORDS: "Review the declared key and conflicting records. Identifiers will not be invented or rewritten.",
  REVIEW_REFERENCE: "Review the intended parent relationship. A parent identifier will not be selected or manufactured.",
  REVIEW_CONFIGURATION: "Review the configuration or finish its drafts before planning a cell repair.",
  REVIEW_DEPENDENCIES: "Review the declared dependencies. A cell replacement cannot establish the intended dependency structure.",
  UNSUPPORTED_TRANSFORMATION: "This transformation is outside the approved single-cell repair strategies.",
  INSUFFICIENT_EVIDENCE: "The current evidence is insufficient to construct a replacement.",
  AMBIGUOUS_INTENT: "The intended interpretation is ambiguous. Explicit user input is required.",
  ROW_VALIDITY_UNEVALUATED: "Configuration errors prevent row-validity assessment. Review the configuration first.",
  STALE: "The workspace changed. Discard this proposal and resolve a fresh candidate from current evidence.",
  INVALID_CONTEXT: "The local proposal context or source cell is invalid. Refresh current validation evidence.",
  INVALID_REFERENCE: "The proposal does not identify the selected current source cell.",
  INVALID_RECOMMENDATION: "The recommendation violates the approved repair contract. No candidate was constructed.",
  EXPECTED_VALUE_REQUIRED: "An exact browser-local expected value is required before resolving a candidate.",
  EXPECTED_VALUE_MISMATCH: "The expected value does not match the current cell. Review the current value before retrying.",
  ALREADY_VALID: "The current value already satisfies the configured type. A formatting-only change was not proposed as a repair.",
} as const);
type Reason = keyof typeof repairResolutionMessages;
type AcceptedReason = "BOOLEAN_NORMALIZED" | "DATE_NORMALIZED";
type InputRequest = Extract<SmartRepairRecommendation, { outcome: "REQUIRES_USER_INPUT" }>["input"];
type Guidance = Extract<SmartRepairRecommendation, { outcome: "GUIDANCE_ONLY" }>["guidance"];

declare const candidateBrand: unique symbol;
/** Safe-to-inspect handle. Raw expected/replacement values are held in a private browser-local lookup. */
export type LocalRepairCandidate = Readonly<{
  candidateId: string; strategyId: SmartRepairStrategy;
  version: AiVersion; workspaceRevision: number; verification: "NOT_RUN";
  [candidateBrand]: true;
}>;
export type RepairCandidateResolution = Readonly<{
  reason: Reason; explanation: string;
} & (
  | { outcome: "ACTIONABLE_CANDIDATE"; candidate: LocalRepairCandidate }
  | { outcome: "REQUIRES_USER_INPUT"; input: InputRequest }
  | { outcome: "GUIDANCE_ONLY"; guidance: Guidance }
  | { outcome: "UNSUPPORTED_OR_INSUFFICIENT_EVIDENCE" }
)>;

type CandidateEntry = {
  context: SmartRepairContext;
  recommendation: Extract<SmartRepairRecommendation, { outcome: "ACTIONABLE_CANDIDATE" }>;
  edit: Readonly<CellEditRequest & { expectedValue: string }>;
  issueId: string;
  targetColumn: string;
};
const candidates = new WeakMap<object, CandidateEntry>();

function rejected(reason: Reason): RepairCandidateResolution {
  return Object.freeze({ outcome: "UNSUPPORTED_OR_INSUFFICIENT_EVIDENCE", reason, explanation: repairResolutionMessages[reason] });
}
function needsInput(input: InputRequest, reason: Reason): RepairCandidateResolution {
  return Object.freeze({ outcome: "REQUIRES_USER_INPUT", input, reason, explanation: repairResolutionMessages[reason] });
}
function failure(error: unknown): RepairCandidateResolution {
  if (!(error instanceof AiError)) return rejected("INVALID_CONTEXT");
  if (error.code === "STALE") return rejected("STALE");
  if (error.code === "INVALID_CONTEXT") return rejected("INVALID_CONTEXT");
  if (error.diagnostic === "UNKNOWN_EVIDENCE") return rejected("INVALID_REFERENCE");
  if (error.diagnostic === "UNSUPPORTED_CLAIM") return rejected("UNSUPPORTED_TRANSFORMATION");
  return rejected("INVALID_RECOMMENDATION");
}

type Normalization = { value: string; reason: AcceptedReason } | RepairCandidateResolution;
function booleanValue(value: string, intent: SmartRepairIntent): Normalization {
  if (intent.kind !== "CONFIRMED_BOOLEAN") return needsInput("CONFIRM_BOOLEAN_CONVENTION", "CONFIRM_BOOLEAN_CONVENTION");
  const token = value.trim().toLowerCase();
  const positive = intent.convention === "YES_NO" ? "yes" : "1";
  const negative = intent.convention === "YES_NO" ? "no" : "0";
  if (token !== positive && token !== negative) return needsInput("PROVIDE_REPLACEMENT", "BOOLEAN_TOKEN_UNRECOGNIZED");
  return { value: token === positive ? "true" : "false", reason: "BOOLEAN_NORMALIZED" };
}
function dateValue(value: string, intent: SmartRepairIntent): Normalization {
  if (intent.kind !== "CONFIRMED_DATE") return needsInput("CONFIRM_DATE_FORMAT", "CONFIRM_DATE_FORMAT");
  const pattern = intent.format === "YYYY/MM/DD" ? /^(\d{4})\/(\d{2})\/(\d{2})$/ : /^(\d{4})-(\d{1,2})-(\d{1,2})$/;
  const parts = pattern.exec(value.trim());
  if (!parts) return needsInput("CONFIRM_DATE_FORMAT", "DATE_FORMAT_MISMATCH");
  const normalized = `${parts[1]}-${parts[2].padStart(2, "0")}-${parts[3].padStart(2, "0")}`;
  if (!matchesConfiguredType(normalized, "date")) return needsInput("PROVIDE_REPLACEMENT", "INVALID_CALENDAR_DATE");
  return { value: normalized, reason: "DATE_NORMALIZED" };
}

/** Pure local resolution only. It never applies an edit, runs What-if, calls a model, or persists data. */
export function resolveRepairCandidate(context: SmartRepairContext, value: unknown, expectedValue?: string): RepairCandidateResolution {
  try {
    const recommendation = validateSmartRepairRecommendation(context, value);
    if (recommendation.outcome === "REQUIRES_USER_INPUT") return needsInput(recommendation.input, recommendation.input);
    if (recommendation.outcome === "GUIDANCE_ONLY") return Object.freeze({ outcome: "GUIDANCE_ONLY",
      guidance: recommendation.guidance, reason: recommendation.guidance, explanation: repairResolutionMessages[recommendation.guidance] });
    if (recommendation.outcome === "UNSUPPORTED_OR_INSUFFICIENT_EVIDENCE") return rejected(recommendation.reason);

    const source = readSmartRepairLocalCell(context, recommendation);
    if (typeof expectedValue !== "string") return rejected("EXPECTED_VALUE_REQUIRED");
    if (expectedValue !== source.currentValue) return rejected("EXPECTED_VALUE_MISMATCH");
    if (!source.currentValue.trim()) return needsInput("PROVIDE_REPLACEMENT", "MISSING_VALUE");
    if (matchesConfiguredType(source.currentValue.trim(), source.configuredType)) return rejected("ALREADY_VALID");
    const normalized = recommendation.strategyId === "BOOLEAN_FROM_CONFIRMED_CONVENTION"
      ? booleanValue(source.currentValue, source.intent) : dateValue(source.currentValue, source.intent);
    if (!("value" in normalized)) return normalized;
    assertSmartRepairCurrent(context);
    // One scoped request can construct only this one cell/value. Reusing its ID keeps resolution deterministic.
    const candidate = Object.freeze({ candidateId: recommendation.requestId, strategyId: recommendation.strategyId,
      version: context.version, workspaceRevision: context.workspaceRevision, verification: "NOT_RUN" as const }) as LocalRepairCandidate;
    candidates.set(candidate, { context, recommendation,
      edit: Object.freeze({ ...source.address, expectedValue, value: normalized.value }),
      issueId: source.issueId, targetColumn: source.targetColumn });
    return Object.freeze({ outcome: "ACTIONABLE_CANDIDATE", candidate, reason: normalized.reason,
      explanation: repairResolutionMessages[normalized.reason] });
  } catch (error) { return failure(error); }
}

/** Browser-only private data for later review/verification. Recheck the handle at each use; never send this to a model. */
export function readLocalRepairCandidate(candidate: LocalRepairCandidate) {
  const entry = candidates.get(candidate);
  if (!entry) throw new AiError("INVALID_CONTEXT");
  const source = readSmartRepairLocalCell(entry.context, entry.recommendation);
  if (source.currentValue !== entry.edit.expectedValue) throw new AiError("STALE");
  return Object.freeze({ candidateId: candidate.candidateId, strategyId: candidate.strategyId,
    issueId: entry.issueId, targetColumn: entry.targetColumn, edit: entry.edit, verification: "NOT_RUN" as const });
}

/** Private-data bridge to the deterministic simulator; never serialize this to a provider or persist it. */
export function readLocalRepairSimulationInput(candidate: LocalRepairCandidate) {
  const local = readLocalRepairCandidate(candidate), entry = candidates.get(candidate)!;
  return { ...local, ...readSmartRepairSimulationSource(entry.context, entry.recommendation), target: { ...entry.recommendation.target } };
}
