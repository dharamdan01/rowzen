import { AiError } from "../ai/contracts";
import { smartRepairVerificationResultSchema, type SmartRepairVerificationResult } from "../ai/smart-repair-contracts";
import { readLocalRepairCandidate, readLocalRepairSimulationInput, type LocalRepairCandidate } from "./repair-candidates";
import { previewCellCorrection, type DetailedWhatIfPreview } from "./what-if";

const messages = Object.freeze({
  INVALID_CANDIDATE: "The repair candidate is invalid or unsupported. Resolve a fresh local candidate.",
  INVALID_VERIFICATION: "This verification was not created by the local deterministic verifier.",
  INVALID_SIMULATION: "The current candidate could not be simulated. No data or history was changed.",
  STALE: "The workspace or expected cell value changed. Run a fresh preview before approval.",
  CANCELLED: "Repair verification was cancelled. No data or history was changed.",
  BLOCKED: "This preview does not qualify for a future Apply. Review its findings or resolve another candidate.",
});
type ErrorReason = keyof typeof messages;
export class RepairVerificationError extends Error {
  constructor(readonly reason: ErrorReason) { super(messages[reason]); this.name = "RepairVerificationError"; }
}
export type RepairImpact = "PREFLIGHT_IMPROVEMENT" | "NEUTRAL" | "REGRESSION" | "UNEVALUATED";
const explanations: Record<RepairImpact, string> = {
  PREFLIGHT_IMPROVEMENT: "The canonical preflight resolved the selected finding without introducing findings or worsening evaluated metrics. This predicts declared-check improvement, not business correctness or database import success. The edit is not applied.",
  NEUTRAL: "The preview does not establish an eligible improvement for the selected finding. The edit is not applied.",
  REGRESSION: "The preview introduces findings or worsens evaluated metrics. These findings remain available for review; future Apply is blocked.",
  UNEVALUATED: "Configuration errors or unevaluated row validity prevent repair verification. Unknown row counts remain unknown; future Apply is blocked.",
};

declare const verificationBrand: unique symbol;
export type RepairVerification = Readonly<{ candidateId: string; kind: "DETERMINISTIC_PREFLIGHT"; [verificationBrand]: true }>;
export type RepairVerificationData = Readonly<{
  preview: DetailedWhatIfPreview; impact: RepairImpact; explanation: string; contract: SmartRepairVerificationResult;
}>;
export type RepairVerificationOutcome =
  | Readonly<{ outcome: "PREVIEW_READY"; verification: RepairVerification }>
  | Readonly<{ outcome: "REJECTED" | "CANCELLED"; reason: ErrorReason; explanation: string }>;
type Entry = { candidate: LocalRepairCandidate; signal?: AbortSignal; cancelled: boolean; data: RepairVerificationData };
const verifications = new WeakMap<object, Entry>();

function assess(preview: DetailedWhatIfPreview, issueId: string): { impact: RepairImpact; reason?: "INVALID_CONFIGURATION" | "INTRODUCED_FINDINGS" | "WORSENED_METRICS" | "TARGET_NOT_RESOLVED" } {
  const before = preview.before, after = preview.predicted;
  if (before.status === "CONFIG_ERROR" || after.status === "CONFIG_ERROR" || before.validRows === null ||
      before.invalidRows === null || after.validRows === null || after.invalidRows === null) {
    return { impact: "UNEVALUATED", reason: "INVALID_CONFIGURATION" };
  }
  if (preview.introducedIssueCount > 0 || after.totalIssues > before.totalIssues ||
      after.blockingErrors > before.blockingErrors || after.warnings > before.warnings ||
      after.invalidRows > before.invalidRows || after.validRows < before.validRows) {
    return { impact: "REGRESSION", reason: preview.introducedIssueCount > 0 ? "INTRODUCED_FINDINGS" : "WORSENED_METRICS" };
  }
  if (!preview.findings.resolved.some(issue => issue.id === issueId) || after.totalIssues >= before.totalIssues) {
    return { impact: "NEUTRAL", reason: "TARGET_NOT_RESOLVED" };
  }
  return { impact: "PREFLIGHT_IMPROVEMENT" };
}

function freezeContract(contract: SmartRepairVerificationResult): SmartRepairVerificationResult {
  Object.freeze(contract.target);
  Object.freeze(contract.revisions.version);
  Object.freeze(contract.revisions);
  return Object.freeze(contract);
}

/** A single canonical What-if run on a temporary snapshot. Cancellation is cooperative at synchronous boundaries. */
export function previewRepairCandidate(candidate: LocalRepairCandidate, { signal }: { signal?: AbortSignal } = {}): RepairVerificationOutcome {
  try {
    signal?.throwIfAborted();
    const input = readLocalRepairSimulationInput(candidate);
    const preview = previewCellCorrection(input.state, input.edit, input.config, { includeFindings: true, signal });
    signal?.throwIfAborted();
    // Never publish a simulation of an older snapshot as current, even if calculation completed.
    readLocalRepairCandidate(candidate);
    const assessment = assess(preview, input.issueId);
    const contract = smartRepairVerificationResultSchema.parse({
      schemaVersion: 1, source: "DETERMINISTIC_PREFLIGHT", candidateId: candidate.candidateId,
      revisions: { version: candidate.version, workspaceRevision: candidate.workspaceRevision }, target: input.target,
      ...(assessment.reason ? { outcome: "REJECTED", reason: assessment.reason } : {
        outcome: "PREDICTED_NOT_APPLIED", selectedIssueResolved: true,
        resolvedIssueCount: preview.resolvedIssueCount, introducedIssueCount: preview.introducedIssueCount,
      }),
    });
    signal?.throwIfAborted();
    const verification = Object.freeze({ candidateId: candidate.candidateId, kind: "DETERMINISTIC_PREFLIGHT" as const }) as RepairVerification;
    verifications.set(verification, { candidate, signal, cancelled: false,
      data: Object.freeze({ preview, impact: assessment.impact, explanation: explanations[assessment.impact], contract: freezeContract(contract) }) });
    return Object.freeze({ outcome: "PREVIEW_READY", verification });
  } catch (error) {
    const reason = signal?.aborted ? "CANCELLED" : error instanceof AiError
      ? error.code === "STALE" ? "STALE" : "INVALID_CANDIDATE" : "INVALID_SIMULATION";
    return Object.freeze({ outcome: reason === "CANCELLED" ? "CANCELLED" : "REJECTED", reason, explanation: messages[reason] });
  }
}

function entryFor(verification: RepairVerification): Entry {
  const entry = verifications.get(verification);
  if (!entry) throw new RepairVerificationError("INVALID_VERIFICATION");
  if (entry.cancelled || entry.signal?.aborted) throw new RepairVerificationError("CANCELLED");
  try { readLocalRepairCandidate(entry.candidate); }
  catch { throw new RepairVerificationError("STALE"); }
  return entry;
}

/** Findings are browser-local metadata for future display. Reading rechecks cancellation, revisions and expected text. */
export function readRepairVerification(verification: RepairVerification): RepairVerificationData { return entryFor(verification).data; }

export function cancelRepairVerification(verification: RepairVerification): void {
  const entry = verifications.get(verification);
  if (!entry) throw new RepairVerificationError("INVALID_VERIFICATION");
  entry.cancelled = true;
}

/** Freshness/eligibility guard only. It neither approves nor applies an edit; future approval must call it immediately before Apply. */
export function assertRepairReadyForApply(verification: RepairVerification): void {
  const entry = entryFor(verification);
  if (entry.data.impact !== "PREFLIGHT_IMPROVEMENT" || entry.data.contract.outcome !== "PREDICTED_NOT_APPLIED") {
    throw new RepairVerificationError("BLOCKED");
  }
}
