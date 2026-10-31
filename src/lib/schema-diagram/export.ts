import type { WorkspaceSchemaDescriptor } from "./types";
import { layoutSchemaDiagram } from "./layout";
import { renderSchemaDiagramSvg } from "./svg";

export const SVG_EXPORT_LIMITS = Object.freeze({ columns: 5000, pairs: 2000, metadataCharacters: 1_000_000, bytes: 8 * 1024 * 1024 });
export const diagramExportMessages = {
  STALE: "The schema changed or inspection is suspended. Generate a current diagram before downloading.",
  EMPTY: "There are no configured tables to export.",
  TOO_LARGE: "This diagram exceeds the safe SVG export size. Inspect the schema tables or export a smaller configuration. No partial file was downloaded.",
  FAILED: "Unable to start the SVG download. Check whether browser downloads are blocked, then retry.",
} as const;
export class DiagramExportError extends Error {
  constructor(readonly code: keyof typeof diagramExportMessages) { super(diagramExportMessages[code]); }
}
export function assertDiagramExportCurrent(isCurrent: () => boolean): void {
  if (!isCurrent()) throw new DiagramExportError("STALE");
}
function checkSize(descriptor: WorkspaceSchemaDescriptor) {
  if (!descriptor.datasets.length) throw new DiagramExportError("EMPTY");
  const columns = descriptor.datasets.reduce((count, dataset) => count + dataset.columns.length, 0);
  const pairs = descriptor.foreignKeys.reduce((count, fk) => count + fk.pairs.length, 0);
  if (columns > SVG_EXPORT_LIMITS.columns || pairs > SVG_EXPORT_LIMITS.pairs) throw new DiagramExportError("TOO_LARGE");
  // Explicit metadata fields only; never stringify a descriptor or read arbitrary extra properties.
  const labels = [
    ...descriptor.datasets.flatMap(dataset => [dataset.name, ...dataset.columns.flatMap(column => [column.source, column.target ?? ""]), ...dataset.mappings.flatMap(entry => [entry.source, entry.target])]),
    ...descriptor.keys.flatMap(key => [key.dataset, ...key.declaredColumns]),
    ...descriptor.foreignKeys.flatMap(fk => [fk.childDataset, fk.parentDataset, ...fk.declaredChildColumns, ...fk.declaredParentColumns]),
    ...descriptor.unresolvedMappings.flatMap(group => [group.dataset, ...group.mappings.flatMap(entry => [entry.source, entry.target])]),
    ...descriptor.fieldRules.flatMap(rule => [rule.column.dataset, rule.column.target ?? ""]),
    ...descriptor.diagnostics.flatMap(diagnostic => [diagnostic.dataset ?? "", diagnostic.column ?? ""]),
  ];
  if (labels.reduce((count, label) => count + label.length, 0) > SVG_EXPORT_LIMITS.metadataCharacters) throw new DiagramExportError("TOO_LARGE");
}

/** Rebuild the complete scene. The interactive DOM/camera and raw CSV are never inputs. */
export function prepareSchemaDiagramSvgExport(descriptor: WorkspaceSchemaDescriptor, theme: "light" | "dark", isCurrent: () => boolean) {
  assertDiagramExportCurrent(isCurrent); checkSize(descriptor);
  const draft = descriptor.configurationState !== "DESCRIBED" || ["CONFIG_ERROR", "BLOCKED", "NOT_EVALUATED"].includes(descriptor.validationStatus);
  const layout = layoutSchemaDiagram(descriptor), content = renderSchemaDiagramSvg(layout, { theme, draft });
  if (new TextEncoder().encode(content).byteLength > SVG_EXPORT_LIMITS.bytes) throw new DiagramExportError("TOO_LARGE");
  assertDiagramExportCurrent(isCurrent);
  return { filename: draft ? "datarehearsal-schema-draft.svg" : "datarehearsal-schema.svg", contentType: "image/svg+xml;charset=utf-8",
    content, draft, width: layout.width, height: layout.height } as const;
}
