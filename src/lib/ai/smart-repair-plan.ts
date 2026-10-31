import { AiError } from "./contracts";
import { assertSmartRepairCurrent, readSmartRepairLocalCell, validateSmartRepairRecommendation, type SmartRepairContext } from "./smart-repair";
import type { SmartRepairRecommendation } from "./smart-repair-contracts";
import { resolveRepairCandidate, type RepairCandidateResolution } from "../corrections/repair-candidates";
import { assertRepairReadyForApply, cancelRepairVerification, previewRepairCandidate, readRepairVerification, type RepairVerificationOutcome } from "../corrections/repair-verification";

declare const planBrand: unique symbol;
export type SmartRepairPlan = Readonly<{
  selection: SmartRepairRecommendation;
  resolution: RepairCandidateResolution;
  verification: RepairVerificationOutcome | null;
  approvalRequired: true;
  [planBrand]: true;
}>;
const plans = new WeakMap<object, { context: SmartRepairContext; signal?: AbortSignal; revoked: "STALE" | "CANCELLED" | null }>();

/** Local orchestration only: accepted AI selection -> local value resolution -> canonical What-if. No Apply path. */
export function prepareSmartRepairPlan(context: SmartRepairContext, value: unknown, signal?: AbortSignal): SmartRepairPlan {
  if (signal?.aborted) throw new AiError("CANCELLED");
  const selection = validateSmartRepairRecommendation(context, value);
  const expectedValue = selection.outcome === "ACTIONABLE_CANDIDATE" ? readSmartRepairLocalCell(context, selection).currentValue : undefined;
  const resolution = resolveRepairCandidate(context, selection, expectedValue);
  if (resolution.reason === "STALE") throw new AiError("STALE");
  const verification = resolution.outcome === "ACTIONABLE_CANDIDATE" ? previewRepairCandidate(resolution.candidate, { signal }) : null;
  if (signal?.aborted || verification?.outcome === "CANCELLED") throw new AiError("CANCELLED");
  if (verification?.outcome === "REJECTED" && verification.reason === "STALE") throw new AiError("STALE");
  assertSmartRepairCurrent(context);
  Object.freeze(selection.target); Object.freeze(selection);
  const plan = Object.freeze({ selection, resolution, verification, approvalRequired: true as const }) as SmartRepairPlan;
  plans.set(plan, { context, signal, revoked: null });
  return plan;
}

/** Revalidate even typed provider/session output. A parsed model object cannot manufacture a local plan. */
export function validateSmartRepairPlan(context: SmartRepairContext, value: unknown): SmartRepairPlan {
  const entry = value !== null && typeof value === "object" ? plans.get(value) : undefined;
  if (!entry || entry.context !== context) throw new AiError("INVALID_CONTEXT");
  if (entry.revoked) throw new AiError(entry.revoked);
  if (entry.signal?.aborted) throw new AiError("CANCELLED");
  assertSmartRepairCurrent(context);
  const plan = value as SmartRepairPlan;
  validateSmartRepairRecommendation(context, plan.selection);
  if (plan.verification?.outcome === "PREVIEW_READY") readRepairVerification(plan.verification.verification);
  return plan;
}

export function invalidateSmartRepairPlan(plan: SmartRepairPlan, reason: "STALE" | "CANCELLED"): void {
  const entry = plans.get(plan);
  if (!entry) throw new AiError("INVALID_CONTEXT");
  entry.revoked = reason;
  if (plan.verification?.outcome === "PREVIEW_READY") cancelRepairVerification(plan.verification.verification);
}

/** Eligibility only. A future UI must separately obtain explicit user approval; no edit is performed here. */
export function assertSmartRepairPlanReadyForApproval(plan: SmartRepairPlan): void {
  const entry = plans.get(plan);
  if (!entry) throw new AiError("INVALID_CONTEXT");
  validateSmartRepairPlan(entry.context, plan);
  if (plan.resolution.outcome !== "ACTIONABLE_CANDIDATE" || plan.verification?.outcome !== "PREVIEW_READY") {
    throw new AiError("INVALID_RESPONSE", "UNSUPPORTED_CLAIM");
  }
  assertRepairReadyForApply(plan.verification.verification);
}
