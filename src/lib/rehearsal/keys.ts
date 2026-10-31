/**
 * Deterministic key preflight for mapped CSV datasets.
 * Opt-in Phase 6 module. Existing Phase 5 engine is intentionally unchanged.
 * This is NOT a PostgreSQL UNIQUE/PRIMARY KEY execution simulator.
 */
import type { ParsedCsv } from "../csv/parser";
import { createIssue, finalizeIssues, type IssueDraft } from "./issues";
import type { IssueCode, RehearsalIssue } from "./types";

export type KeyDataset = Pick<ParsedCsv, "name" | "headers" | "rows" | "rowNumbers">;

export type DatasetKeyRules = {
  /** Single-column primary key: ["id"]. Composite: ["country", "code"]. */
  primaryKey?: readonly string[];
  /** Each inner array defines an independent unique constraint. */
  uniqueKeys?: readonly (readonly string[])[];
};

export type KeyConfiguration = Readonly<Record<string, DatasetKeyRules>>;

type Constraint = { kind: "primary" | "unique"; columns: string[]; ruleId: string };

function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function reportConfigError(
  dataset: string,
  column: string | null,
  ruleId: string,
  explanation: string,
  suggestedInvestigation: string,
): RehearsalIssue {
  return createIssue({
    code: "BAD_SCHEMA",
    severity: "ERROR",
    category: "SCHEMA",
    dataset: dataset.trim() || "(unnamed dataset)",
    rowNumber: null,
    column,
    ruleId,
    explanation,
    suggestedInvestigation,
  });
}

function dataIssue(
  dataset: string,
  rowNumber: number,
  column: string | null,
  code: IssueCode,
  ruleId: string,
  explanation: string,
  suggestedInvestigation: string,
  referencedRecords: IssueDraft["referencedRecords"] = [],
  relatedIssueIds: string[] = [],
): RehearsalIssue {
  return createIssue({
    code,
    severity: "ERROR",
    category: "DATA",
    dataset,
    rowNumber,
    column,
    ruleId,
    explanation,
    suggestedInvestigation,
    referencedRecords,
    relatedIssueIds,
  });
}

/**
 * Checks required PK parts and duplicate primary/unique tuples.
 * Comparison is exact, case-sensitive after trim, with no numeric conversion.
 * UNIQUE: a row with any empty key component is skipped (declared MVP policy).
 * PRIMARY KEY: any empty component produces REQUIRED; incomplete tuples are not
 * compared for duplication.
 *
 * Dataset order and key-configuration order do not change the result.
 * Uses physical CSV line numbers supplied by the parser.
 */
export function validateKeyConstraints(
  datasets: readonly KeyDataset[],
  keyRules: KeyConfiguration,
): RehearsalIssue[] {
  const issues: RehearsalIssue[] = [];
  const known = new Map<string, KeyDataset>();
  const duplicates = new Set<string>();
  const reportedConfigIssues = new Set<string>();

  function addConfig(issue: RehearsalIssue) {
    if (reportedConfigIssues.has(issue.id)) return;
    reportedConfigIssues.add(issue.id);
    issues.push(issue);
  }

  for (const dataset of datasets) {
    if (!dataset.name.trim()) {
      addConfig(reportConfigError(
        "(unnamed dataset)", null, "keys:unnamed-dataset",
        "A dataset used for key validation has no name.",
        "Give each dataset a distinct nonempty name.",
      ));
      continue;
    }
    if (known.has(dataset.name)) duplicates.add(dataset.name);
    else known.set(dataset.name, dataset);
  }

  for (const name of [...duplicates].sort(cmp)) {
    addConfig(reportConfigError(
      name, null, JSON.stringify(["keys", name, "duplicate-dataset"]),
      `Dataset '${name}' occurs more than once; key validation is ambiguous.`,
      "Remove or rename duplicated datasets.",
    ));
  }

  for (const name of Object.keys(keyRules).sort(cmp)) {
    if (!known.has(name)) {
      addConfig(reportConfigError(
        name, null, JSON.stringify(["keys", name, "rules-without-dataset"]),
        `Key constraints refer to dataset '${name}', but no such dataset was supplied.`,
        "Upload the dataset or remove its key configuration.",
      ));
    }
  }

  for (const [name, dataset] of [...known].sort(([a], [b]) => cmp(a, b))) {
    if (duplicates.has(name)) continue;
    const config = keyRules[name];
    if (!config) continue; // Optional module; general schema checker handles missing rules.

    if (dataset.rows.length !== dataset.rowNumbers.length ||
        new Set(dataset.rowNumbers).size !== dataset.rowNumbers.length ||
        dataset.rowNumbers.some((n) => !Number.isSafeInteger(n) || n < 1)) {
      addConfig(reportConfigError(
        name, null, JSON.stringify(["keys", name, "bad-row-locations"]),
        "CSV row numbers are missing, repeated, or invalid.",
        "Reparse the original CSV and preserve one physical start line per row.",
      ));
      continue;
    }

    const headers = new Set(dataset.headers);
    const declared: Array<{ kind: "primary" | "unique"; columns: readonly string[] }> = [];
    if (config.primaryKey !== undefined) {
      declared.push({ kind: "primary", columns: config.primaryKey });
    }
    for (const columns of config.uniqueKeys ?? []) {
      declared.push({ kind: "unique", columns });
    }

    const constraints: Constraint[] = [];
    const seenUnique = new Set<string>();

    for (const declaration of declared) {
      const { kind } = declaration;
      const original = declaration.columns;
      const normalized = original.map((col) => col.trim()).sort(cmp);
      const identity = JSON.stringify(["key", name, kind, normalized]);

      if (original.length === 0 || normalized.some((col) => !col)) {
        addConfig(reportConfigError(
          name, null, JSON.stringify(["key-schema", "empty", identity]),
          `The ${kind} key for '${name}' must include nonempty columns.`,
          "Provide at least one valid column for the constraint.",
        ));
        continue;
      }

      if (new Set(normalized).size !== normalized.length) {
        addConfig(reportConfigError(
          name, null, JSON.stringify(["key-schema", "repeated-column", identity]),
          `The ${kind} key on '${name}' repeats a column.`,
          "Declare every key column only once.",
        ));
        continue;
      }

      const absent = normalized.filter((col) => !headers.has(col));
      if (absent.length) {
        for (const col of absent) {
          addConfig(reportConfigError(
            name, col, JSON.stringify(["key-schema", "missing-column", identity, col]),
            `Key column '${name}.${col}' is not present in the mapped CSV headers.`,
            "Correct the mapping or edit the key constraint.",
          ));
        }
        continue;
      }

      if (kind === "unique") {
        if (seenUnique.has(identity)) {
          addConfig(reportConfigError(
            name, null, JSON.stringify(["key-schema", "duplicate-unique", identity]),
            `The same unique-key constraint for '${name}' was declared more than once.`,
            "Keep only one copy of each unique-key constraint.",
          ));
          continue;
        }
        seenUnique.add(identity);
      }

      constraints.push({ kind, columns: normalized, ruleId: identity });
    }

    for (const constraint of constraints.sort((a, b) => cmp(a.ruleId, b.ruleId))) {
      const column = constraint.columns.length === 1 ? constraint.columns[0] : null;
      const buckets = new Map<string, number[]>();
      for (let index = 0; index < dataset.rows.length; index++) {
        const row = dataset.rows[index];
        const values = constraint.columns.map((col) => (row[col] ?? "").trim());
        const missing = constraint.columns.filter((_, position) => values[position] === "");

        if (missing.length) {
          if (constraint.kind === "primary") {
            for (const missingColumn of missing) {
              issues.push(dataIssue(
                name, dataset.rowNumbers[index], missingColumn,
                "REQUIRED", constraint.ruleId,
                `Primary-key column '${missingColumn}' is empty on this row.`,
                "Supply a nonempty primary-key value and rerun validation.",
              ));
            }
          }
          // MVP UNIQUE semantics: skip tuple if any component is empty.
          continue;
        }

        // JSON tuple encoding avoids delimiter collisions between composite values.
        const encoded = JSON.stringify(values);
        const group = buckets.get(encoded) ?? [];
        group.push(index);
        buckets.set(encoded, group);
      }

      for (const indices of buckets.values()) {
        if (indices.length < 2) continue;
        // Stable physical-line order even if row iteration order changes.
        const rows = indices.map((index) => dataset.rowNumbers[index]).sort((a, b) => a - b);
        const code = constraint.kind === "primary" ? "DUPLICATE_PK" : "DUPLICATE_UNIQUE";
        const base = rows.map((rowNumber) => dataIssue(
          name, rowNumber, column, code, constraint.ruleId,
          `${constraint.kind === "primary" ? "Primary" : "Unique"} key (${constraint.columns.join(", ")}) is repeated across ${rows.length} rows.`,
          "Check the other referenced CSV row locations and correct or intentionally deduplicate the conflicting key.",
        ));
        for (let i = 0; i < rows.length; i++) {
          const peers = rows.filter((_, j) => i !== j);
          issues.push(dataIssue(
            name, rows[i], column, code, constraint.ruleId,
            base[i].explanation,
            base[i].suggestedInvestigation,
            peers.map((rowNumber) => ({ dataset: name, rowNumber, column })),
            base.filter((_, j) => i !== j).map((item) => item.id),
          ));
        }
      }
    }
  }

  return finalizeIssues(issues);
}
