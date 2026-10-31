import { describe, expect, it } from "vitest";
import { createCorrectionState, applyCellCorrection, undoCorrection, redoCorrection, discardAllCorrections } from "../../../src/lib/corrections/engine";
import { prepareCorrectedCsvExport } from "../../../src/lib/corrections/export";
import type { ParsedCsv } from "../../../src/lib/csv/parser";

const parsed = (name = "students", value = "Ali", header = "name"): ParsedCsv => ({
  name, filename: `${name}.csv`, headers: ["id", header],
  rows: [{ id: "1", [header]: value }, { id: "2", [header]: "Sara" }], rowNumbers: [2, 3],
});
const base = () => createCorrectionState([parsed()]);
const edited = () => applyCellCorrection(base(), { dataset: "students", rowNumber: 2, column: "name", value: "Ahmed" });
const exportCsv = (state = edited(), dataset = "students") => prepareCorrectedCsvExport(state, dataset);

describe("Phase 8 S6 corrected CSV serialization", () => {
  it("uses UTF-8 BOM, quoted headers, CRLF and trailing CRLF", () => {
    expect(exportCsv().content).toBe('\uFEFF"id","name"\r\n"1","Ahmed"\r\n"2","Sara"\r\n');
  });
  it("preserves source header order even when cell object insertion differs", () => {
    const source = parsed(); source.rows = [{ name: "Ali", id: "1" }, { name: "Sara", id: "2" }];
    const result = exportCsv(createCorrectionState([source]));
    expect(result.content).toContain('"id","name"\r\n"1","Ali"');
  });
  it("does not add technical columns or line-number fields", () => {
    expect(exportCsv().content.split("\r\n")[0]).toBe('\uFEFF"id","name"');
  });
  it("escapes literal double quotes in approved data", () => {
    const current = applyCellCorrection(base(), { dataset: "students", rowNumber: 2, column: "name", value: 'A "quoted" name' });
    expect(exportCsv(current).content).toContain('"A ""quoted"" name"');
  });
  it("preserves commas, CRLF, tabs, embedded LF and original whitespace", () => {
    const text = '  Name,\r\nLine\n\tTail  ';
    const current = applyCellCorrection(base(), { dataset: "students", rowNumber: 2, column: "name", value: text });
    expect(exportCsv(current).content).toContain('"  Name,\r\nLine\n\tTail  "');
  });
  it("preserves UTF-8 emoji and international scripts", () => {
    const value = "پڑھائی 😀 漢字";
    const current = applyCellCorrection(base(), { dataset: "students", rowNumber: 2, column: "name", value });
    expect(exportCsv(current).content).toContain(`"${value}"`);
  });
  it("serializes empty values without writing null or undefined", () => {
    const current = applyCellCorrection(base(), { dataset: "students", rowNumber: 2, column: "name", value: "" });
    expect(exportCsv(current).content).toContain('"1",""');
  });
  it("prefixes leading = + - @ spreadsheet formulas in values", () => {
    for (const value of ["=1+1", "+SUM(A1:A2)", "-1+2", "@SUM(A1)"]) {
      const current = applyCellCorrection(base(), { dataset: "students", rowNumber: 2, column: "name", value });
      expect(exportCsv(current).content).toContain(`"'${value}"`);
      expect(exportCsv(current).formulaProtectedCells).toBe(1);
    }
  });
  it("prefixes formula-like values after whitespace, tabs, BOM and zero-width prefixes", () => {
    for (const value of [" \t=2+2", "\uFEFF=2+2", "\u200B@SUM(A1)", "\r\n=NOW()"]){
      const current = applyCellCorrection(base(), { dataset: "students", rowNumber: 2, column: "name", value });
      expect(exportCsv(current).content).toContain(`"'${value}"`);
    }
  });
  it("protects dangerous source header labels too", () => {
    const state = createCorrectionState([parsed("unusual", "text", "=1+1")]);
    const result = prepareCorrectedCsvExport(state, "unusual");
    expect(result.content).toContain('"id","\'=1+1"');
    expect(result.formulaProtectedCells).toBe(1);
  });
  it("does not alter safe text or text already starting with an apostrophe", () => {
    const current = applyCellCorrection(base(), { dataset: "students", rowNumber: 2, column: "name", value: "'=1+1" });
    expect(exportCsv(current).content).toContain('"\'=1+1"');
    expect(exportCsv(current).formulaProtectedCells).toBe(0);
  });
  it("uses current undo/redo snapshot, not a stale or original value", () => {
    const applied = edited();
    expect(exportCsv(applied).content).toContain('"Ahmed"');
    expect(exportCsv(undoCorrection(applied)).content).toContain('"Ali"');
    expect(exportCsv(redoCorrection(undoCorrection(applied))).content).toContain('"Ahmed"');
  });
  it("supports restored originals and reports zero net corrections", () => {
    expect(exportCsv(discardAllCorrections(edited())).changedCells).toBe(0);
    expect(exportCsv(discardAllCorrections(edited())).content).toContain('"Ali"');
  });
  it("counts net changes per dataset and includes untouched sibling records", () => {
    const state = createCorrectionState([parsed(), parsed("departments", "Engineering")]);
    const after = applyCellCorrection(state, { dataset: "students", rowNumber: 2, column: "name", value: "Changed" });
    expect(prepareCorrectedCsvExport(after, "students").changedCells).toBe(1);
    const sibling = prepareCorrectedCsvExport(after, "departments");
    expect(sibling.changedCells).toBe(0);
    expect(sibling.content).toContain("Engineering");
  });
  it("is deterministic and refuses missing datasets", () => {
    expect(exportCsv()).toEqual(exportCsv());
    expect(() => exportCsv(edited(), "missing")).toThrow(/not found/);
  });
  it("uses safe, deterministic, distinct filenames without path traversal", () => {
    const state = createCorrectionState([parsed("a?b"), parsed("a b")]);
    const first = prepareCorrectedCsvExport(state, "a?b").filename;
    const second = prepareCorrectedCsvExport(state, "a b").filename;
    expect(first).not.toBe(second);
    expect(first).toMatch(/^data-rehearsal-corrected-[a-z0-9_-]+\.csv$/);
    expect(first).not.toContain("?");
  });
  it("refuses invalid Unicode, NUL or non-string edited values", () => {
    for (const value of ["\u0000", "\ud800"]) {
      const current = applyCellCorrection(base(), { dataset: "students", rowNumber: 2, column: "name", value });
      expect(() => exportCsv(current)).toThrow(/Unsupported NUL or invalid Unicode/);
    }
    const state = edited();
    const tampered = { ...state, current: [{ ...state.current[0], rows: [{ id: "1", name: 7 }, ...state.current[0].rows.slice(1)] }] };
    expect(() => prepareCorrectedCsvExport(tampered as unknown as typeof state, "students")).toThrow(/Non-text cell/);
  });
  it("refuses missing or unexpected columns and tampered headers", () => {
    const state = edited();
    const tamper = (dataset: ParsedCsv) => ({ ...state, current: [dataset] });
    expect(() => prepareCorrectedCsvExport(tamper({ ...state.current[0], headers: ["name", "id"] }), "students")).toThrow(/structure changed/);
    expect(() => prepareCorrectedCsvExport(tamper({ ...state.current[0], rows: [{ id: "1", name: "Ali", extra: "boom" }, ...state.current[0].rows.slice(1)] }), "students")).toThrow(/Unexpected source columns/);
  });
  it("is pure and never mutates original, current, or correction stacks", () => {
    const state = edited();
    const original = JSON.stringify(state);
    exportCsv(state);
    expect(JSON.stringify(state)).toBe(original);
    expect(state.original[0].rows[0].name).toBe("Ali");
    expect(state.current[0].rows[0].name).toBe("Ahmed");
  });
});
