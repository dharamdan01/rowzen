import { afterEach, describe, expect, it, vi } from "vitest";
import { buildWorkspaceSchemaDescriptor } from "../../../src/lib/schema-diagram/descriptor";
import { DiagramExportError, prepareSchemaDiagramSvgExport, SVG_EXPORT_LIMITS } from "../../../src/lib/schema-diagram/export";
import * as svg from "../../../src/lib/schema-diagram/svg";
import * as layout from "../../../src/lib/schema-diagram/layout";
import { schemaDiagramInput, wideSchemaInput } from "../../fixtures/schema-diagram";
import type { WorkspaceSchemaDescriptor } from "../../../src/lib/schema-diagram/types";

const ready = (): WorkspaceSchemaDescriptor => ({ ...buildWorkspaceSchemaDescriptor(schemaDiagramInput()), validationStatus: "READY" });
afterEach(() => vi.restoreAllMocks());
describe("complete metadata-only SVG export", () => {
  it.each(["light", "dark"] as const)("creates a complete deterministic standalone %s file independent of the camera", theme => {
    const descriptor = ready(), before = JSON.stringify(descriptor);
    const file = prepareSchemaDiagramSvgExport(descriptor, theme, () => true), geometry = layout.layoutSchemaDiagram(descriptor);
    expect(file).toMatchObject({ filename: "datarehearsal-schema.svg", contentType: "image/svg+xml;charset=utf-8", draft: false });
    expect(file.content).toContain(`viewBox="0 0 ${geometry.width} ${geometry.height}"`);
    expect(file.content.match(/id="er-0-table-\d+"/g)).toHaveLength(3);
    expect(file.content.match(/id="er-0-table-\d+-column-\d+"/g)).toHaveLength(10);
    expect(file.content.match(/marker-end=/g)).toHaveLength(6);
    expect(file.content).toContain(theme === "dark" ? 'fill="#0b0d12"' : 'fill="#fafafb"');
    expect(prepareSchemaDiagramSvgExport(descriptor, theme, () => true)).toEqual(file); expect(JSON.stringify(descriptor)).toBe(before);
  });
  it.each(["CONFIG_ERROR", "BLOCKED", "NOT_EVALUATED"] as const)("marks %s as a draft in filename, visible title and description", validationStatus => {
    const file = prepareSchemaDiagramSvgExport({ ...ready(), validationStatus }, "light", () => true);
    expect(file.filename).toBe("datarehearsal-schema-draft.svg"); expect(file.draft).toBe(true);
    expect(file.content).toContain("DRAFT — Configured CSV schema"); expect(file.content).toContain("DRAFT schema snapshot"); expect(file.content).toContain(validationStatus);
  });
  it("retains all unresolved declarations and diagnostics in a marked draft", () => {
    const input = schemaDiagramInput();
    const descriptor = buildWorkspaceSchemaDescriptor({ ...input, relationships: [
      { childDataset: "people", childColumns: ["billing", "missing_child"], parentDataset: "addresses", parentColumns: ["id"] },
      { childDataset: "absent_dataset", childColumns: [], parentDataset: "addresses", parentColumns: [] },
    ] });
    const file = prepareSchemaDiagramSvgExport(descriptor, "dark", () => true);
    expect(file.draft).toBe(true); expect(file.content).toContain("missing_child"); expect(file.content).toContain("absent_dataset");
    expect(file.content).toContain("INVALID_FOREIGN_KEY"); expect(file.content).toContain("UNRESOLVED");
    expect(file.content.match(/id="er-0-fk-\d+"/g)).toHaveLength(2); expect(file.content.match(/marker-end=/g)).toHaveLength(1);
  });
  it("preserves warning status without inventing successful import claims", () => {
    const file = prepareSchemaDiagramSvgExport({ ...ready(), validationStatus: "READY_WITH_WARNINGS" }, "light", () => true);
    expect(file.content).toContain("READY_WITH_WARNINGS"); expect(file.content).toContain("database import success are not inferred");
  });
  it("rejects stale scope before layout work", () => {
    const spy = vi.spyOn(layout, "layoutSchemaDiagram");
    expect(() => prepareSchemaDiagramSvgExport(ready(), "light", () => false)).toThrow(DiagramExportError);
    expect(spy).not.toHaveBeenCalled();
  });
  it("rechecks freshness after complete serialization without returning a stale file", () => {
    const guard = vi.fn().mockReturnValueOnce(true).mockReturnValueOnce(false);
    expect(() => prepareSchemaDiagramSvgExport(ready(), "light", guard)).toThrow("schema changed"); expect(guard).toHaveBeenCalledTimes(2);
  });
  it("rejects empty and oversized configurations without partial export", () => {
    const descriptor = ready(), spy = vi.spyOn(layout, "layoutSchemaDiagram");
    expect(() => prepareSchemaDiagramSvgExport({ ...descriptor, datasets: [] }, "light", () => true)).toThrow("no configured tables");
    const entity = descriptor.datasets[0];
    expect(() => prepareSchemaDiagramSvgExport({ ...descriptor, datasets: [{ ...entity, columns: Array(SVG_EXPORT_LIMITS.columns + 1).fill(entity.columns[0]) }] }, "light", () => true)).toThrow("safe SVG export size");
    expect(() => prepareSchemaDiagramSvgExport({ ...descriptor, foreignKeys: [{ ...descriptor.foreignKeys[0], pairs: Array(SVG_EXPORT_LIMITS.pairs + 1).fill(descriptor.foreignKeys[0].pairs[0]) }] }, "light", () => true)).toThrow("safe SVG export size");
    expect(spy).not.toHaveBeenCalled();
  });
  it("bounds unusually long metadata before layout", () => {
    const descriptor = ready(), entity = descriptor.datasets[0]; const spy = vi.spyOn(layout, "layoutSchemaDiagram");
    expect(() => prepareSchemaDiagramSvgExport({ ...descriptor, datasets: [{ ...entity, name: "x".repeat(SVG_EXPORT_LIMITS.metadataCharacters + 1) }] }, "light", () => true)).toThrow("safe SVG export size");
    expect(spy).not.toHaveBeenCalled();
  });
  it("uses actual UTF-8 bytes for the final file limit", () => {
    vi.spyOn(svg, "renderSchemaDiagramSvg").mockReturnValue("地域".repeat(Math.ceil(SVG_EXPORT_LIMITS.bytes / 4)));
    expect(() => prepareSchemaDiagramSvgExport(ready(), "light", () => true)).toThrow("safe SVG export size");
  });
  it("exports all 1,000 columns within budget without truncation", () => {
    const file = prepareSchemaDiagramSvgExport(buildWorkspaceSchemaDescriptor(wideSchemaInput()), "dark", () => true);
    expect(file.content.match(/id="er-0-table-0-column-\d+"/g)).toHaveLength(1000); expect(file.content).toContain("column_0999");
    expect(file.height).toBeGreaterThan(36000);
  });
  it("escapes malicious labels as data and keeps filename, references and paints application-owned", () => {
    const input = schemaDiagramInput(), label = '</text><script>alert(1)</script><image href="https://attacker.invalid"/>';
    const descriptor = buildWorkspaceSchemaDescriptor({ ...input, mappings: { ...input.mappings, notes: [{ source: "body", target: label }] } });
    const file = prepareSchemaDiagramSvgExport(descriptor, "light", () => true);
    expect(file.content).toContain("&lt;script&gt;"); expect((file.content.match(/<[^>]*>/g) ?? []).join("")).not.toMatch(/<script|<image|<foreignObject|\shref=|\sonload=/);
    expect(file.filename).toMatch(/^datarehearsal-schema(-draft)?\.svg$/);
  });
  it("does not read row values, owner identity, history, prose, credentials or browser/network APIs", () => {
    const descriptor = ready();
    for (const property of ["rows", "history", "credentials", "identity", "issueProse", "toJSON"]) Object.defineProperty(descriptor, property, { get() { throw new Error("PRIVATE_READ"); } });
    const fetcher = vi.spyOn(globalThis, "fetch"), file = prepareSchemaDiagramSvgExport(descriptor, "light", () => true);
    expect(fetcher).not.toHaveBeenCalled(); expect(file.content).not.toMatch(/PRIVATE|configurationKey|correctionHistory/);
  });
});
