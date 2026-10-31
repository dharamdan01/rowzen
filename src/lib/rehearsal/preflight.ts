/**
 * Phase 6 canonical static migration preflight, intentionally opt-in.
 * Phase 5 runValidation()/engine.ts and the UI remain unchanged.
 * No DB calls, no generative AI, no raw CSV in returned report.
 */
import type { ParsedCsv } from "../csv/parser";
import type { DatasetRules } from "./rules";
import type { KeyConfiguration } from "./keys";
import type { ForeignKeyDeclaration } from "./foreign-keys";
import type { RehearsalIssue, RehearsalReportV1 } from "./types";
import { createIssue } from "./issues";
import { validateSchemaConfiguration } from "./schema";
import { validateKeyConstraints } from "./keys";
import { validateForeignKeys } from "./foreign-keys";
import { analyzeDependencyGraph } from "./graph";
import { validateRequiredAndTypes } from "./fields";
import { assessMigrationReadiness } from "./scoring";

export type PreflightInput = {
  datasets: readonly ParsedCsv[];
  /** Existing Phase 5 mapped field rules. */
  rules: Readonly<Record<string, DatasetRules>>;
  /** Legacy single-column or Phase 6 composite FK declarations. */
  relationships: readonly ForeignKeyDeclaration[];
  /** Optional Phase 6 key configuration. Legacy PKs are used by default. */
  keyRules?: KeyConfiguration;
  assumptions?: readonly string[];
};

export type PreflightOutput = RehearsalReportV1;

const compareText = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;

function schemaIssue(
  dataset: string, column: string | null, ruleId: string,
  explanation: string, suggestedInvestigation: string,
  code: "BAD_SCHEMA" | "INCOMPATIBLE_COLUMN_TYPE" = "BAD_SCHEMA",
): RehearsalIssue {
  return createIssue({
    code, severity: "ERROR", category: "SCHEMA",
    dataset: dataset || "(configuration)", rowNumber: null, column,
    ruleId, explanation, suggestedInvestigation,
  });
}

function normalizeFK(relation: ForeignKeyDeclaration) {
  return {
    childDataset: relation.childDataset.trim(),
    parentDataset: relation.parentDataset.trim(),
    childColumns: "childColumns" in relation
      ? relation.childColumns.map((column) => column.trim()) : [relation.childColumn.trim()],
    parentColumns: "parentColumns" in relation
      ? relation.parentColumns.map((column) => column.trim()) : [relation.parentColumn.trim()],
  };
}

/** Phase 5 string primaryKey -> Phase 6 string[] primaryKey, unless overridden. */
function deriveKeys(
  datasets: readonly ParsedCsv[],
  rules: Readonly<Record<string, DatasetRules>>,
  explicit?: KeyConfiguration,
): { keys: KeyConfiguration; issues: RehearsalIssue[] } {
  const keys: Record<string, { primaryKey?: readonly string[]; uniqueKeys?: readonly (readonly string[])[] }> = {};
  const issues: RehearsalIssue[] = [];
  for (const ds of datasets) {
    const legacy = rules[ds.name]?.primaryKey;
    const config = explicit?.[ds.name];
    keys[ds.name] = config ?? (legacy ? { primaryKey: [legacy] } : {});
    if (config?.primaryKey && legacy &&
        !(config.primaryKey.length === 1 && config.primaryKey[0] === legacy)) {
      issues.push(schemaIssue(
        ds.name, null, JSON.stringify(["preflight", "conflicting-primary-key", ds.name]),
        `Legacy and Phase 6 primary-key declarations disagree for '${ds.name}'.`,
        "Clear the legacy primaryKey or make it match the explicit Phase 6 key declaration.",
      ));
    }
  }
  for (const [name, config] of Object.entries(explicit ?? {})) {
    if (!(name in keys)) keys[name] = config;
  }
  return { keys, issues };
}

/** Declare exact type equality only when both FK component types are configured. */
function validateFKTypes(
  rules: Readonly<Record<string, DatasetRules>>,
  relationships: readonly ForeignKeyDeclaration[],
): RehearsalIssue[] {
  const issues: RehearsalIssue[] = [];
  const seen = new Set<string>();
  for (const relation of relationships.map(normalizeFK).sort((a, b) =>
    compareText(JSON.stringify(a), JSON.stringify(b)))) {
    const { childDataset, parentDataset, childColumns, parentColumns } = relation;
    const ruleId = JSON.stringify(["preflight", "fk-type", relation]);
    for (let index = 0; index < Math.min(childColumns.length, parentColumns.length); index++) {
      const childColumn = childColumns[index];
      const parentColumn = parentColumns[index];
      const childType = rules[childDataset]?.types[childColumn];
      const parentType = rules[parentDataset]?.types[parentColumn];
      if (!childType || !parentType || childType === parentType) continue;
      const issue = schemaIssue(
        childDataset, childColumn, JSON.stringify([ruleId, index]),
        `Declared FK types differ between '${childDataset}.${childColumn}' and '${parentDataset}.${parentColumn}'.`,
        "Use compatible declared types and independently verify actual target-DB semantics.",
        "INCOMPATIBLE_COLUMN_TYPE",
      );
      if (!seen.has(issue.id)) { seen.add(issue.id); issues.push(issue); }
    }
  }
  return issues;
}

/**
 * Orchestrate existing Phase 6 validators in deterministic order.
 * Schema errors fail closed: never show speculative row-validity counts.
 * Do not call legacy runValidation() here: it would duplicate PK and FK checks.
 */
export function runPreflight(input: PreflightInput): PreflightOutput {
  const { datasets, rules, relationships } = input;
  const graph = analyzeDependencyGraph(datasets.map((ds) => ds.name), relationships);
  const { keys, issues: keyDeclarationIssues } = deriveKeys(datasets, rules, input.keyRules);

  const earlyIssues = [
    ...validateSchemaConfiguration(datasets, rules, []),
    ...keyDeclarationIssues,
    ...validateFKTypes(rules, relationships),
  ];
  const malformedLocations = datasets.some((ds) =>
    ds.rows.length !== ds.rowNumbers.length ||
    new Set(ds.rowNumbers).size !== ds.rowNumbers.length ||
    ds.rowNumbers.some((line) => !Number.isSafeInteger(line) || line < 1),
  );

  // Basic schema and row-location prerequisites before any row-level checks.
  // Graph still contributes its cycle/config issues to readiness reporting.
  if (malformedLocations || earlyIssues.some((i) => i.category === "SCHEMA" && i.severity === "ERROR") ||
      graph.issues.some((i) => i.category === "SCHEMA" && i.severity === "ERROR")) {
    return assessMigrationReadiness({ datasets, issues: earlyIssues, graph, assumptions: input.assumptions });
  }

  // Run independently to gather configuration errors before accepting DATA findings.
  const keyIssues = validateKeyConstraints(datasets, keys);
  const fkIssues = validateForeignKeys(datasets, relationships, keys);
  const combined = [...earlyIssues, ...keyIssues, ...fkIssues];
  if (combined.some((i) => i.category === "SCHEMA" && i.severity === "ERROR")) {
    return assessMigrationReadiness({
      datasets, issues: combined.filter((i) => i.category === "SCHEMA"), graph,
      assumptions: input.assumptions,
    });
  }

  const fieldIssues = validateRequiredAndTypes(datasets, rules, keys);
  return assessMigrationReadiness({
    datasets, issues: [...combined, ...fieldIssues], graph,
    assumptions: input.assumptions,
  });
}
