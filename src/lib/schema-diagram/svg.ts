import type { DiagramText, SchemaDiagramLayout } from "./layout";
import { themeTokens } from "../theme/tokens";

export interface SchemaSvgOptions {
  readonly theme?: "light" | "dark";
  readonly draft?: boolean;
  /** An owner-assigned instance number avoids ID collisions between inline diagrams. */
  readonly instanceId?: number;
}

/** XML 1.0 text only. Invalid XML code points are visibly replaced, never interpreted. */
export function escapeSvgText(value: string): string {
  return Array.from(value, character => {
    const point = character.codePointAt(0)!;
    if (!(point === 9 || point === 10 || point === 13 || point >= 0x20 && point <= 0xd7ff || point >= 0xe000 && point <= 0xfffd || point >= 0x10000 && point <= 0x10ffff)) return "\ufffd";
    return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;", "\r": "&#13;", "\t": "&#9;" } as Record<string, string>)[character] ?? character;
  }).join("");
}
function number(value: number): string {
  if (!Number.isFinite(value) || Math.abs(value) > 1e9) throw new Error("Schema diagram geometry is out of range.");
  return String(value);
}
function text(block: DiagramText, color: string, size = 13): string {
  return `<text fill="${color}" font-size="${size}" direction="ltr" unicode-bidi="isolate" xml:space="preserve">${block.lines.map((line, index) =>
    `<tspan x="${number(block.x)}" y="${number(block.y + index * 20)}">${escapeSvgText(line)}</tspan>`).join("")}</text>`;
}

/** Standalone native SVG, fixed vocabulary/attributes only; no HTML, external resources or browser APIs. */
export function renderSchemaDiagramSvg(layout: SchemaDiagramLayout, options: SchemaSvgOptions = {}): string {
  const theme = options.theme ?? "light", instance = options.instanceId ?? 0;
  if ((theme !== "light" && theme !== "dark") || !Number.isSafeInteger(instance) || instance < 0 ||
    (options.draft !== undefined && typeof options.draft !== "boolean")) throw new Error("Invalid schema diagram presentation options.");
  const title = options.draft ? "DRAFT — Configured CSV schema" : "Configured CSV schema";
  const palette = themeTokens[theme];
  const colors = { background: palette.background, surface: palette.surface, header: palette["info-surface"], text: palette.foreground,
    muted: palette["muted-foreground"], border: palette["control-border"], line: palette.primary, warning: palette.warning };
  const prefix = `er-${instance}`;
  const width = number(layout.width), height = number(layout.height);
  if (layout.width <= 0 || layout.height <= 0) throw new Error("Schema diagram bounds must be positive.");
  const description = [
    ...(options.draft ? ["DRAFT schema snapshot. Incomplete declarations and validation warnings are disclosed below. This is not import readiness approval."] : []),
    "Configured CSV schema. Arrows indicate column references. Cardinalities and database import success are not inferred.",
    `Configuration ${layout.configurationState}; validation ${layout.validationStatus}.`,
    ...layout.tables.flatMap(table => [`Table ${table.name}.`, ...table.columns.map(column =>
      `Source ${column.source}; target ${column.target ?? "(unmapped)"}; type ${column.type}; ${column.indicators.join(", ") || "no key or required indicators"}.`), ...table.constraints]),
    ...layout.notes,
  ].join("\n");
  const output = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="${prefix}-title" aria-describedby="${prefix}-description" font-family="ui-monospace, monospace">`,
    `<title id="${prefix}-title">${escapeSvgText(title)}</title><desc id="${prefix}-description">${escapeSvgText(description)}</desc>`,
    `<defs>${(["normal", "warning"] as const).map(tone => `<marker id="${prefix}-arrow-${tone}" viewBox="0 0 8 8" markerWidth="8" markerHeight="8" refX="8" refY="4" orient="auto" markerUnits="userSpaceOnUse"><path d="M 0 0 L 8 4 L 0 8 Z" fill="${tone === "normal" ? colors.line : colors.warning}"/></marker>`).join("")}</defs>`,
    `<rect x="0" y="0" width="${width}" height="${height}" fill="${colors.background}"/>`,
    text({ lines: [title], x: 32, y: 36 }, colors.text, 18),
    text({ lines: [`Configuration: ${layout.configurationState}; validation: ${layout.validationStatus}`, "PK: primary group; UQ: unique group; FK: reference and pair number", "Required: explicit field rule. FK arrows express references; cardinality unspecified."], x: 32, y: 60 }, colors.muted, 12),
  ];
  layout.relationships.forEach((relationship, index) => {
    output.push(`<g id="${prefix}-fk-${index}"><title>${escapeSvgText(relationship.detail)}</title>`);
    relationship.pairs.forEach((pair, pairIndex) => {
      const label = `${relationship.label}.${pair.position + 1}: ${pair.child.dataset}.${pair.child.target ?? "(missing)"} references ${pair.parent.dataset}.${pair.parent.target ?? "(missing)"}; ${pair.state}`;
      output.push(`<g id="${prefix}-fk-${index}-pair-${pairIndex}"><title>${escapeSvgText(label)}</title>`);
      if (pair.state === "DRAWN" && pair.points.length) {
        const path = pair.points.map((point, pointIndex) => `${pointIndex ? "L" : "M"} ${number(point.x)} ${number(point.y)}`).join(" ");
        const color = relationship.incomplete ? colors.warning : colors.line;
        output.push(`<path d="${path}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round"${relationship.incomplete ? ' stroke-dasharray="5 4"' : ""} marker-end="url(#${prefix}-arrow-${relationship.incomplete ? "warning" : "normal"})"/>`);
      }
      output.push("</g>");
    });
    output.push("</g>");
  });
  layout.tables.forEach((table, index) => {
    output.push(`<g id="${prefix}-table-${index}"><title>${escapeSvgText(table.name)}</title>`,
      `<rect x="${number(table.x)}" y="${number(table.y)}" width="${number(table.width)}" height="${number(table.height)}" rx="8" fill="${colors.surface}" stroke="${colors.border}"/>`,
      `<rect x="${number(table.x + 1)}" y="${number(table.y + 1)}" width="${number(table.width - 2)}" height="${number(table.headerHeight - 1)}" rx="7" fill="${colors.header}"/>`,
      text(table.nameText, colors.text, 14));
    table.columns.forEach((column, columnIndex) => {
      output.push(`<g id="${prefix}-table-${index}-column-${columnIndex}"><title>${escapeSvgText(`Source: ${column.source}; target: ${column.target ?? "(unmapped)"}; type: ${column.type}; ${column.indicators.join(", ")}`)}</title>`,
        `<path d="M ${number(table.x)} ${number(column.y)} H ${number(table.x + table.width)}" stroke="${colors.border}" stroke-width="0.5"/>`,
        text(column.nameText, colors.text), text(column.typeText, colors.muted), text(column.indicatorText, colors.line, 12), "</g>");
    });
    output.push(text(table.constraintText, colors.muted, 12), "</g>");
  });
  output.push(text(layout.noteText, colors.muted, 12), "</svg>");
  return output.join("");
}
