import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { parseCsvText } from "../../src/lib/csv/parser";
import {
  applyCellCorrection, createCorrectionState, undoCorrection,
} from "../../src/lib/corrections/engine";
import type { CorrectionState } from "../../src/lib/corrections/types";
import { createIssue } from "../../src/lib/rehearsal/issues";
import type { RehearsalIssue } from "../../src/lib/rehearsal/types";
import CorrectionWorkspace from "../../src/components/corrections/correction-workspace";

const files = [
  parseCsvText("id,name,department_id\n1,Ali,10\n2,Sara,20\n3,Ahmed,99\n3,Bilal,10", "students.csv"),
  parseCsvText("id,name\n10,Engineering\n20,Science", "departments.csv"),
];
const fkIssue = createIssue({
  code: "FK_NOT_FOUND", severity: "ERROR", category: "DATA",
  dataset: "students", rowNumber: 4, column: "department_id",
  ruleId: "fk:students.department_id->departments.id",
  explanation: "Referenced key missing", suggestedInvestigation: "Check parent dataset",
});
const props = {
  mappings: {
    students: files[0].headers.map((source) => ({ source, target: source })),
    departments: files[1].headers.map((source) => ({ source, target: source })),
  },
  onApprove: () => {}, onUndo: () => {}, onRedo: () => {}, onDiscard: () => {},
};
function html(state: CorrectionState = createCorrectionState(files), issues: readonly RehearsalIssue[] = []) {
  return renderToStaticMarkup(createElement(CorrectionWorkspace, { ...props, state, issues }));
}

describe("Phase 8 S2 correction workspace accessibility and truthful rendering", () => {
  it("shows the accessible heading, dataset chooser and original source columns", () => {
    const markup = html();
    expect(markup).toContain("Data correction workspace");
    expect(markup).toContain("Correction dataset");
    expect(markup).toContain("Editable CSV records for students.csv");
    expect(markup).toContain("department_id");
  });
  it("shows physical CSV lines, not zero-based row indices", () => {
    const markup = html();
    expect(markup).toContain("line 4 column department_id");
    expect(markup).not.toContain("line 0 column");
  });
  it("labels edit actions with dataset, line and column", () => {
    expect(html()).toContain('aria-label="Edit students line 4 column department_id"');
  });
  it("renders issues at their real row and column without inventing other issues", () => {
    const markup = html(createCorrectionState(files), [fkIssue]);
    expect(markup).toContain("FK_NOT_FOUND");
    expect(markup).toContain("1 validation issue on CSV line 4");
    expect(markup).not.toContain("DUPLICATE_UNIQUE");
  });
  it("shows current vs original values only for actually changed cells", () => {
    const original = createCorrectionState(files);
    const corrected = applyCellCorrection(original, {
      dataset: "students", rowNumber: 4, column: "department_id", expectedValue: "99", value: "20",
    });
    expect(html(original)).toContain("0 currently changed cells");
    const markup = html(corrected);
    expect(markup).toContain("1 currently changed cell");
    expect(markup).toContain("Original:");
    expect(markup).toContain("Corrected");
    expect(markup).toContain(">99<");
  });
  it("does not report changes when an edit has been undone", () => {
    const original = createCorrectionState(files);
    const corrected = applyCellCorrection(original, {
      dataset: "students", rowNumber: 4, column: "department_id", value: "20",
    });
    const undone = undoCorrection(corrected);
    expect(html(undone)).toContain("0 currently changed cells");
  });
  it("retains undo, redo and explicit discard action labels", () => {
    const markup = html();
    expect(markup).toContain("Undo correction");
    expect(markup).toContain("Redo correction");
    expect(markup).toContain("Discard corrections");
  });
  it("does not render raw data as executable HTML", () => {
    const malicious = parseCsvText('id,name\n1,"<img src=x onerror=alert(1)>"', "malicious.csv");
    const markup = html(createCorrectionState([malicious]));
    expect(markup).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(markup).not.toContain("<img src=x");
  });
  it("paginates ten records at a time without fake counts", () => {
    const many = parseCsvText(`id,name\n${Array.from({ length: 12 }, (_, i) => `${i + 1},Sample${i + 1}`).join("\n")}`, "many.csv");
    const markup = html(createCorrectionState([many]));
    expect(markup).toContain("Showing 1–10 of 12 records · Page 1 of 2");
    expect(markup).toContain("Next records");
    expect(markup).not.toContain("Sample12");
  });
  it("uses a stable physical line after a multiline CSV record", () => {
    const multi = parseCsvText('id,name\n1,"Ali\nKhan"\n2,Sara', "multi.csv");
    const markup = html(createCorrectionState([multi]));
    expect(markup).toContain('aria-label="Edit multi line 4 column name"');
    expect(markup).toContain("Ali\nKhan");
  });
});
