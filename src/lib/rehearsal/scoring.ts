/**
 * Phase 6: deterministic readiness summary for already-produced findings.
 * This module does NOT execute validators or SQL. The Phase 6 preflight
 * orchestrator must run every configured check before calling this function.
 */
import type { ParsedCsv } from "../csv/parser";
import type { DependencyGraphResult } from "./graph";
import { createIssue, finalizeIssues } from "./issues";
import type { RehearsalIssue, RehearsalReportV1 } from "./types";

export type ReadinessDataset = Pick<ParsedCsv, "name" | "rows" | "rowNumbers">;

export type ReadinessInput = {
  datasets: readonly ReadinessDataset[];
  /** Findings from schema, field-type, key, and FK checks; exclude graph.issues. */
  issues: readonly RehearsalIssue[];
  /** Output returned by analyzeDependencyGraph(), including its issues. */
  graph: DependencyGraphResult;
  /** Additional NON-SENSITIVE assumptions; no CSV cell contents. */
  assumptions?: readonly string[];
};

const DEFAULT_ASSUMPTIONS = [
  "Results describe configured static checks on supplied CSV files, not database execution.",
  "Key equality follows configured CSV comparison rules; target SQL collation and NULL semantics are not guaranteed.",
  "Import order is advisory; database constraints, triggers, and external records are not verified.",
] as const;

function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function configIssue(dataset: string, ruleId: string, explanation: string, suggestedInvestigation: string): RehearsalIssue {
  return createIssue({
    code: "BAD_SCHEMA",
    severity: "ERROR",
    category: "SCHEMA",
    dataset: dataset || "(configuration)",
    rowNumber: null,
    column: null,
    ruleId,
    explanation,
    suggestedInvestigation,
  });
}

/**
 * Merge exact repeated issue objects without double-counting. A stable ID
 * with conflicting content indicates a programming error, not a valid result.
 */
function mergeIssues(issues: readonly RehearsalIssue[]): RehearsalIssue[] {
  const byId = new Map<string, RehearsalIssue>();
  for (const issue of issues) {
    const previous = byId.get(issue.id);
    if (previous && JSON.stringify(previous) !== JSON.stringify(issue)) {
      throw new Error(`Conflicting issue records with stable ID '${issue.id}'`);
    }
    byId.set(issue.id, issue);
  }
  return finalizeIssues([...byId.values()]);
}

/**
 * Deterministic reporting; no Date.now(), random IDs, storage, or network.
 * INVALID ROW means a unique physical CSV record with at least one DATA ERROR.
 * Dataset-level/graph errors can block readiness without making a CSV row invalid.
 * On CONFIG_ERROR, row validity is deliberately unknown (null, not zero).
 */
export function assessMigrationReadiness(input: ReadinessInput): RehearsalReportV1 {
  const config: RehearsalIssue[] = [];
  const seenNames = new Set<string>();
  const rowLocations = new Map<string, Set<number>>();
  let totalRows = 0;

  if (input.datasets.length === 0) {
    config.push(configIssue(
      "(configuration)", "readiness:no-datasets",
      "Readiness cannot be assessed without any uploaded dataset.",
      "Upload and configure at least one CSV dataset.",
    ));
  }

  for (const dataset of input.datasets) {
    const name = dataset.name;
    totalRows += dataset.rows.length;
    if (!name.trim() || name !== name.trim()) {
      config.push(configIssue(
        name.trim() || "(configuration)",
        JSON.stringify(["readiness", "invalid-dataset-name", name]),
        "A dataset name is empty or contains leading/trailing whitespace.",
        "Use a stable, nonempty normalized dataset name.",
      ));
    }
    if (seenNames.has(name)) {
      // Exactly one error per duplicate dataset identity, even if repeated 3+ times.
      if (!config.some((issue) => issue.ruleId === JSON.stringify(["readiness", "duplicate-dataset", name]))) {
        config.push(configIssue(
          name.trim() || "(configuration)",
          JSON.stringify(["readiness", "duplicate-dataset", name]),
          `Dataset '${name}' appears more than once, making row counts ambiguous.`,
          "Rename or remove duplicate datasets and rerun validation.",
        ));
      }
    }
    seenNames.add(name);

    const locations = new Set(dataset.rowNumbers);
    if (dataset.rows.length !== dataset.rowNumbers.length ||
        locations.size !== dataset.rowNumbers.length ||
        dataset.rowNumbers.some((line) => !Number.isSafeInteger(line) || line < 1)) {
      config.push(configIssue(
        name.trim() || "(configuration)",
        JSON.stringify(["readiness", "invalid-row-numbers", name]),
        `CSV row locations for '${name}' are missing, repeated, or invalid.`,
        "Reparse the CSV and preserve a distinct physical starting line for each row.",
      ));
    }
    if (!rowLocations.has(name)) rowLocations.set(name, locations);
  }

  const datasetNames = [...seenNames].sort(cmp);
  const graphNames = [...input.graph.nodes].sort(cmp);
  if (JSON.stringify(datasetNames) !== JSON.stringify(graphNames)) {
    config.push(configIssue(
      "(configuration)", "readiness:graph-dataset-mismatch",
      "The dependency graph dataset list does not match the supplied CSV datasets.",
      "Rebuild the dependency graph using the same CSV inputs used for validation.",
    ));
  }

  const graphHasConfigErrors = input.graph.issues.some(
    (issue) => issue.category === "SCHEMA" && issue.severity === "ERROR",
  );
  if (!graphHasConfigErrors && input.graph.cycleGroups.length === 0) {
    const order = input.graph.importOrder;
    const position = new Map(order.map((name, index) => [name, index]));
    const orderIsComplete = order.length === graphNames.length &&
      position.size === graphNames.length && graphNames.every((name) => position.has(name));
    const respectsEdges = input.graph.edges.every(({ parentDataset, childDataset }) =>
      (position.get(parentDataset) ?? Infinity) < (position.get(childDataset) ?? -1),
    );
    if (!orderIsComplete || !respectsEdges) {
      config.push(configIssue(
        "(configuration)", "readiness:invalid-import-order",
        "The dependency graph does not provide a complete, parent-first order for an acyclic graph.",
        "Re-run deterministic dependency analysis instead of assuming the reported order is safe.",
      ));
    }
  }
  if (!graphHasConfigErrors && input.graph.cycleGroups.length > 0 &&
      !input.graph.issues.some((issue) => issue.code === "DEPENDENCY_CYCLE")) {
    config.push(configIssue(
      "(configuration)", "readiness:missing-cycle-issue",
      "A dependency cycle is present without a corresponding structured cycle finding.",
      "Regenerate the graph report and include its dependency findings.",
    ));
  }

  const supplied = [...input.issues, ...input.graph.issues];
  for (const issue of supplied) {
    if (issue.category !== "DATA" || issue.rowNumber === null) continue;
    if (!rowLocations.get(issue.dataset)?.has(issue.rowNumber)) {
      const dataset = issue.dataset.trim() || "(configuration)";
      const ruleId = JSON.stringify(["readiness", "unknown-row-location", issue.id]);
      if (!config.some((existing) => existing.ruleId === ruleId)) {
        config.push(configIssue(
          dataset, ruleId,
          `A data issue refers to a row location absent from the supplied CSV dataset '${dataset}'.`,
          "Confirm all validators use the same parsed CSV inputs and original physical line numbers.",
        ));
      }
    }
  }

  const issues = mergeIssues([...supplied, ...config]);
  const errors = issues.filter((issue) => issue.severity === "ERROR").length;
  const warnings = issues.filter((issue) => issue.severity === "WARNING").length;
  const hasConfigurationError = issues.some(
    (issue) => issue.category === "SCHEMA" && issue.severity === "ERROR",
  );
  const status = hasConfigurationError
    ? "CONFIG_ERROR"
    : errors > 0 || input.graph.cycleGroups.length > 0
      ? "BLOCKED"
      : warnings > 0 ? "READY_WITH_WARNINGS" : "READY";

  // A row with multiple error findings is counted once, regardless of column/rule.
  const invalid = new Set<string>();
  if (!hasConfigurationError) {
    for (const issue of issues) {
      if (issue.category === "DATA" && issue.severity === "ERROR" && issue.rowNumber !== null) {
        invalid.add(JSON.stringify([issue.dataset, issue.rowNumber]));
      }
    }
  }
  const invalidRows = hasConfigurationError ? null : invalid.size;
  const validRows = hasConfigurationError ? null : totalRows - invalid.size;

  const assumptions = [...new Set([...DEFAULT_ASSUMPTIONS, ...(input.assumptions ?? [])]
    .map((value) => value.trim()).filter(Boolean))].sort(cmp);

  return {
    schemaVersion: "1",
    mode: "STATIC_PREFLIGHT",
    status,
    datasets: datasetNames,
    issues,
    totals: { totalRows, validRows, invalidRows, errors, warnings },
    importOrder: [...input.graph.importOrder],
    cycleGroups: input.graph.cycleGroups.map((group) => [...group]),
    assumptions,
  };
}
