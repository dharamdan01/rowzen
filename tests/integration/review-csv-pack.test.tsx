import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { relationshipPack, type ReviewPackKind } from "../fixtures/review-csv-pack";
import { revalidateCorrectionSnapshot } from "../../src/lib/corrections/revalidation";
import { buildWorkspaceSchemaDescriptor } from "../../src/lib/schema-diagram/descriptor";
import { layoutSchemaDiagram } from "../../src/lib/schema-diagram/layout";
import { renderSchemaDiagramSvg } from "../../src/lib/schema-diagram/svg";
import ReportAnalyticsDashboard from "../../src/components/reports/report-analytics-dashboard";
import RehearsalExecution from "../../src/components/upload/rehearsal-execution";

describe("Review presentation against supplied relationship CSVs", () => {
  it.each([
    ["composite", "READY", 6, 0, 1, 2],
    ["composite-invalid", "BLOCKED", 5, 1, 1, 2],
    ["parallel", "READY", 5, 0, 2, 2],
    ["cycle", "BLOCKED", 4, 0, 2, 2],
  ] as const)("preserves actual %s counts and all declared FK pairs", (kind, status, totalRows, invalidRows, foreignKeys, pairs) => {
    const {datasets, template, config} = relationshipPack(kind);
    const before = structuredClone(datasets);
    const {report, analytics} = revalidateCorrectionSnapshot(datasets, config);
    expect(report.status).toBe(status);
    expect(report.totals).toMatchObject({totalRows, invalidRows});
    const identity = {sessionId: 1, configurationKey: kind};
    const descriptor = buildWorkspaceSchemaDescriptor({...template, relationships: config.relationships, identity, validation: {identity, report}});
    const layout = layoutSchemaDiagram(descriptor);
    expect(layout.relationships).toHaveLength(foreignKeys);
    expect(layout.relationships.flatMap(fk => fk.pairs)).toHaveLength(pairs);
    const svg = renderSchemaDiagramSvg(layout);
    expect(svg.match(/marker-end=/g)).toHaveLength(pairs);
    expect(svg).not.toMatch(/Karachi|Lahore|Islamabad|CSE|Math/);
    const markup = renderToStaticMarkup(h(ReportAnalyticsDashboard, {analytics}));
    expect(markup).toContain(`Migration readiness: ${status}`);
    expect(analytics.summary.invalidRows).toBe(invalidRows);
    expect(datasets).toEqual(before);
  });
  it("keeps CONFIG_ERROR rows unevaluated rather than presenting them as valid zero", () => {
    const {datasets, config} = relationshipPack("parallel");
    const invalid = {...config, relationships: [{...config.relationships[0], parentColumn: "missing_endpoint"}]};
    const {report, analytics} = revalidateCorrectionSnapshot(datasets, invalid);
    expect(report.status).toBe("CONFIG_ERROR");
    expect(report.totals.validRows).toBeNull(); expect(report.totals.invalidRows).toBeNull();
    const markup = renderToStaticMarkup(h(ReportAnalyticsDashboard, {analytics}));
    expect(markup).toContain("Not evaluated");
    const execution = renderToStaticMarkup(h(RehearsalExecution, {report, datasetCount: 2, relationshipCount: 1, busy: false, error: "", onRun: () => {}}));
    expect(execution).toContain("Row validity was not evaluated"); expect(execution).toContain("Only configured checks are evaluated");
  });
  it("retains ordered composite components and distinct parallel column references", () => {
    for (const kind of ["composite", "parallel"] as ReviewPackKind[]) {
      const pack = relationshipPack(kind);
      const layout = layoutSchemaDiagram(buildWorkspaceSchemaDescriptor({...pack.template, relationships: pack.config.relationships, identity: {sessionId: 2, configurationKey: kind}}));
      const pairs = layout.relationships.flatMap(fk => fk.pairs);
      expect(pairs.map(pair => pair.child.target)).toEqual(kind === "composite" ? ["campus_id", "dept_id"] : ["billing_address_id", "shipping_address_id"]);
      expect(pairs.map(pair => pair.parent.target)).toEqual(kind === "composite" ? ["campus_id", "dept_id"] : ["address_id", "address_id"]);
    }
  });
});
