// Field-type validation, relational rules aur results aggregation

import { suggestImportOrder, validateDatasets, type Dataset, type Issue, type Report } from "./engine";
import type { ParsedCsv } from "../csv/parser";

export type FieldType = "string" | "integer" | "number" | "boolean" | "date" | "email";
export type DatasetRules = {
  primaryKey: string;
  required: string[];
  types: Record<string, FieldType>;
};
export type Relationship = {
  childDataset: string;
  childColumn: string;
  parentDataset: string;
  parentColumn: string;
};
export type ValidationIssue = Issue | Omit<Issue, "code"> & { code: "INVALID_TYPE" };
export type ValidationResult = {
  report: Omit<Report, "issues"> & { issues: ValidationIssue[] };
  order: string[];
  cycles: string[];
};

function matchesType(value: string, type: FieldType): boolean {
  if (type === "string") return true;
  if (type === "integer") return /^[-+]?\d+$/.test(value);
  if (type === "number") return value !== "" && Number.isFinite(Number(value));
  if (type === "boolean") return /^(true|false)$/i.test(value);
  if (type === "email") return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  if (type === "date") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split("-").map(Number);
    const actual = new Date(Date.UTC(year, month - 1, day));
    return actual.getUTCFullYear() === year &&
      actual.getUTCMonth() + 1 === month && actual.getUTCDate() === day;
  }
  return false;
}

export function runValidation(
  datasets: ParsedCsv[],
  rules: Record<string, DatasetRules>,
  relationships: Relationship[]
): ValidationResult {
  if (new Set(datasets.map((dataset) => dataset.name)).size !== datasets.length) {
    throw new Error("Two uploaded files have the same dataset name");
  }
  const byName = new Map(datasets.map((dataset) => [dataset.name, dataset]));
  for (const dataset of datasets) {
    const rule = rules[dataset.name];
    if (!rule) throw new Error(`Missing rules for ${dataset.name}`);
    for (const column of [rule.primaryKey, ...rule.required, ...Object.keys(rule.types)]) {
      if (column && !dataset.headers.includes(column)) {
        throw new Error(`${dataset.name}: rule references unknown column '${column}'`);
      }
    }
  }
  for (const relationship of relationships) {
    const child = byName.get(relationship.childDataset);
    const parent = byName.get(relationship.parentDataset);
    if (!child || !parent ||
        !child.headers.includes(relationship.childColumn) ||
        !parent.headers.includes(relationship.parentColumn)) {
      throw new Error("Relationship references an unknown dataset or column");
    }
  }

  const configured: Dataset[] = datasets.map((dataset) => ({
    name: dataset.name,
    rows: dataset.rows,
    primaryKey: rules[dataset.name].primaryKey || undefined,
    required: rules[dataset.name].required,
    foreignKeys: relationships
      .filter((rel) => rel.childDataset === dataset.name)
      .map((rel) => ({
        column: rel.childColumn,
        targetDataset: rel.parentDataset,
        targetColumn: rel.parentColumn,
      })),
  }));

  const core = validateDatasets(configured);
  const issues: ValidationIssue[] = core.issues.map((issue) => {
    const dataset = byName.get(issue.dataset)!;
    return { ...issue, rowNumber: dataset.rowNumbers[issue.rowNumber - 2] ?? issue.rowNumber };
  });

  for (const dataset of datasets) {
    const types = rules[dataset.name].types;
    dataset.rows.forEach((row, index) => {
      for (const [column, type] of Object.entries(types)) {
        const value = (row[column] ?? "").trim();
        if (value !== "" && !matchesType(value, type)) {
          issues.push({
            dataset: dataset.name,
            rowNumber: dataset.rowNumbers[index],
            column,
            code: "INVALID_TYPE",
            message: `${column} must be a valid ${type}`,
          });
        }
      }
    });
  }

  const { order, cycles } = suggestImportOrder(configured);
  const invalidRows = new Set(issues.map((i) => `${i.dataset}\u0000${i.rowNumber}`)).size;
  return {
    report: {
      issues,
      totalRows: core.totalRows,
      validRows: core.totalRows - invalidRows,
      invalidRows,
      blocked: issues.length > 0 || cycles.length > 0,
    },
    order,
    cycles,
  };
}
