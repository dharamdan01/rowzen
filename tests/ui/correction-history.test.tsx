import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import CorrectionHistory from "../../src/components/corrections/correction-history";
import CorrectionWorkspace from "../../src/components/corrections/correction-workspace";
import { createCorrectionActivityState, recordCorrectionActivity } from "../../src/lib/corrections/history";
import { createCorrectionState, applyCellCorrection } from "../../src/lib/corrections/engine";
import { parseCsvText } from "../../src/lib/csv/parser";

const operation = { sequence: 1, dataset: "students", rowNumber: 2, column: "name", previousValue: "Ali", correctedValue: "Sara" };
const time = "2026-10-19T14:15:00.000Z";
const html = (history = createCorrectionActivityState()) => renderToStaticMarkup(createElement(CorrectionHistory, { history }));

describe("Phase 8 S3 correction activity UI", () => {
  it("shows an accurate empty state, not fabricated activity", () => {
    expect(html()).toContain("No correction actions recorded for this filter.");
    expect(html()).toContain("0 recorded actions");
  });
  it("shows the real physical CSV line, field, before and after values", () => {
    const markup = html(recordCorrectionActivity(createCorrectionActivityState(), "APPLY", operation, time));
    expect(markup).toContain("CSV line 2");
    expect(markup).toContain("students");
    expect(markup).toContain("column name");
    expect(markup).toContain("Ali");
    expect(markup).toContain("Sara");
    expect(markup).toMatch(new RegExp(`datetime="${time}"`, "i"));
  });
  it("labels undo actions and actual reversal", () => {
    const markup = html(recordCorrectionActivity(createCorrectionActivityState(), "UNDO", operation, time));
    expect(markup).toContain("Undone");
    expect(markup).toContain("Change #1");
  });
  it("escapes malicious user-provided values, never executing them", () => {
    const markup = html(recordCorrectionActivity(createCorrectionActivityState(), "APPLY", { ...operation, correctedValue: "<img src=x onerror=alert(1)>" }, time));
    expect(markup).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(markup).not.toContain("<img src=x");
  });
  it("only shows up to ten recent history items on its first page", () => {
    let state = createCorrectionActivityState();
    for (let i = 0; i < 12; i++) state = recordCorrectionActivity(state, "APPLY", { ...operation, sequence: i + 1 }, time);
    const markup = html(state);
    expect(markup).toContain("Page 1 of 2");
    expect(markup).toContain("Change #12");
    expect(markup).not.toContain("Change #1</span>");
  });
  it("integrates the history and restore-original affordance into correction workspace", () => {
    const csv = parseCsvText("id,name\n1,Ali", "students.csv");
    const state = applyCellCorrection(createCorrectionState([csv]), { dataset: "students", rowNumber: 2, column: "name", value: "Sara" });
    const markup = renderToStaticMarkup(createElement(CorrectionWorkspace, {
      state, issues: [], mappings: { students: [{ source: "name", target: "name" }] },
      onApprove: () => {}, onUndo: () => {}, onRedo: () => {}, onDiscard: () => {},
    }));
    expect(markup).toContain("Correction activity history");
    expect(markup).toContain("Discard corrections");
    expect(markup).toContain("Undo next: students, line 2, name");
  });
});
