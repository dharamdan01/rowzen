/**
 * Phase 8 S3: browser-memory activity for actual user-approved correction actions.
 * Timestamps are injected by callers; this pure module never invents clock values.
 * This is a local activity timeline, NOT a persistent/server-verified audit log.
 */
import type { AppliedCellCorrection } from "./types";

export type CorrectionActivityKind = "APPLY" | "UNDO" | "REDO";

export interface CorrectionActivityEntry {
  readonly id: number;
  readonly kind: CorrectionActivityKind;
  readonly operationSequence: number;
  readonly dataset: string;
  readonly rowNumber: number;
  readonly column: string;
  readonly beforeValue: string;
  readonly afterValue: string;
  readonly occurredAt: string;
}

export interface CorrectionActivityState {
  readonly entries: readonly CorrectionActivityEntry[];
  readonly nextId: number;
}

/** Bound browser-memory usage; older entries are discarded as new entries arrive. */
export const MAX_RECENT_CORRECTION_EVENTS = 1_000;

export function createCorrectionActivityState(): CorrectionActivityState {
  return Object.freeze({ entries: Object.freeze([]), nextId: 1 });
}

export function recordCorrectionActivity(
  state: CorrectionActivityState,
  kind: CorrectionActivityKind,
  operation: AppliedCellCorrection,
  occurredAt: string,
): CorrectionActivityState {
  if (kind !== "APPLY" && kind !== "UNDO" && kind !== "REDO") {
    throw new Error("Unsupported correction activity type.");
  }
  if (typeof occurredAt !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(occurredAt) ||
      Number.isNaN(Date.parse(occurredAt)) || new Date(occurredAt).toISOString() !== occurredAt) {
    throw new Error("A real ISO 8601 event timestamp is required.");
  }
  if (!Number.isSafeInteger(operation.sequence) || operation.sequence < 1 ||
      !operation.dataset || !operation.column || !Number.isSafeInteger(operation.rowNumber) || operation.rowNumber < 2 ||
      typeof operation.previousValue !== "string" || typeof operation.correctedValue !== "string" ||
      operation.previousValue === operation.correctedValue) {
    throw new Error("Activity must describe an actual applied cell change.");
  }
  if (!Number.isSafeInteger(state.nextId) || state.nextId < 1 || state.nextId === Number.MAX_SAFE_INTEGER) {
    throw new Error("Correction activity counter is invalid or exhausted.");
  }

  const undoing = kind === "UNDO";
  const entry: CorrectionActivityEntry = Object.freeze({
    id: state.nextId,
    kind,
    operationSequence: operation.sequence,
    dataset: operation.dataset,
    rowNumber: operation.rowNumber,
    column: operation.column,
    beforeValue: undoing ? operation.correctedValue : operation.previousValue,
    afterValue: undoing ? operation.previousValue : operation.correctedValue,
    occurredAt,
  });
  return Object.freeze({
    entries: Object.freeze([...state.entries, entry].slice(-MAX_RECENT_CORRECTION_EVENTS)),
    nextId: state.nextId + 1,
  });
}
