import type { ColumnMapping } from "../rehearsal/mapping";
import type { RehearsalIssue } from "../rehearsal/types";
import type { CorrectionState } from "./types";

export type CorrectionLocation = { dataset: string; rowNumber: number; column: string | null };
/** Resolve physical CSV locations and mapped target names without changing records. */
export function issueCorrectionLocation(issue: RehearsalIssue, state: CorrectionState, mappings: Readonly<Record<string, readonly ColumnMapping[]>>): CorrectionLocation | null {
  if (issue.category !== "DATA" || issue.rowNumber === null) return null;
  const dataset = state.current.find(entry => entry.name === issue.dataset);
  if (!dataset || !dataset.rowNumbers.includes(issue.rowNumber)) return null;
  if (issue.column === null) return { dataset: issue.dataset, rowNumber: issue.rowNumber, column: null };
  const column = mappings[issue.dataset]?.find(entry => entry.target.trim() === issue.column)?.source;
  return column && dataset.headers.includes(column) ? { dataset: issue.dataset, rowNumber: issue.rowNumber, column } : null;
}
