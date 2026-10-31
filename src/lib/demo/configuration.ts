import { readCsvFile, type ParsedCsv } from "../csv/parser";
import type { FieldType, Relationship } from "../rehearsal/rules";
import type { WhatIfConfiguration } from "../corrections/what-if";
import { identityMapping } from "../rehearsal/mapping";

export const DEMO_MAX_FILES = 2;
export const DEMO_TYPES = ["string", "integer", "number", "boolean", "date", "email"] as const;
export type DemoColumn = { column: string; type: FieldType | ""; required: boolean; primary: boolean; unique: boolean };
export type DemoSettings = { dataset: string; columns: DemoColumn[] };
export function emptyDemoSettings(datasets: readonly ParsedCsv[]): DemoSettings[] {
  return datasets.map(dataset => ({ dataset: dataset.name, columns: dataset.headers.map(column => ({ column, type: "", required: false, primary: false, unique: false })) }));
}
export async function readDemoFiles(files: readonly File[]): Promise<ParsedCsv[]> {
  if (!files.length || files.length > DEMO_MAX_FILES) throw new Error("Choose 1 or 2 CSV files, up to 1 MB each.");
  const datasets = await Promise.all(files.map(readCsvFile));
  if (new Set(datasets.map(dataset => dataset.name)).size !== datasets.length) throw new Error("Choose files with distinct dataset names.");
  return datasets;
}
export function demoConfiguration(datasets: readonly ParsedCsv[], settings: readonly DemoSettings[], relationships: readonly Relationship[]): WhatIfConfiguration {
  if (!datasets.length || settings.length !== datasets.length) throw new Error("Choose CSV files before configuring checks.");
  datasets.forEach((dataset, index) => {
    const current = settings[index];
    if (current.dataset !== dataset.name || current.columns.length !== dataset.headers.length || current.columns.some((column, i) =>
      column.column !== dataset.headers[i] || (column.type !== "" && !DEMO_TYPES.includes(column.type)))) throw new Error("Settings no longer match the current CSV headers.");
  });
  for (const relation of relationships) {
    const child = datasets.find(dataset => dataset.name === relation.childDataset);
    const parent = datasets.find(dataset => dataset.name === relation.parentDataset);
    if (!child?.headers.includes(relation.childColumn) || !parent?.headers.includes(relation.parentColumn)) throw new Error("Relationship no longer matches the selected files.");
  }
  return {
    mappings: Object.fromEntries(datasets.map(dataset => [dataset.name, identityMapping(dataset.headers)])),
    rules: Object.fromEntries(settings.map(setting => [setting.dataset, { primaryKey: "", required: setting.columns.filter(column => column.required).map(column => column.column), types: Object.fromEntries(setting.columns.flatMap(column => column.type ? [[column.column, column.type] as const] : [])) }])),
    keyRules: Object.fromEntries(settings.map(setting => [setting.dataset, { primaryKey: setting.columns.some(column => column.primary) ? setting.columns.filter(column => column.primary).map(column => column.column) : undefined, uniqueKeys: setting.columns.filter(column => column.unique).map(column => [column.column]) }])),
    relationships: [...relationships],
  };
}
export function hasDemoChecks(settings: readonly DemoSettings[], relationships: readonly Relationship[]): boolean {
  return relationships.length > 0 || settings.some(setting => setting.columns.some(column => column.type || column.required || column.primary || column.unique));
}
export function exampleDemoSettings(datasets: readonly ParsedCsv[]): { settings: DemoSettings[]; relationships: Relationship[] } | null {
  const students = datasets.find(dataset => dataset.name === "students");
  const departments = datasets.find(dataset => dataset.name === "departments");
  if (!students || !departments || !["id", "name", "department_id"].every(column => students.headers.includes(column)) || !["id", "name"].every(column => departments.headers.includes(column))) return null;
  return {
    settings: emptyDemoSettings(datasets).map(setting => ({ ...setting, columns: setting.columns.map(column => ({ ...column, primary: column.column === "id", required: column.column === "name" || (setting.dataset === "students" && column.column === "department_id") })) })),
    relationships: [{ childDataset: students.name, childColumn: "department_id", parentDataset: departments.name, parentColumn: "id" }],
  };
}
