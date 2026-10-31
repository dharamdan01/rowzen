import type { ParsedCsv } from "../csv/parser";
import type { ColumnMapping } from "../rehearsal/mapping";
import type { DatasetRules, Relationship } from "../rehearsal/rules";
import type { CompositeForeignKey } from "../rehearsal/foreign-keys";
import { templateConfigurationSchema, type TemplateConfiguration } from "./schema";

export function captureTemplateConfiguration(args: {
  datasets: readonly ParsedCsv[];
  mappings: Record<string, ColumnMapping[]>;
  rules: Record<string, DatasetRules>;
  relationships: Relationship[];
  compositeRelationships: CompositeForeignKey[];
  primaryOverrides: Record<string, string>;
  uniqueSpecs: Record<string, string>;
}): TemplateConfiguration {
  // Explicit allowlist: never stringify ParsedCsv.rows, raw content or correction history.
  return templateConfigurationSchema.parse({
    version: 1,
    datasets: args.datasets.map((d) => ({ name: d.name, headers: [...d.headers] })),
    mappings: args.mappings,
    rules: args.rules,
    relationships: args.relationships,
    compositeRelationships: args.compositeRelationships,
    primaryOverrides: Object.fromEntries(args.datasets.map((d) => [d.name, args.primaryOverrides[d.name] ?? ""])),
    uniqueSpecs: Object.fromEntries(args.datasets.map((d) => [d.name, args.uniqueSpecs[d.name] ?? ""])),
  });
}

export function checkTemplateCompatibility(
  template: TemplateConfiguration,
  datasets: readonly Pick<ParsedCsv, "name" | "headers">[],
): { ok: true } | { ok: false; reason: string } {
  if (datasets.length !== template.datasets.length) {
    return { ok: false, reason: "The uploaded dataset count does not match this template." };
  }
  const current = new Map(datasets.map((d) => [d.name, d.headers]));
  for (const expected of template.datasets) {
    const headers = current.get(expected.name);
    if (!headers || headers.length !== expected.headers.length ||
        !expected.headers.every((h, i) => h === headers[i])) {
      return { ok: false, reason: `Dataset '${expected.name}' or its original header order does not match.` };
    }
  }
  return { ok: true };
}
