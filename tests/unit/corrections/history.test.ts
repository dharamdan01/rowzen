import { describe, expect, it } from "vitest";
import { createCorrectionActivityState, MAX_RECENT_CORRECTION_EVENTS, recordCorrectionActivity } from "../../../src/lib/corrections/history";
import type { AppliedCellCorrection } from "../../../src/lib/corrections/types";

const now = "2026-10-19T14:00:00.000Z";
const operation: AppliedCellCorrection = {
  sequence: 1, dataset: "students", rowNumber: 4, column: "department_id",
  previousValue: "99", correctedValue: "20",
};
const start = createCorrectionActivityState;

const record = (kind: "APPLY" | "UNDO" | "REDO" = "APPLY") =>
  recordCorrectionActivity(start(), kind, operation, now);

describe("Phase 8 S3 true correction activity (browser memory)", () => {
  it("starts with zero actions; no synthetic history", () => {
    expect(start()).toEqual({ entries: [], nextId: 1 });
  });
  it("records actual approved value transition with physical CSV line", () => {
    expect(record().entries[0]).toMatchObject({ id: 1, kind: "APPLY", operationSequence: 1, dataset: "students", rowNumber: 4, column: "department_id", beforeValue: "99", afterValue: "20", occurredAt: now });
  });
  it("records undo with reversed before/after", () => {
    expect(record("UNDO").entries[0]).toMatchObject({ beforeValue: "20", afterValue: "99", kind: "UNDO" });
  });
  it("records redo with forward before/after", () => {
    expect(record("REDO").entries[0]).toMatchObject({ beforeValue: "99", afterValue: "20", kind: "REDO" });
  });
  it("preserves ordering and monotonic activity IDs across redo", () => {
    let state = start();
    state = recordCorrectionActivity(state, "APPLY", operation, now);
    state = recordCorrectionActivity(state, "UNDO", operation, now);
    state = recordCorrectionActivity(state, "REDO", operation, now);
    expect(state.entries.map((event) => [event.id, event.kind])).toEqual([[1, "APPLY"], [2, "UNDO"], [3, "REDO"]]);
    expect(state.nextId).toBe(4);
  });
  it("keeps distinct datasets on identical physical lines separate", () => {
    const second = { ...operation, sequence: 2, dataset: "departments" };
    const first = record();
    expect(recordCorrectionActivity(first, "APPLY", second, now).entries.map((entry) => entry.dataset)).toEqual(["students", "departments"]);
  });
  it("never mutates earlier snapshots", () => {
    const initial = start();
    const changed = recordCorrectionActivity(initial, "APPLY", operation, now);
    expect(initial.entries).toHaveLength(0);
    expect(Object.isFrozen(initial)).toBe(true);
    expect(Object.isFrozen(changed.entries)).toBe(true);
    expect(Object.isFrozen(changed.entries[0])).toBe(true);
  });
  it("returns identical output for explicit identical timestamps and operations", () => {
    expect(JSON.stringify(record())).toBe(JSON.stringify(record()));
  });
  it("does not infer an event timestamp", () => {
    expect(() => recordCorrectionActivity(start(), "APPLY", operation, "")).toThrow(/timestamp/);
  });
  it("rejects invalid/noncanonical timestamps", () => {
    for (const value of ["yesterday", "2026-13-19T14:00:00.000Z", "2026-10-19T14:00:00Z", "2026-10-19T14:00:00.000+00:00"]) {
      expect(() => recordCorrectionActivity(start(), "APPLY", operation, value)).toThrow(/timestamp/);
    }
  });
  it("rejects made-up/no-op operations", () => {
    expect(() => recordCorrectionActivity(start(), "APPLY", { ...operation, correctedValue: "99" }, now)).toThrow(/actual applied/);
  });
  it("rejects invalid rows/operation sequences", () => {
    expect(() => recordCorrectionActivity(start(), "APPLY", { ...operation, rowNumber: 0 }, now)).toThrow();
    expect(() => recordCorrectionActivity(start(), "APPLY", { ...operation, sequence: 0 }, now)).toThrow();
  });
  it("rejects unsupported action types at runtime", () => {
    expect(() => recordCorrectionActivity(start(), "ERASE" as "UNDO", operation, now)).toThrow(/Unsupported/);
  });
  it("preserves exact multiline text as data (not HTML execution)", () => {
    const data = recordCorrectionActivity(start(), "APPLY", { ...operation, previousValue: "<img src=x>", correctedValue: "Ali\nKhan" }, now);
    expect(data.entries[0].beforeValue).toBe("<img src=x>");
    expect(data.entries[0].afterValue).toBe("Ali\nKhan");
  });
  it("discards oldest events after the disclosed 1000-entry cap without reusing IDs", () => {
    let state = start();
    for (let i = 0; i < MAX_RECENT_CORRECTION_EVENTS + 2; i++) state = recordCorrectionActivity(state, "APPLY", operation, now);
    expect(state.entries).toHaveLength(MAX_RECENT_CORRECTION_EVENTS);
    expect(state.entries[0].id).toBe(3);
    expect(state.entries.at(-1)?.id).toBe(MAX_RECENT_CORRECTION_EVENTS + 2);
  });
  it("a fresh correction session starts with empty activity", () => {
    expect(start().entries).toHaveLength(0);
    expect(start()).not.toBe(record());
  });
});
