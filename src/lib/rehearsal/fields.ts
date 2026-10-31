/**
 * Phase 6 field-level validation, independent of the legacy row engine.
 * Validation semantics intentionally match Phase 5 rules.ts for required/type
 * fields. Key-required checks are handled by keys.ts, to avoid duplicate issues.
 * No SQL execution and no raw cell values in issues.
 */
import type { ParsedCsv } from "../csv/parser";
import type { DatasetRules, FieldType } from "./rules";
import type { KeyConfiguration } from "./keys";
import { createIssue, finalizeIssues } from "./issues";
import type { RehearsalIssue } from "./types";

const compareText = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;

/** Same explicit supported type policy as the existing Phase 5 validator. */
export function matchesConfiguredType(value: string, type: FieldType): boolean {
  if (type === "string") return true;
  if (type === "integer") return /^[-+]?\d+$/.test(value);
  if (type === "number") return value !== "" && Number.isFinite(Number(value));
  if (type === "boolean") return /^(true|false)$/i.test(value);
  if (type === "email") return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  if (type === "date") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year &&
      date.getUTCMonth() + 1 === month && date.getUTCDate() === day;
  }
  return false;
}

/** Caller must have checked schema and physical row locations before this. */
export function validateRequiredAndTypes(
  datasets: readonly ParsedCsv[],
  rules: Readonly<Record<string, DatasetRules>>,
  keys: KeyConfiguration,
): RehearsalIssue[] {
  const issues: RehearsalIssue[] = [];
  for (const dataset of [...datasets].sort((a, b) => compareText(a.name, b.name))) {
    const rule = rules[dataset.name];
    if (!rule) throw new Error("Schema validation must run before field validation");
    const pkColumns = new Set(keys[dataset.name]?.primaryKey ?? []);
    const required = [...new Set(rule.required)].sort(compareText);
    const typed = Object.entries(rule.types).sort(([a], [b]) => compareText(a, b));
    for (let i = 0; i < dataset.rows.length; i++) {
      const row = dataset.rows[i];
      const rowNumber = dataset.rowNumbers[i];
      for (const column of required) {
        // The key validator emits REQUIRED for each empty PK component already.
        if (pkColumns.has(column) || (row[column] ?? "").trim() !== "") continue;
        issues.push(createIssue({
          code: "REQUIRED", severity: "ERROR", category: "DATA",
          dataset: dataset.name, rowNumber, column,
          ruleId: JSON.stringify(["field", "required", dataset.name, column]),
          explanation: `Required field '${column}' is empty on this row.`,
          suggestedInvestigation: "Supply the required value or update the declared schema requirement.",
        }));
      }
      for (const [column, type] of typed) {
        const value = (row[column] ?? "").trim();
        if (value === "" || matchesConfiguredType(value, type)) continue;
        issues.push(createIssue({
          code: "INVALID_TYPE", severity: "ERROR", category: "DATA",
          dataset: dataset.name, rowNumber, column,
          ruleId: JSON.stringify(["field", "type", dataset.name, column, type]),
          explanation: `Field '${column}' does not match the configured '${type}' format.`,
          suggestedInvestigation: "Check the CSV format and mapping; no automatic coercion is performed.",
        }));
      }
    }
  }
  return finalizeIssues(issues);
}
