/**
 * Phase 8 S1: pure, explicit, in-memory correction operations.
 * The engine does NOT auto-correct, revalidate, export, persist or timestamp.
 * Caller must seek user approval before invoking applyCellCorrection().
 */
import type { ParsedCsv } from "../csv/parser";
import type {
  AppliedCellCorrection,
  CellAddress,
  CellEditRequest,
  CorrectionState,
  EffectiveCellCorrection,
} from "./types";

/** Guard against unbounded undo history in a browser tab. */
export const MAX_CORRECTION_OPERATIONS = 5_000;

/** Freeze independent snapshots to enforce immutability even in JavaScript. */
function cloneDataset(dataset: ParsedCsv): ParsedCsv {
  return Object.freeze({
    name: dataset.name,
    filename: dataset.filename,
    headers: Object.freeze([...dataset.headers]),
    rowNumbers: Object.freeze([...dataset.rowNumbers]),
    rows: Object.freeze(dataset.rows.map((row) => Object.freeze({ ...row }))),
  }) as unknown as ParsedCsv;
}

function validateInput(datasets: readonly ParsedCsv[]): void {
  const names = new Set<string>();
  for (const dataset of datasets) {
    if (!dataset.name || !dataset.filename || names.has(dataset.name)) {
      throw new Error("Every dataset needs a unique, nonempty name and filename.");
    }
    names.add(dataset.name);
    if (dataset.headers.length === 0 || dataset.rows.length === 0 ||
        dataset.rows.length !== dataset.rowNumbers.length ||
        dataset.headers.some((column) => !column) ||
        new Set(dataset.headers.map((column) => column.toLowerCase())).size !== dataset.headers.length) {
      throw new Error(`Invalid CSV shape for dataset '${dataset.name}'.`);
    }
    const headers = new Set(dataset.headers);
    let lastLine = 1;
    for (let index = 0; index < dataset.rows.length; index++) {
      const line = dataset.rowNumbers[index];
      if (!Number.isSafeInteger(line) || line <= lastLine) {
        throw new Error(`Invalid physical CSV line locations in '${dataset.name}'.`);
      }
      lastLine = line;
      const row = dataset.rows[index];
      if (Object.keys(row).length !== headers.size ||
          Object.keys(row).some((column) => !headers.has(column)) ||
          dataset.headers.some((column) => typeof row[column] !== "string")) {
        throw new Error(`Invalid CSV row shape in '${dataset.name}' at line ${line}.`);
      }
    }
  }
}

export function createCorrectionState(datasets: readonly ParsedCsv[]): CorrectionState {
  validateInput(datasets);
  const original = Object.freeze(datasets.map(cloneDataset));
  return Object.freeze({
    original,
    current: original,
    undoStack: Object.freeze([]),
    redoStack: Object.freeze([]),
    nextSequence: 1,
  });
}

function resolveCell(datasets: readonly ParsedCsv[], address: CellAddress): {
  datasetIndex: number;
  rowIndex: number;
  value: string;
} {
  if (!address.dataset || !address.column || !Number.isSafeInteger(address.rowNumber)) {
    throw new Error("Dataset, column and physical CSV line must be valid.");
  }
  const datasetIndex = datasets.findIndex((item) => item.name === address.dataset);
  if (datasetIndex < 0) throw new Error(`Dataset '${address.dataset}' not found.`);
  const dataset = datasets[datasetIndex];
  if (!dataset.headers.includes(address.column)) {
    throw new Error(`Column '${address.column}' not found in '${address.dataset}'.`);
  }
  const rowIndex = dataset.rowNumbers.indexOf(address.rowNumber);
  if (rowIndex < 0) {
    throw new Error(`Physical CSV line ${address.rowNumber} not found in '${address.dataset}'.`);
  }
  return { datasetIndex, rowIndex, value: dataset.rows[rowIndex][address.column] };
}

export function getOriginalCellValue(state: CorrectionState, address: CellAddress): string {
  return resolveCell(state.original, address).value;
}

export function getCurrentCellValue(state: CorrectionState, address: CellAddress): string {
  return resolveCell(state.current, address).value;
}

function updateCell(
  datasets: readonly ParsedCsv[],
  address: CellAddress,
  value: string,
): readonly ParsedCsv[] {
  const { datasetIndex, rowIndex } = resolveCell(datasets, address);
  const dataset = datasets[datasetIndex];
  const rows = dataset.rows.map((row, index) => index === rowIndex
    ? Object.freeze({ ...row, [address.column]: value })
    : row);
  const nextDataset = Object.freeze({ ...dataset, rows: Object.freeze(rows) }) as unknown as ParsedCsv;
  return Object.freeze(datasets.map((item, index) => index === datasetIndex ? nextDataset : item));
}

export function applyCellCorrection(state: CorrectionState, edit: CellEditRequest): CorrectionState {
  if (typeof edit.value !== "string") {
    throw new Error("Corrected CSV cell values must be strings.");
  }
  const previousValue = getCurrentCellValue(state, edit);
  if (edit.expectedValue !== undefined && edit.expectedValue !== previousValue) {
    throw new Error("Cell changed since editing began. Review the current value before applying.");
  }
  // No-op edits must not create history or invalidate redo.
  if (previousValue === edit.value) return state;
  if (state.undoStack.length >= MAX_CORRECTION_OPERATIONS) {
    throw new Error("Undo history is full. Export or restart the correction session before continuing.");
  }
  const operation: AppliedCellCorrection = Object.freeze({
    sequence: state.nextSequence,
    dataset: edit.dataset,
    rowNumber: edit.rowNumber,
    column: edit.column,
    previousValue,
    correctedValue: edit.value,
  });
  return Object.freeze({
    original: state.original,
    current: updateCell(state.current, edit, edit.value),
    undoStack: Object.freeze([...state.undoStack, operation]),
    redoStack: Object.freeze([]),
    nextSequence: state.nextSequence + 1,
  });
}

export function undoCorrection(state: CorrectionState): CorrectionState {
  if (state.undoStack.length === 0) return state;
  const operation = state.undoStack[state.undoStack.length - 1];
  if (getCurrentCellValue(state, operation) !== operation.correctedValue) {
    throw new Error("Undo state mismatch; refusing to overwrite the current cell.");
  }
  return Object.freeze({
    original: state.original,
    current: updateCell(state.current, operation, operation.previousValue),
    undoStack: Object.freeze(state.undoStack.slice(0, -1)),
    redoStack: Object.freeze([...state.redoStack, operation]),
    nextSequence: state.nextSequence,
  });
}

export function redoCorrection(state: CorrectionState): CorrectionState {
  if (state.redoStack.length === 0) return state;
  const operation = state.redoStack[state.redoStack.length - 1];
  if (getCurrentCellValue(state, operation) !== operation.previousValue) {
    throw new Error("Redo state mismatch; refusing to overwrite the current cell.");
  }
  return Object.freeze({
    original: state.original,
    current: updateCell(state.current, operation, operation.correctedValue),
    undoStack: Object.freeze([...state.undoStack, operation]),
    redoStack: Object.freeze(state.redoStack.slice(0, -1)),
    nextSequence: state.nextSequence,
  });
}

export function getEffectiveCorrections(state: CorrectionState): readonly EffectiveCellCorrection[] {
  const result: EffectiveCellCorrection[] = [];
  // Stable dataset -> physical line -> source header order; no timestamps or random IDs.
  for (const dataset of state.original) {
    const corrected = state.current.find((item) => item.name === dataset.name);
    if (!corrected) throw new Error("Correction state is inconsistent.");
    for (let index = 0; index < dataset.rows.length; index++) {
      for (const column of dataset.headers) {
        const originalValue = dataset.rows[index][column];
        const correctedValue = corrected.rows[index][column];
        if (originalValue !== correctedValue) {
          result.push(Object.freeze({
            dataset: dataset.name,
            rowNumber: dataset.rowNumbers[index],
            column,
            originalValue,
            correctedValue,
          }));
        }
      }
    }
  }
  return Object.freeze(result);
}

/** Explicit destructive action for a later UI confirmation dialog. Undo stacks clear. */
export function discardAllCorrections(state: CorrectionState): CorrectionState {
  if (state.undoStack.length === 0 && state.redoStack.length === 0) return state;
  return Object.freeze({
    original: state.original,
    current: state.original,
    undoStack: Object.freeze([]),
    redoStack: Object.freeze([]),
    nextSequence: state.nextSequence,
  });
}
