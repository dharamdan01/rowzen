import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import WhatIfPanel from "../../src/components/corrections/what-if-panel";
import CorrectionWorkspace from "../../src/components/corrections/correction-workspace";
import { parseCsvText } from "../../src/lib/csv/parser";
import { createCorrectionState } from "../../src/lib/corrections/engine";
import type { WhatIfPreview } from "../../src/lib/corrections/what-if";

const preview: WhatIfPreview = {
  kind: "PREDICTED_NOT_APPLIED",
  before: { status: "BLOCKED", totalDatasets: 2, totalRecords: 6, validRows: 4, invalidRows: 2, blockingErrors: 3, warnings: 0, totalIssues: 3 },
  predicted: { status: "BLOCKED", totalDatasets: 2, totalRecords: 6, validRows: 4, invalidRows: 2, blockingErrors: 2, warnings: 0, totalIssues: 2 },
  difference: { validRows: 0, invalidRows: 0, blockingErrors: -1, warnings: 0, totalIssues: -1 },
  resolvedIssueCount: 1, introducedIssueCount: 0,
};
const html = (p: WhatIfPreview = preview) => renderToStaticMarkup(createElement(WhatIfPanel, { preview: p }));

describe("Phase 8 S4 accessible predicted impact panel", () => {
  it("explicitly labels predicted results as not applied or verified", () => {
    expect(html()).toContain("What-if preview — predicted, not applied");
    expect(html()).toContain("Your data and correction history are unchanged");
    expect(html()).toContain("rerun validation");
  });
  it("renders truthfully separate invalid-row and issue counts", () => {
    const markup = html();
    expect(markup).toContain("Total issues");
    expect(markup).toContain("Invalid rows");
    expect(markup).toContain("3</td><td class=\"p-2 tabular-nums\">2");
  });
  it("preserves CONFIG_ERROR unknown row counts as Not evaluated", () => {
    const unknown: WhatIfPreview = {
      ...preview,
      predicted: { ...preview.predicted, status: "CONFIG_ERROR", validRows: null, invalidRows: null },
    };
    expect(html(unknown)).toContain("Not evaluated");
  });
  it("compact mode shows actual changed metrics without changing finding counts or the full default view", () => {
    const compact = renderToStaticMarkup(createElement(WhatIfPanel, { preview, compact: true }));
    expect(compact).toContain("Blocking errors"); expect(compact).toContain("Total issues");
    expect(compact).not.toContain('scope="row" class="p-2 font-medium">Total rows');
    expect(compact).toContain("Predicted resolved findings: 1; newly introduced findings: 0");
    expect(compact).toContain("Other metrics are unchanged");
    expect(html()).toContain("Total rows"); expect(preview.predicted.totalIssues).toBe(2);
  });
  it("escapes arbitrary status text rendered inside React markup", () => {
    const dangerous = { ...preview, predicted: { ...preview.predicted, status: "<img src=x onerror=alert(1)>" } } as unknown as WhatIfPreview;
    expect(html(dangerous)).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html(dangerous)).not.toContain("<img src=x");
  });
  it("existing workspace supports optional preview callback without breaking prior rendering", () => {
    const csv = parseCsvText("id,name\n1,Ali", "students.csv");
    const markup = renderToStaticMarkup(createElement(CorrectionWorkspace, {
      state: createCorrectionState([csv]), issues: [],
      mappings: { students: [{ source: "id", target: "id" }, { source: "name", target: "name" }] },
      onPreview: () => preview, previewContextKey: "configA",
      onApprove: () => {}, onUndo: () => {}, onRedo: () => {}, onDiscard: () => {},
    }));
    expect(markup).toContain("Data correction workspace");
    expect(markup).toContain("Correction activity history");
    expect(markup).not.toContain('data-testid="what-if-preview"');
  });
});
