import type { SchemaColumnReference, WorkspaceSchemaDescriptor } from "./types";

export interface DiagramPoint { readonly x: number; readonly y: number }
export interface DiagramText { readonly lines: readonly string[]; readonly x: number; readonly y: number }
export interface DiagramColumn {
  readonly descriptorId: string;
  readonly source: string;
  readonly target: string | null;
  readonly type: string;
  readonly indicators: readonly string[];
  readonly y: number;
  readonly height: number;
  readonly nameText: DiagramText;
  readonly typeText: DiagramText;
  readonly indicatorText: DiagramText;
}
export interface DiagramTable {
  readonly descriptorId: string;
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly headerHeight: number;
  readonly nameText: DiagramText;
  readonly columns: readonly DiagramColumn[];
  readonly constraints: readonly string[];
  readonly constraintText: DiagramText;
}
export interface DiagramRelationshipPair {
  readonly position: number;
  readonly child: SchemaColumnReference;
  readonly parent: SchemaColumnReference;
  readonly state: "DRAWN" | "UNRESOLVED";
  readonly points: readonly DiagramPoint[];
}
export interface DiagramRelationship {
  readonly descriptorId: string;
  readonly label: string;
  readonly detail: string;
  readonly incomplete: boolean;
  readonly pairs: readonly DiagramRelationshipPair[];
}
export interface SchemaDiagramLayout {
  readonly version: 1;
  readonly width: number;
  readonly height: number;
  readonly configurationState: WorkspaceSchemaDescriptor["configurationState"];
  readonly validationStatus: WorkspaceSchemaDescriptor["validationStatus"];
  readonly tables: readonly DiagramTable[];
  readonly relationships: readonly DiagramRelationship[];
  readonly notes: readonly string[];
  readonly noteText: DiagramText;
}

const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const MARGIN = 32, TABLE_WIDTH = 720, LINE_HEIGHT = 20, PORT_SPACING = 8, LANE_SPACING = 18;

/** Conservative monospace units, with wide/non-ASCII glyphs given extra room. No truncation. */
export function wrapDiagramLabel(label: string, units: number): string[] {
  const lines: string[] = [];
  let line = "", used = 0;
  for (const character of Array.from(label)) {
    if (character === "\n" || character === "\r") { lines.push(line); line = ""; used = 0; continue; }
    const width = character.codePointAt(0)! > 0xff ? 2 : character === "\t" ? 4 : 1;
    if (used + width > units && line) { lines.push(line); line = ""; used = 0; }
    line += character; used += width;
  }
  lines.push(line);
  return lines;
}

function freeze<T>(value: T): T {
  if (value && typeof value === "object") { for (const child of Object.values(value)) freeze(child); Object.freeze(value); }
  return value;
}
function copyReference(ref: SchemaColumnReference): SchemaColumnReference {
  return { dataset: ref.dataset, target: ref.target, datasetId: ref.datasetId, columnId: ref.columnId, state: ref.state };
}
function endpointLabel(ref: SchemaColumnReference): string {
  return `${ref.dataset}.${ref.target === null ? "(missing component)" : ref.target} [${ref.state}]`;
}

/** Variable-height tables stack in a stable column; relationship lanes stay outside every node. */
export function layoutSchemaDiagram(descriptor: WorkspaceSchemaDescriptor): SchemaDiagramLayout {
  const datasets = [...descriptor.datasets].sort((a, b) => compare(a.id, b.id));
  const fks = [...descriptor.foreignKeys].sort((a, b) => compare(a.id, b.id));
  const keys = [...descriptor.keys].sort((a, b) => compare(a.id, b.id));
  const memberships = new Map<string, string[]>(), endpointCounts = new Map<string, number>();
  const keyLabels = new Map<string, string>();
  let pk = 0, unique = 0;
  for (const key of keys) keyLabels.set(key.id, key.kind === "PRIMARY" ? `PK${++pk}` : `UQ${++unique}`);
  const knownColumns = new Map(datasets.flatMap(dataset => dataset.columns.map(column => [column.id, dataset.id] as const)));
  const resolvable = (ref: SchemaColumnReference) => ref.state === "RESOLVED" && ref.columnId !== null && knownColumns.has(ref.columnId) && knownColumns.get(ref.columnId) === ref.datasetId;
  const drawable = (pair: { child: SchemaColumnReference; parent: SchemaColumnReference }) => resolvable(pair.child) && resolvable(pair.parent);
  fks.forEach((fk, index) => {
    for (const pair of [...fk.pairs].sort((a, b) => a.position - b.position)) {
      if (resolvable(pair.child)) {
        const labels = memberships.get(pair.child.columnId!) ?? [];
        labels.push(`FK${index + 1}.${pair.position + 1}`); memberships.set(pair.child.columnId!, labels);
      }
      if (drawable(pair)) for (const ref of [pair.child, pair.parent]) endpointCounts.set(ref.columnId!, (endpointCounts.get(ref.columnId!) ?? 0) + 1);
    }
  });
  let y = 128;
  const tables: DiagramTable[] = datasets.map(dataset => {
    const top = y, nameLines = wrapDiagramLabel(dataset.name, 80), headerHeight = nameLines.length * LINE_HEIGHT + 24;
    y += headerHeight;
    const columns = dataset.columns.map(column => {
      const indicators = [...column.primaryKeyIds.map(key => keyLabels.get(key)).filter((label): label is string => Boolean(label)),
        ...column.uniqueKeyIds.map(key => keyLabels.get(key)).filter((label): label is string => Boolean(label)),
        ...(memberships.get(column.id) ?? []), ...(column.explicitlyRequired ? ["Required"] : [])];
      const name = wrapDiagramLabel(column.target ?? `${column.source} (unmapped)`, 40);
      const type = wrapDiagramLabel(column.typeLabel, 17), badges = wrapDiagramLabel(indicators.join(" "), 23);
      const height = Math.max(Math.max(name.length, type.length, badges.length) * LINE_HEIGHT + 16,
        (endpointCounts.get(column.id) ?? 0) * PORT_SPACING + 16);
      const rowY = y; y += height;
      return { descriptorId: column.id, source: column.source, target: column.target, type: column.typeLabel, indicators, y: rowY, height,
        nameText: { lines: name, x: MARGIN + 16, y: rowY + 23 }, typeText: { lines: type, x: MARGIN + 358, y: rowY + 23 },
        indicatorText: { lines: badges, x: MARGIN + 510, y: rowY + 23 } };
    });
    const constraints = keys.filter(key => key.dataset === dataset.name).map(key =>
      `${keyLabels.get(key.id)} ${JSON.stringify(key.declaredColumns)}${key.effective ? "" : " (not effective)"}`);
    const detailLines = [dataset.mappingStatus === "APPLIED" ? "Applied mappings" : "Unresolved mappings", ...constraints]
      .flatMap(label => wrapDiagramLabel(label, 80));
    const constraintText = { lines: detailLines, x: MARGIN + 16, y: y + 23 };
    y += detailLines.length * LINE_HEIGHT + 16;
    const table = { descriptorId: dataset.id, name: dataset.name, x: MARGIN, y: top, width: TABLE_WIDTH,
      height: y - top, headerHeight, nameText: { lines: nameLines, x: MARGIN + 16, y: top + 27 }, columns, constraints, constraintText };
    y += 48;
    return table;
  });
  const locations = new Map(tables.flatMap(table => table.columns.map(column => [column.descriptorId, { table, column }] as const)));
  const nextPort = new Map<string, number>();
  const port = (ref: SchemaColumnReference): DiagramPoint => {
    const { table, column } = locations.get(ref.columnId!)!;
    const index = nextPort.get(ref.columnId!) ?? 0; nextPort.set(ref.columnId!, index + 1);
    return { x: table.x + table.width, y: column.y + column.height / 2 + (index - ((endpointCounts.get(ref.columnId!) ?? 1) - 1) / 2) * PORT_SPACING };
  };
  let lane = 0;
  const relationships = fks.map((fk, index) => {
    const pairs = [...fk.pairs].sort((a, b) => a.position - b.position).map(pair => {
      const child = copyReference(pair.child), parent = copyReference(pair.parent);
      if (!drawable(pair)) return { position: pair.position, child, parent, state: "UNRESOLVED" as const, points: [] };
      const start = port(child), end = port(parent), x = MARGIN + TABLE_WIDTH + 32 + lane++ * LANE_SPACING;
      return { position: pair.position, child, parent, state: "DRAWN" as const, points: [start, { x, y: start.y }, { x, y: end.y }, end] };
    });
    const incomplete = pairs.some(pair => pair.state === "UNRESOLVED") || pairs.length === 0 || descriptor.diagnostics.some(diagnostic => diagnostic.subjectId === fk.id);
    return { descriptorId: fk.id, label: `FK${index + 1}`, incomplete, pairs,
      detail: `FK${index + 1}: ${fk.childDataset} ${JSON.stringify(fk.declaredChildColumns)} references ${fk.parentDataset} ${JSON.stringify(fk.declaredParentColumns)}${incomplete ? " (incomplete declaration)" : ""}` };
  });
  const notes = [
    ...relationships.flatMap(fk => [fk.detail, ...fk.pairs.filter(pair => pair.state === "UNRESOLVED").map(pair =>
      `${fk.label}.${pair.position + 1} unresolved: ${endpointLabel(pair.child)} references ${endpointLabel(pair.parent)}`)]),
    ...[...descriptor.diagnostics].sort((a, b) => compare(a.id, b.id)).map(diagnostic => `Configuration: ${diagnostic.code}${diagnostic.preflightCode ? ` / ${diagnostic.preflightCode}` : ""}${diagnostic.dataset === null ? "" : `; dataset ${diagnostic.dataset}`}${diagnostic.column === null ? "" : `; column ${diagnostic.column}`}`),
    ...datasets.filter(dataset => dataset.mappingStatus !== "APPLIED").flatMap(dataset => dataset.mappings.map(entry => `Unresolved mapping in ${dataset.name}: ${JSON.stringify(entry.source)} to ${JSON.stringify(entry.target)}`)),
    ...descriptor.unresolvedMappings.flatMap(group => group.mappings.map(entry => `Orphan mapping in ${group.dataset}: ${JSON.stringify(entry.source)} to ${JSON.stringify(entry.target)}`)),
    ...descriptor.fieldRules.filter(rule => rule.column.state !== "RESOLVED").map(rule => `Unresolved field rule: ${endpointLabel(rule.column)}; type ${rule.typeLabel}; explicitly required ${rule.explicitlyRequired}`),
    ...keys.filter(key => !datasets.some(dataset => dataset.name === key.dataset)).map(key => `Unresolved ${keyLabels.get(key.id)} in ${key.dataset}: ${JSON.stringify(key.declaredColumns)}`),
  ];
  if (!tables.length) notes.unshift("No configured datasets to draw.");
  if (!relationships.length) notes.unshift("No foreign-key relationships configured.");
  const noteText = { lines: notes.flatMap(note => wrapDiagramLabel(note, 86)), x: MARGIN, y: y + 24 };
  return freeze({ version: 1, width: MARGIN * 2 + TABLE_WIDTH + (lane ? 32 + (lane - 1) * LANE_SPACING + 24 : 0),
    height: noteText.y + noteText.lines.length * LINE_HEIGHT + MARGIN, configurationState: descriptor.configurationState,
    validationStatus: descriptor.validationStatus, tables, relationships, notes, noteText });
}
