import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { correctionPack } from "../fixtures/correction-csv-pack";
import { createCorrectionState, applyCellCorrection, undoCorrection, redoCorrection } from "../../src/lib/corrections/engine";
import { revalidateCorrectionSnapshot } from "../../src/lib/corrections/revalidation";
import { previewCellCorrection } from "../../src/lib/corrections/what-if";
import { prepareCorrectedCsvExport } from "../../src/lib/corrections/export";
import { parseCsvText } from "../../src/lib/csv/parser";
import WhatIfPanel from "../../src/components/corrections/what-if-panel";

describe("correction presentation with supplied boolean and multiline/export CSVs", () => {
  it("previews a positive single-cell change without mutating original/current snapshots", () => {
    const {datasets, boolean, config} = correctionPack(), state = createCorrectionState(datasets);
    const before = JSON.stringify(state);
    const preview = previewCellCorrection(state, {dataset: boolean.name, rowNumber: boolean.rowNumbers[2], column: "active", expectedValue: "yes", value: "true"}, config);
    expect(preview.before.totalIssues).toBe(2); expect(preview.predicted.totalIssues).toBe(1); expect(preview.resolvedIssueCount).toBe(1);
    expect(JSON.stringify(state)).toBe(before);
    expect(renderToStaticMarkup(h(WhatIfPanel, {preview}))).toContain("Deterministic preflight results do not establish business correctness");
  });
  it("shows negative What-if impact without silently overwriting a multiline value", () => {
    const {datasets, text, config} = correctionPack(), state = createCorrectionState(datasets);
    const row = text.rows[1], before = structuredClone(state);
    expect(row.description).toContain("\n");
    const preview = previewCellCorrection(state, {dataset: text.name, rowNumber: text.rowNumbers[1], column: "description", expectedValue: row.description, value: ""}, config);
    expect(preview.introducedIssueCount).toBe(1); expect(preview.predicted.totalIssues).toBe(3);
    expect(preview.predicted.invalidRows).toBe(3); expect(state).toEqual(before);
  });
  it("preserves original Unicode, physical line identities and leading zeros through an approved edit and Undo/Redo", () => {
    const {datasets, text, config} = correctionPack(), initial = createCorrectionState(datasets);
    const edit = {dataset: text.name, rowNumber: text.rowNumbers[1], column: "description", expectedValue: text.rows[1].description, value: "Approved first line\nApproved second line"};
    const changed = applyCellCorrection(initial, edit);
    expect(changed.undoStack).toHaveLength(1); expect(changed.original).toEqual(initial.original);
    expect(changed.current[1].rowNumbers).toEqual(text.rowNumbers);
    expect(changed.current[1].rows[1].postal_code).toBe("00002");
    expect(revalidateCorrectionSnapshot(changed.current, config).report.issues).toHaveLength(2);
    expect(undoCorrection(changed).current).toEqual(initial.current);
    expect(redoCorrection(undoCorrection(changed)).current).toEqual(changed.current);
    expect(() => applyCellCorrection(changed, edit)).toThrow();
  });
  it("exports corrected multiline strings deliberately and discloses spreadsheet-safe transformations", () => {
    const {datasets, text} = correctionPack(), initial = createCorrectionState(datasets);
    const state = applyCellCorrection(initial, {dataset: text.name, rowNumber: text.rowNumbers[1], column: "description", expectedValue: text.rows[1].description, value: "Approved first line\nApproved second line"});
    const file = prepareCorrectedCsvExport(state, text.name);
    const parsed = parseCsvText(file.content, file.filename);
    expect(parsed.rows[1].description).toBe("Approved first line\nApproved second line");
    expect(parsed.rows[1].postal_code).toBe("00002");
    expect(parsed.rows[2].description).toBe("'=2+2");
    expect(state.original[1].rows[2].description).toBe("=2+2");
    expect(state.current[1].rows[2].description).toBe("=2+2");
    expect(parsed.headers).toEqual(text.headers);
    expect(parsed.rows[3].description).toBe(text.rows[3].description);
  });
});
