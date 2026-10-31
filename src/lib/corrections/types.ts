import type { ParsedCsv } from "../csv/parser";

/** Original physical CSV row locations are the stable record identity. */
export interface CellAddress {
  readonly dataset: string;
  readonly rowNumber: number;
  readonly column: string;
}

/** An explicit user-approved change. expectedValue prevents stale UI edits. */
export interface CellEditRequest extends CellAddress {
  readonly value: string;
  readonly expectedValue?: string;
}

/** Recorded only after an actual change; no clock or randomness in domain state. */
export interface AppliedCellCorrection extends CellAddress {
  readonly sequence: number;
  readonly previousValue: string;
  readonly correctedValue: string;
}

/** Independent browser-memory snapshots. Never send this object to the API. */
export interface CorrectionState {
  readonly original: readonly ParsedCsv[];
  readonly current: readonly ParsedCsv[];
  readonly undoStack: readonly AppliedCellCorrection[];
  readonly redoStack: readonly AppliedCellCorrection[];
  readonly nextSequence: number;
}

/** Net difference between original and current (not an audit trail). */
export interface EffectiveCellCorrection extends CellAddress {
  readonly originalValue: string;
  readonly correctedValue: string;
}
