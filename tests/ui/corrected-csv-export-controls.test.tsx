import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createCorrectionState, applyCellCorrection } from "../../src/lib/corrections/engine";
import CorrectedCsvExportControls from "../../src/components/corrections/corrected-csv-export-controls";

const make = () => createCorrectionState([
  { name: "students", filename: "students.csv", headers: ["id", "name"], rows: [{ id: "1", name: "Ali" }], rowNumbers: [2] },
  { name: "departments", filename: "departments.csv", headers: ["id", "name"], rows: [{ id: "10", name: "Science" }], rowNumbers: [2] },
]);
const markup = (state = make()) => renderToStaticMarkup(createElement(CorrectedCsvExportControls, { state }));

describe("Phase 8 S6 corrected CSV download UI", () => {
  it("uses an accessible, explicitly labeled selected dataset and download control", () => {
    expect(markup()).toContain('aria-label="Corrected CSV dataset"');
    expect(markup()).toContain("Download corrected CSV");
    expect(markup()).toContain("students.csv");
    expect(markup()).toContain("departments.csv");
  });
  it("disables download before any approved cell change", () => {
    expect(markup()).toMatch(/<button[^>]*disabled=""[^>]*>.*Download corrected CSV/);
    expect(markup()).toContain("Approve a correction before exporting");
  });
  it("enables download only after an approved change", () => {
    const changed = applyCellCorrection(make(), { dataset: "students", rowNumber: 2, column: "name", value: "Sara" });
    const html = markup(changed);
    expect(markup()).toMatch(
      /<button[^>]*disabled=""[^>]*>[\s\S]*Download corrected CSV/
    );
    expect(html).toContain("1 current cell changes across all datasets; 1 in the selected dataset");
  });
  it("warns that raw rows are included, formula-like cells are prefixed, and exports are not readiness certificates", () => {
    const html = markup();
    expect(html).toContain("all source rows and cell values");
    expect(html).toContain("personal or sensitive data");
    expect(html).toContain("apostrophe");
    expect(html).toContain("does not mean the dataset is READY");
  });
});
