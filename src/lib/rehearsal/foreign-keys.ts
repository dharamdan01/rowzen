/**
 * Deterministic cross-file foreign-key preflight for mapped CSV datasets.
 * No database I/O. Exact, case-sensitive, trimmed-string key equality.
 * The default empty-field policy resembles SQL MATCH SIMPLE: if any child
 * component is empty, the FK comparison is skipped. Required-field rules
 * must separately check disallowed empty child cells.
 * Validates configuration before reporting any row-level FK findings.
 */
import type { ParsedCsv } from "../csv/parser";
import type { Relationship } from "./rules";
import type { DatasetKeyRules, KeyConfiguration } from "./keys";
import { createIssue, finalizeIssues } from "./issues";
import type { IssueCode, RehearsalIssue } from "./types";

export type ForeignKeyDataset = Pick<ParsedCsv, "name" | "headers" | "rows" | "rowNumbers">;

export type CompositeForeignKey = {
  childDataset: string;
  childColumns: readonly string[];
  parentDataset: string;
  parentColumns: readonly string[];
};

/** Accepts the existing Phase 5 single-column Relationship without changing it. */
export type ForeignKeyDeclaration = CompositeForeignKey | Relationship;

type NormalizedFK = {
  childDataset: string;
  childColumns: string[];
  parentDataset: string;
  parentColumns: string[];
  id: string;
};

function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function columnsMatch(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value, i) => value === b[i]);
}

/** Database constraint columns are compared as sets, but FK pairs are positional. */
function isDeclaredUnique(
  columns: readonly string[],
  rules: DatasetKeyRules | undefined,
): boolean {
  const expected = [...columns].sort(cmp);
  if (!rules) return false;
  const candidates = [rules.primaryKey, ...(rules.uniqueKeys ?? [])];
  return candidates.some(
    (candidate) => candidate && columnsMatch([...candidate].sort(cmp), expected),
  );
}

function normalize(raw: ForeignKeyDeclaration): NormalizedFK {
  const childColumns = "childColumns" in raw
    ? [...raw.childColumns].map((c) => c.trim())
    : [raw.childColumn.trim()];
  const parentColumns = "parentColumns" in raw
    ? [...raw.parentColumns].map((c) => c.trim())
    : [raw.parentColumn.trim()];
  const childDataset = raw.childDataset.trim();
  const parentDataset = raw.parentDataset.trim();
  return {
    childDataset, childColumns, parentDataset, parentColumns,
    id: JSON.stringify(["fk-v1", childDataset, childColumns, parentDataset, parentColumns]),
  };
}

function schemaIssue(
  code: IssueCode,
  dataset: string,
  column: string | null,
  ruleId: string,
  explanation: string,
  suggestedInvestigation: string,
): RehearsalIssue {
  return createIssue({
    code, category: "SCHEMA", severity: "ERROR",
    dataset: dataset || "(unnamed dataset)", rowNumber: null, column,
    ruleId, explanation, suggestedInvestigation,
  });
}

function configUnique(
  issues: RehearsalIssue[],
  seen: Set<string>,
  issue: RehearsalIssue,
): void {
  if (!seen.has(issue.id)) {
    seen.add(issue.id);
    issues.push(issue);
  }
}

/**
 * Checks declared single-/multi-column foreign keys using per-parent lookup
 * indexes. Parent target must be declared as primary/unique by Subfeature 3.
 * Actual duplicates in that parent key are checked separately by keys.ts.
 * This module never claims target-DB SQL constraint equivalence.
 */
export function validateForeignKeys(
  datasets: readonly ForeignKeyDataset[],
  declarations: readonly ForeignKeyDeclaration[],
  keyRules: KeyConfiguration,
): RehearsalIssue[] {
  const issues: RehearsalIssue[] = [];
  const seenConfig = new Set<string>();
  const byName = new Map<string, ForeignKeyDataset>();
  const duplicateDatasets = new Set<string>();

  for (const dataset of datasets) {
    const name = dataset.name.trim();
    if (!name) {
      configUnique(issues, seenConfig, schemaIssue(
        "BAD_SCHEMA", "(unnamed dataset)", null, "fk:empty-dataset-name",
        "A foreign-key dataset has an empty name.",
        "Assign a nonempty, unique dataset name.",
      ));
    } else if (byName.has(name)) duplicateDatasets.add(name);
    else byName.set(name, dataset);
  }

  for (const name of [...duplicateDatasets].sort(cmp)) {
    configUnique(issues, seenConfig, schemaIssue(
      "BAD_SCHEMA", name, null, JSON.stringify(["fk", name, "duplicate-dataset"]),
      `Dataset '${name}' appears more than once.`,
      "Remove or rename duplicated datasets.",
    ));
  }

  const seenRules = new Set<string>();
  const valid: NormalizedFK[] = [];
  for (const relation of declarations.map(normalize).sort((a, b) => cmp(a.id, b.id))) {
    const { childDataset, childColumns, parentDataset, parentColumns, id } = relation;
    const column = childColumns.length === 1 ? childColumns[0] : null;
    const add = (
      code: IssueCode,
      field: string | null,
      suffix: string,
      explanation: string,
      investigation: string,
      dataset = childDataset,
    ) => configUnique(issues, seenConfig, schemaIssue(
      code, dataset, field, JSON.stringify([id, suffix]), explanation, investigation,
    ));

    if (seenRules.has(id)) {
      add("BAD_SCHEMA", column, "duplicate-declaration",
        "This foreign-key relationship is declared more than once.",
        "Keep one declaration for each foreign-key relationship.");
      continue;
    }
    seenRules.add(id);

    if (!childDataset || !parentDataset || !childColumns.length ||
        !parentColumns.length || childColumns.length !== parentColumns.length ||
        [...childColumns, ...parentColumns].some((c) => !c)) {
      add("BAD_SCHEMA", column, "invalid-columns",
        "Foreign-key dataset names and paired, nonempty column lists are required.",
        "Use equally sized child/parent column lists with nonempty names.");
      continue;
    }

    if (new Set(childColumns).size !== childColumns.length ||
        new Set(parentColumns).size !== parentColumns.length) {
      add("BAD_SCHEMA", column, "duplicate-column",
        "A foreign-key declaration repeats a column.",
        "Include each key column only once on each side.");
      continue;
    }

    const child = byName.get(childDataset);
    const parent = byName.get(parentDataset);
    if (!child) {
      add("MISSING_REFERENCE_DATASET", column, "missing-child",
        `Child dataset '${childDataset}' is not supplied.`,
        "Upload the child dataset or remove the relationship.");
    }
    if (!parent) {
      add("MISSING_REFERENCE_DATASET", column, "missing-parent",
        `Parent dataset '${parentDataset}' is not supplied.`,
        "Upload the referenced parent dataset or correct the relationship.");
    }
    if (!child || !parent || duplicateDatasets.has(childDataset) ||
        duplicateDatasets.has(parentDataset)) continue;

    let missing = false;
    for (const field of childColumns) {
      if (!child.headers.includes(field)) {
        missing = true;
        add("BAD_SCHEMA", field, `missing-child-column:${field}`,
          `Child column '${childDataset}.${field}' does not exist.`,
          "Review the child dataset headers and column mapping.");
      }
    }
    for (const field of parentColumns) {
      if (!parent.headers.includes(field)) {
        missing = true;
        add("BAD_SCHEMA", field, `missing-parent-column:${field}`,
          `Parent column '${parentDataset}.${field}' does not exist.`,
          "Review the parent dataset headers and column mapping.", parentDataset);
      }
    }
    if (missing) continue;

    if (!isDeclaredUnique(parentColumns, keyRules[parentDataset])) {
      add("FK_TARGET_NOT_UNIQUE", column, "nonunique-target",
        `Parent columns (${parentColumns.join(", ")}) are not a declared primary/unique key in '${parentDataset}'.`,
        "Declare a matching primary/unique key on the parent dataset and validate its data.");
      continue;
    }

    // Parent and child row location arrays must match parsed content exactly.
    for (const [name, dataset] of [[childDataset, child], [parentDataset, parent]] as const) {
      if (dataset.rows.length !== dataset.rowNumbers.length ||
          new Set(dataset.rowNumbers).size !== dataset.rowNumbers.length ||
          dataset.rowNumbers.some((line) => !Number.isSafeInteger(line) || line < 1)) {
        add("BAD_SCHEMA", null, `bad-row-numbers:${name}`,
          `Dataset '${name}' has missing, repeated, or invalid CSV row locations.`,
          "Reparse the CSV to preserve one physical start line per data record.", name);
        missing = true;
      }
    }
    if (!missing) valid.push(relation);
  }

  // Do not mix speculative row findings with invalid configuration findings.
  if (issues.length) return finalizeIssues(issues);

  const indexes = new Map<string, Set<string>>();
  for (const relation of valid) {
    const indexId = JSON.stringify([relation.parentDataset, relation.parentColumns]);
    if (indexes.has(indexId)) continue;
    const parent = byName.get(relation.parentDataset)!;
    const values = new Set<string>();
    for (const row of parent.rows) {
      const tuple = relation.parentColumns.map((col) => (row[col] ?? "").trim());
      if (tuple.some((part) => !part)) continue;
      values.add(JSON.stringify(tuple));
    }
    indexes.set(indexId, values);
  }

  for (const relation of valid) {
    const child = byName.get(relation.childDataset)!;
    const indexId = JSON.stringify([relation.parentDataset, relation.parentColumns]);
    const parentIndex = indexes.get(indexId)!;
    for (let rowIndex = 0; rowIndex < child.rows.length; rowIndex++) {
      const tuple = relation.childColumns.map((field) =>
        (child.rows[rowIndex][field] ?? "").trim(),
      );
      // Explicit MATCH SIMPLE-like policy; no claims about actual SQL execution.
      if (tuple.some((part) => !part)) continue;
      if (parentIndex.has(JSON.stringify(tuple))) continue;
      issues.push(createIssue({
        code: "FK_NOT_FOUND", severity: "ERROR", category: "DATA",
        dataset: relation.childDataset,
        rowNumber: child.rowNumbers[rowIndex],
        column: relation.childColumns.length === 1 ? relation.childColumns[0] : null,
        ruleId: relation.id,
        explanation: `No matching parent record exists in '${relation.parentDataset}' for the configured foreign key.`,
        suggestedInvestigation: "Check the parent CSV, key mapping and referenced values. Import the parent dataset before the child.",
        referencedRecords: [], relatedIssueIds: [],
      }));
    }
  }
  return finalizeIssues(issues);
}
