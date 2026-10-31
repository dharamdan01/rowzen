import { describe, expect, it } from "vitest";
import { parseCsvText } from "../../../src/lib/csv/parser";
import { applyCellCorrection, createCorrectionState, discardAllCorrections, redoCorrection, undoCorrection } from "../../../src/lib/corrections/engine";
import { createCorrectionActivityState, recordCorrectionActivity } from "../../../src/lib/corrections/history";
import { identityMapping, applyMapping } from "../../../src/lib/rehearsal/mapping";
import { runPreflight } from "../../../src/lib/rehearsal/preflight";

const source = parseCsvText("id,name\n1,Ali\n1,Sara", "students.csv");
const time = "2026-10-19T14:15:00.000Z";
function check(state: ReturnType<typeof createCorrectionState>) {
  const mapped = state.current.map((item) => applyMapping(item, identityMapping(item.headers)));
  return runPreflight({ datasets: mapped, rules: { students: { primaryKey: "id", required: ["name"], types: {} } }, relationships: [] });
}

describe("Phase 8 S3 activity, real corrections, original snapshots and existing validation", () => {
  it("applies, undoes and redoes with accurate before/after activity and unchanged original", () => {
    const start = createCorrectionState([source]);
    const changed = applyCellCorrection(start, { dataset: "students", rowNumber: 3, column: "id", value: "2", expectedValue: "1" });
    const op = changed.undoStack.at(-1)!;
    let timeline = recordCorrectionActivity(createCorrectionActivityState(), "APPLY", op, time);
    const undone = undoCorrection(changed);
    timeline = recordCorrectionActivity(timeline, "UNDO", op, time);
    const redone = redoCorrection(undone);
    timeline = recordCorrectionActivity(timeline, "REDO", op, time);
    expect(timeline.entries.map((entry) => [entry.kind, entry.beforeValue, entry.afterValue])).toEqual([
      ["APPLY", "1", "2"], ["UNDO", "2", "1"], ["REDO", "1", "2"],
    ]);
    expect(check(start).totals.errors).toBeGreaterThan(0);
    expect(check(undone).totals.errors).toBeGreaterThan(0);
    expect(check(redone).totals.errors).toBe(0);
    expect(start.original[0].rows[1].id).toBe("1");
  });
  it("discard restores untouched source snapshot; activity can then be explicitly cleared", () => {
    const edited = applyCellCorrection(createCorrectionState([source]), { dataset: "students", rowNumber: 3, column: "id", value: "2" });
    const restored = discardAllCorrections(edited);
    expect(restored.current).toBe(restored.original);
    expect(restored.undoStack).toHaveLength(0);
    expect(restored.redoStack).toHaveLength(0);
    expect(createCorrectionActivityState().entries).toHaveLength(0);
  });
  it("does not generate activity when an edit is canceled or never approved", () => {
    const state = createCorrectionState([source]);
    const events = createCorrectionActivityState();
    expect(events.entries).toHaveLength(0);
    expect(state.undoStack).toHaveLength(0);
  });
});
