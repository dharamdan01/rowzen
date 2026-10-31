import { describe, expect, it } from "vitest";
import type { ParsedCsv } from "../../../src/lib/csv/parser";
import {
  applyCellCorrection, createCorrectionState, discardAllCorrections,
  getCurrentCellValue, getEffectiveCorrections, getOriginalCellValue,
  redoCorrection, undoCorrection,
} from "../../../src/lib/corrections/engine";

function dataset(name = "students", rows = [{ id: "1", name: "Ali" }, { id: "2", name: "Sara" }], lines = [2, 4]): ParsedCsv {
  return { name, filename: `${name}.csv`, headers: ["id", "name"], rows, rowNumbers: lines };
}
const address = { dataset: "students", rowNumber: 4, column: "name" } as const;

function apply(value: string) {
  return applyCellCorrection(createCorrectionState([dataset()]), { ...address, value });
}

describe("Phase 8 S1 immutable correction engine", () => {
  it("detaches and freezes snapshots from caller mutable input", () => {
    const input = dataset();
    const state = createCorrectionState([input]);
    input.rows[1].name = "changed externally";
    input.rowNumbers[1] = 99;
    expect(getCurrentCellValue(state, address)).toBe("Sara");
    expect(getOriginalCellValue(state, address)).toBe("Sara");
    expect(Object.isFrozen(state.current[0].rows[1])).toBe(true);
    expect(Object.isFrozen(state.current[0].rowNumbers)).toBe(true);
  });

  it("rejects duplicate dataset identities", () => {
    expect(() => createCorrectionState([dataset(), dataset()])).toThrow(/unique/);
  });
  it("rejects dataset missing name/filename", () => {
    expect(() => createCorrectionState([{ ...dataset(), name: "" }])).toThrow();
  });
  it("rejects mismatched row counts and physical locations", () => {
    expect(() => createCorrectionState([{ ...dataset(), rowNumbers: [2] }])).toThrow();
  });
  it("rejects duplicated or unordered physical CSV line numbers", () => {
    expect(() => createCorrectionState([{ ...dataset(), rowNumbers: [4, 4] }])).toThrow();
    expect(() => createCorrectionState([{ ...dataset(), rowNumbers: [4, 2] }])).toThrow();
  });
  it("rejects invalid or duplicate CSV headers", () => {
    expect(() => createCorrectionState([{ ...dataset(), headers: ["id", "ID"] }])).toThrow();
    expect(() => createCorrectionState([{ ...dataset(), headers: ["id", ""] }])).toThrow();
  });
  it("rejects missing or extra CSV columns", () => {
    expect(() => createCorrectionState([dataset("students", [{ id: "1", name: "A", extra: "x" } as { id: string; name: string }], [2])])).toThrow();
    expect(() => createCorrectionState([dataset("students", [{ id: "1" } as { id: string; name: string }], [2])])).toThrow();
  });
  it("rejects non-string cell values", () => {
    expect(() => createCorrectionState([dataset("students", [{ id: 1 as unknown as string, name: "A" }], [2])])).toThrow();
  });
  it("applies without mutating original, earlier state or other rows", () => {
    const state = createCorrectionState([dataset()]);
    const next = applyCellCorrection(state, { ...address, value: "Sana" });
    expect(getCurrentCellValue(state, address)).toBe("Sara");
    expect(getCurrentCellValue(next, address)).toBe("Sana");
    expect(getOriginalCellValue(next, address)).toBe("Sara");
    expect(next.current[0].rows[0]).toBe(state.current[0].rows[0]);
    expect(next.undoStack).toHaveLength(1);
  });
  it("preserves exact UTF-8, newlines, spaces and formula-like text without coercion", () => {
    const value = " =1+1\r\nسلام, \"quote\" ";
    expect(getCurrentCellValue(apply(value), address)).toBe(value);
  });
  it("no-op edit returns same state with redo history unchanged", () => {
    const before = undoCorrection(apply("Sana"));
    const after = applyCellCorrection(before, { ...address, value: "Sara" });
    expect(after).toBe(before);
    expect(after.redoStack).toHaveLength(1);
  });
  it("rejects stale expected values without writing history", () => {
    const state = apply("Sana");
    expect(() => applyCellCorrection(state, { ...address, value: "XYZ", expectedValue: "Sara" })).toThrow(/changed/);
    expect(getCurrentCellValue(state, address)).toBe("Sana");
  });
  it("rejects unknown dataset", () => {
    expect(() => applyCellCorrection(createCorrectionState([dataset()]), { ...address, dataset: "other", value: "x" })).toThrow(/not found/);
  });
  it("rejects unknown physical line instead of array-index editing", () => {
    expect(() => applyCellCorrection(createCorrectionState([dataset()]), { ...address, rowNumber: 3, value: "x" })).toThrow(/line 3/);
  });
  it("rejects unknown column", () => {
    expect(() => applyCellCorrection(createCorrectionState([dataset()]), { ...address, column: "email", value: "x" })).toThrow(/Column/);
  });
  it("rejects non-string edits at runtime", () => {
    expect(() => applyCellCorrection(createCorrectionState([dataset()]), { ...address, value: 1 as unknown as string })).toThrow(/strings/);
  });
  it("undo and redo preserve operation sequence and original values", () => {
    const edited = apply("Sana");
    const undone = undoCorrection(edited);
    const redone = redoCorrection(undone);
    expect(getCurrentCellValue(undone, address)).toBe("Sara");
    expect(getCurrentCellValue(redone, address)).toBe("Sana");
    expect(redone.undoStack[0]).toEqual(edited.undoStack[0]);
    expect(edited.undoStack[0].sequence).toBe(1);
  });
  it("new approved edit after undo clears redo branch", () => {
    const undone = undoCorrection(apply("Sana"));
    const changed = applyCellCorrection(undone, { ...address, value: "Fatima" });
    expect(changed.redoStack).toHaveLength(0);
    expect(changed.undoStack[0].sequence).toBe(2);
    expect(redoCorrection(changed)).toBe(changed);
  });
  it("undo/redo repeat edits to the same cell in the correct order", () => {
    let state = apply("A");
    state = applyCellCorrection(state, { ...address, value: "B" });
    expect(getCurrentCellValue(undoCorrection(state), address)).toBe("A");
    state = undoCorrection(undoCorrection(state));
    expect(getCurrentCellValue(state, address)).toBe("Sara");
    expect(getCurrentCellValue(redoCorrection(redoCorrection(state)), address)).toBe("B");
  });
  it("does not confuse same CSV line across different datasets", () => {
    const state = createCorrectionState([dataset(), dataset("departments")]);
    const changed = applyCellCorrection(state, { dataset: "departments", rowNumber: 4, column: "name", value: "Accounting" });
    expect(getCurrentCellValue(changed, address)).toBe("Sara");
    expect(getCurrentCellValue(changed, { ...address, dataset: "departments" })).toBe("Accounting");
  });
  it("undo and redo empty history are identity no-ops", () => {
    const state = createCorrectionState([dataset()]);
    expect(undoCorrection(state)).toBe(state);
    expect(redoCorrection(state)).toBe(state);
  });
  it("computes net differences without inventing a correction history", () => {
    let state = createCorrectionState([dataset()]);
    state = applyCellCorrection(state, { ...address, value: "Sana" });
    state = applyCellCorrection(state, { ...address, value: "Sara" });
    expect(getEffectiveCorrections(state)).toEqual([]);
    expect(state.undoStack).toHaveLength(2);
  });
  it("sorts net differences in original dataset, line and column order", () => {
    let state = createCorrectionState([dataset()]);
    state = applyCellCorrection(state, { ...address, value: "Sana" });
    state = applyCellCorrection(state, { dataset: "students", rowNumber: 2, column: "id", value: "10" });
    expect(getEffectiveCorrections(state)).toEqual([
      { dataset: "students", rowNumber: 2, column: "id", originalValue: "1", correctedValue: "10" },
      { ...address, originalValue: "Sara", correctedValue: "Sana" },
    ]);
  });
  it("explicit discard restores originals and clears reversible stacks", () => {
    const discarded = discardAllCorrections(apply("Sana"));
    expect(getCurrentCellValue(discarded, address)).toBe("Sara");
    expect(discarded.undoStack).toHaveLength(0);
    expect(discarded.redoStack).toHaveLength(0);
    expect(discardAllCorrections(discarded)).toBe(discarded);
  });
  it("rejects tampered redo state instead of silently overwriting user data", () => {
    const state = undoCorrection(apply("Sana"));
    const tampered = { ...state, current: apply("Other").current };
    expect(() => redoCorrection(tampered)).toThrow(/mismatch/);
  });
});
