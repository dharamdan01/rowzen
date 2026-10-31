// Source columns ko target columns se map karna

import type { ParsedCsv } from "../csv/parser";

export type ColumnMapping = { source: string; target: string };

export function identityMapping(headers: string[]): ColumnMapping[] {
  return headers.map((header) => ({ source: header, target: header }));
}

export function applyMapping(
  dataset: ParsedCsv,
  mapping: ColumnMapping[]
): ParsedCsv {
  if (mapping.length !== dataset.headers.length) {
    throw new Error(`${dataset.filename}: every source column must have a mapping`);
  }
  const sources = mapping.map((item) => item.source);
  const targets = mapping.map((item) => item.target.trim());
  if (
    sources.some((source) => !dataset.headers.includes(source)) ||
    new Set(sources).size !== dataset.headers.length
  ) {
    throw new Error(`${dataset.filename}: invalid or duplicate source mapping`);
  }
  if (targets.some((target) => !target)) {
    throw new Error(`${dataset.filename}: target column names cannot be empty`);
  }
  if (new Set(targets.map((target) => target.toLowerCase())).size !== targets.length) {
    throw new Error(`${dataset.filename}: duplicate target column names`);
  }
  return {
    ...dataset,
    headers: targets,
    rows: dataset.rows.map((row) =>
      Object.fromEntries(mapping.map((item) => [item.target.trim(), row[item.source] ?? ""]))
    ),
  };
}
