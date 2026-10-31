/**
 * Phase 8 S6 — corrected source CSV export, entirely browser-local and deterministic.
 * Unlike Phase 7 privacy-reduced REPORT exports, this deliberately includes
 * the selected dataset's source headers and ALL of its current cell values.
 * The caller must initiate the download explicitly and warn about sensitive data.
 */
import type { ParsedCsv } from "../csv/parser";
import { encodeCsvCell } from "../reports/export";
import { getEffectiveCorrections } from "./engine";
import type { CorrectionState } from "./types";

export interface PreparedCorrectedCsvExport {
  readonly filename: string;
  readonly contentType: "text/csv;charset=utf-8";
  readonly content: string;
  readonly dataset: string;
  readonly totalRows: number;
  readonly changedCells: number;
  /** Counts prefixed source headers + data cells; not a validation metric. */
  readonly formulaProtectedCells: number;
}

function safeDownloadFilename(dataset: string): string {
  // Stable suffix distinguishes differently named datasets that slugify alike.
  let hash = 2166136261;
  for (const char of dataset) {
    hash = Math.imul(hash ^ char.codePointAt(0)!, 16777619) >>> 0;
  }
  const slug = dataset.toLowerCase().replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "").slice(0, 48) || "dataset";
  return `data-rehearsal-corrected-${slug}-${hash.toString(16).padStart(8, "0")}.csv`;
}

function assertMatchingShape(original: ParsedCsv, current: ParsedCsv): void {
  if (original.name !== current.name || original.filename !== current.filename ||
      JSON.stringify(original.headers) !== JSON.stringify(current.headers) ||
      JSON.stringify(original.rowNumbers) !== JSON.stringify(current.rowNumbers) ||
      original.rows.length !== current.rows.length || original.headers.length === 0 ||
      original.rows.length !== original.rowNumbers.length) {
    throw new Error("CSV structure changed; corrected export refused to prevent data loss.");
  }
  const headers = new Set(original.headers);
  if (headers.size !== original.headers.length) {
    throw new Error("Duplicate source column labels; corrected export refused.");
  }
  for (const row of current.rows) {
    if (Object.keys(row).length !== headers.size ||
        Object.keys(row).some((key) => !headers.has(key))) {
      throw new Error("Unexpected source columns; corrected export refused.");
    }
  }
}

function safeCell(value: unknown): { encoded: string; prefixed: boolean } {
  if (typeof value !== "string") {
    throw new Error("Non-text cell; corrected export refused.");
  }
  if (value.includes("\u0000") || new TextDecoder("utf-8", { fatal: true, ignoreBOM: true })
    .decode(new TextEncoder().encode(value)) !== value) {
    throw new Error("Unsupported NUL or invalid Unicode cell; corrected export refused.");
  }
  const encoded = encodeCsvCell(value); // Reuse Phase 7's tested spreadsheet-safety policy.
  return { encoded, prefixed: encoded !== `"${value.replaceAll('"', '""')}"` };
}

/**
 * Snapshot-only function: never changes input or contacts APIs.
 * Source column order and the exact record sequence are preserved.
 * Spreadsheet-safety apostrophe prefixes intentionally change risky cell text;
 * reopening/reimporting as raw data must be reviewed by the user.
 */
export function prepareCorrectedCsvExport(
  state: CorrectionState,
  datasetName: string,
): PreparedCorrectedCsvExport {
  const original = state.original.find((item) => item.name === datasetName);
  const current = state.current.find((item) => item.name === datasetName);
  if (!original || !current) {
    throw new Error(`Dataset '${datasetName}' was not found in this correction session.`);
  }
  assertMatchingShape(original, current);

  let formulaProtectedCells = 0;
  const allRecords: readonly (readonly string[])[] = [
    original.headers,
    ...current.rows.map((row) => original.headers.map((header) => row[header])),
  ];
  const lines = allRecords.map((record) => record.map((value) => {
    const cell = safeCell(value);
    if (cell.prefixed) formulaProtectedCells += 1;
    return cell.encoded;
  }).join(","));

  return {
    filename: safeDownloadFilename(datasetName),
    contentType: "text/csv;charset=utf-8",
    content: `\uFEFF${lines.join("\r\n")}\r\n`,
    dataset: datasetName,
    totalRows: current.rows.length,
    changedCells: getEffectiveCorrections(state).filter((edit) => edit.dataset === datasetName).length,
    formulaProtectedCells,
  };
}
