import { describe, expect, it } from "vitest";
import { analyzeDependencyGraph } from "../../../src/lib/rehearsal/graph";
import { assessMigrationReadiness, type ReadinessDataset } from "../../../src/lib/rehearsal/scoring";
import { createIssue } from "../../../src/lib/rehearsal/issues";
import type { RehearsalIssue } from "../../../src/lib/rehearsal/types";

function dataset(name: string, lines: number[] = [2, 3]): ReadinessDataset {
  return {
    name,
    rowNumbers: [...lines],
    rows: lines.map((line) => ({ id: String(line) })),
  };
}
function dataIssue(datasetName: string, line: number, code: "REQUIRED" | "INVALID_TYPE" = "REQUIRED", severity: "ERROR" | "WARNING" = "ERROR", column = "id"): RehearsalIssue {
  return createIssue({
    code, severity, category: "DATA", dataset: datasetName,
    rowNumber: line, column, ruleId: `test:${code}:${column}`,
    explanation: "A configured data rule was not satisfied.",
    suggestedInvestigation: "Inspect this mapped CSV row.",
  });
}
function schemaIssue(name = "users"): RehearsalIssue {
  return createIssue({
    code: "BAD_SCHEMA", severity: "ERROR", category: "SCHEMA",
    dataset: name, rowNumber: null, column: null,
    ruleId: "test:bad-schema", explanation: "Invalid schema configuration.",
    suggestedInvestigation: "Correct the schema.",
  });
}
function run(datasets: readonly ReadinessDataset[] = [dataset("users")], issues: readonly RehearsalIssue[] = []) {
  return assessMigrationReadiness({ datasets, issues, graph: analyzeDependencyGraph(datasets.map((d) => d.name), []) });
}

describe("Phase 6 deterministic migration readiness (unit)", () => {
  it("reports READY with accurate row totals when there are no issues", () => {
    const report = run();
    expect(report.status).toBe("READY");
    expect(report.totals).toEqual({ totalRows: 2, validRows: 2, invalidRows: 0, errors: 0, warnings: 0 });
    expect(report.mode).toBe("STATIC_PREFLIGHT");
    expect(report.schemaVersion).toBe("1");
  });

  it("returns READY_WITH_WARNINGS when only nonblocking warnings exist", () => {
    const report = run([dataset("users")], [dataIssue("users", 2, "INVALID_TYPE", "WARNING")]);
    expect(report.status).toBe("READY_WITH_WARNINGS");
    expect(report.totals).toMatchObject({ validRows: 2, invalidRows: 0, errors: 0, warnings: 1 });
  });

  it("returns BLOCKED for a single blocking data error", () => {
    const report = run([dataset("users")], [dataIssue("users", 2)]);
    expect(report.status).toBe("BLOCKED");
    expect(report.totals).toMatchObject({ validRows: 1, invalidRows: 1, errors: 1 });
  });

  it("counts one invalid physical row once despite several ERROR issues", () => {
    const report = run([dataset("users")], [
      dataIssue("users", 2), dataIssue("users", 2, "INVALID_TYPE"),
    ]);
    expect(report.totals).toMatchObject({ totalRows: 2, validRows: 1, invalidRows: 1, errors: 2 });
  });

  it("keeps equal physical line numbers in different datasets distinct", () => {
    const report = run([dataset("users", [2]), dataset("teams", [2])], [
      dataIssue("users", 2), dataIssue("teams", 2),
    ]);
    expect(report.totals).toMatchObject({ totalRows: 2, validRows: 0, invalidRows: 2 });
  });

  it("returns CONFIG_ERROR and unknown row-validity counts for schema errors", () => {
    const report = run([dataset("users")], [dataIssue("users", 2), schemaIssue()]);
    expect(report.status).toBe("CONFIG_ERROR");
    expect(report.totals).toMatchObject({ totalRows: 2, validRows: null, invalidRows: null, errors: 2 });
  });

  it("a schema WARNING does not incorrectly cause CONFIG_ERROR", () => {
    const warning = createIssue({
      ...schemaIssue(), severity: "WARNING", code: "UNSUPPORTED_CONSTRAINT",
      ruleId: "test:schema-warning",
    });
    const report = run([dataset("users")], [warning]);
    expect(report.status).toBe("READY_WITH_WARNINGS");
    expect(report.totals.invalidRows).toBe(0);
  });

  it("reports BLOCKED for a dependency cycle even when all CSV rows appear valid", () => {
    const datasets = [dataset("a", [2]), dataset("b", [2])];
    const graph = analyzeDependencyGraph(["b", "a"], [
      { childDataset: "a", childColumn: "b", parentDataset: "b", parentColumn: "id" },
      { childDataset: "b", childColumn: "a", parentDataset: "a", parentColumn: "id" },
    ]);
    const report = assessMigrationReadiness({ datasets, issues: [], graph });
    expect(report.status).toBe("BLOCKED");
    expect(report.cycleGroups).toEqual([["a", "b"]]);
    expect(report.totals).toMatchObject({ totalRows: 2, validRows: 2, invalidRows: 0, errors: 1 });
  });

  it("is byte-for-byte deterministic after reversing datasets and issue order", () => {
    const datasets = [dataset("users"), dataset("teams")];
    const issues = [dataIssue("users", 3), dataIssue("teams", 2)];
    const first = run(datasets, issues);
    const second = run([...datasets].reverse(), [...issues].reverse());
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(first.datasets).toEqual(["teams", "users"]);
  });

  it("preserves referenced row locations and related issue IDs for future consumers", () => {
    const source = dataIssue("users", 2);
    const detailed = createIssue({
      ...source,
      relatedIssueIds: ["issue_other"],
      referencedRecords: [{ dataset: "users", rowNumber: 3, column: "id" }],
    });
    const report = run([dataset("users")], [detailed]);
    expect(report.issues[0]?.relatedIssueIds).toEqual(["issue_other"]);
    expect(report.issues[0]?.referencedRecords[0]?.rowNumber).toBe(3);
  });

  it("deduplicates exact repeated issue IDs and avoids inflated errors", () => {
    const issue = dataIssue("users", 2);
    const report = run([dataset("users")], [issue, issue]);
    expect(report.issues).toHaveLength(1);
    expect(report.totals.errors).toBe(1);
  });

  it("rejects conflicting records that share one stable ID", () => {
    const issue = dataIssue("users", 2);
    expect(() => run([dataset("users")], [issue, { ...issue, explanation: "Conflicting text" }]))
      .toThrow(/Conflicting issue records/);
  });

  it("fails closed with CONFIG_ERROR when no datasets are supplied", () => {
    const report = run([]);
    expect(report.status).toBe("CONFIG_ERROR");
    expect(report.totals).toEqual({ totalRows: 0, validRows: null, invalidRows: null, errors: 2, warnings: 0 });
  });

  it("fails closed when a dataset name is repeated", () => {
    const report = run([dataset("users"), dataset("users")]);
    expect(report.status).toBe("CONFIG_ERROR");
    expect(report.totals.validRows).toBeNull();
  });

  it("fails closed when original CSV physical row numbers are missing", () => {
    const broken = { ...dataset("users"), rowNumbers: [2] };
    const report = run([broken]);
    expect(report.status).toBe("CONFIG_ERROR");
    expect(report.issues.map((item) => item.code)).toContain("BAD_SCHEMA");
  });

  it("fails closed when a DATA issue refers to a nonexistent CSV row", () => {
    const report = run([dataset("users")], [dataIssue("users", 999)]);
    expect(report.status).toBe("CONFIG_ERROR");
    expect(report.totals.invalidRows).toBeNull();
  });

  it("fails closed when graph dataset nodes disagree with supplied CSVs", () => {
    const datasets = [dataset("users")];
    const report = assessMigrationReadiness({
      datasets, issues: [], graph: analyzeDependencyGraph(["other"], []),
    });
    expect(report.status).toBe("CONFIG_ERROR");
  });

  it("fails closed for an incomplete or reversed acyclic import order", () => {
    const datasets = [dataset("students"), dataset("departments")];
    const graph = analyzeDependencyGraph(datasets.map((d) => d.name), [
      { childDataset: "students", childColumn: "department_id", parentDataset: "departments", parentColumn: "id" },
    ]);
    const report = assessMigrationReadiness({
      datasets, issues: [], graph: { ...graph, importOrder: ["students", "departments"] },
    });
    expect(report.status).toBe("CONFIG_ERROR");
  });

  it("normalizes extra non-sensitive assumptions deterministically", () => {
    const datasets = [dataset("users")];
    const first = assessMigrationReadiness({
      datasets, issues: [], graph: analyzeDependencyGraph(["users"], []),
      assumptions: ["zeta", " alpha ", "alpha", ""],
    });
    const second = assessMigrationReadiness({
      datasets, issues: [], graph: analyzeDependencyGraph(["users"], []),
      assumptions: ["alpha", "zeta"],
    });
    expect(first).toEqual(second);
    expect(first.assumptions).toContain("alpha");
  });
});
