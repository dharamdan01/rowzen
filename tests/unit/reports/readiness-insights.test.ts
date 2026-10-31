import { describe, expect, it } from "vitest";
import { createIssue } from "../../../src/lib/rehearsal/issues";
import { analyzeDependencyGraph } from "../../../src/lib/rehearsal/graph";
import { assessMigrationReadiness, type ReadinessDataset } from "../../../src/lib/rehearsal/scoring";
import { buildReadinessInsights } from "../../../src/lib/reports/readiness-insights";
import type { ForeignKeyDeclaration } from "../../../src/lib/rehearsal/foreign-keys";
import type { RehearsalIssue } from "../../../src/lib/rehearsal/types";

function ds(name: string, lines = [2, 3]): ReadinessDataset {
  return { name, rows: lines.map((line) => ({ id: String(line) })), rowNumbers: [...lines] };
}
const fk = (childDataset: string, parentDataset: string): ForeignKeyDeclaration => ({
  childDataset, childColumn: "ref", parentDataset, parentColumn: "id",
});
function finding(dataset: string, rowNumber: number | null, code: "REQUIRED" | "INVALID_TYPE" | "BAD_SCHEMA" | "UNSUPPORTED_CONSTRAINT", severity: "ERROR" | "WARNING" = "ERROR", investigation = "Check the mapped source column."): RehearsalIssue {
  return createIssue({
    code, severity, category: code === "BAD_SCHEMA" || code === "UNSUPPORTED_CONSTRAINT" ? "SCHEMA" : "DATA",
    dataset, rowNumber, column: rowNumber === null ? null : "id", ruleId: `test:${code}:${dataset}:${rowNumber}`,
    explanation: "Synthetic finding; no raw CSV cells.", suggestedInvestigation: investigation,
  });
}
function report(
  datasets: readonly ReadinessDataset[],
  issues: readonly RehearsalIssue[] = [],
  relations: readonly ForeignKeyDeclaration[] = [],
) {
  return assessMigrationReadiness({
    datasets,
    issues,
    graph: analyzeDependencyGraph(datasets.map((dataset) => dataset.name), relations),
  });
}

describe("Phase 7 readiness action plan (pure module)", () => {
  it("explains READY without promising a successful SQL import", () => {
    const view = buildReadinessInsights(report([ds("users")]), []);
    expect(view.status).toBe("READY");
    expect(view.explanation).toContain("actual database import has not been tested");
    expect(view.actions).toEqual([]);
  });
  it("keeps warning findings separate from blocking errors", () => {
    const r = report([ds("users")], [finding("users", 2, "INVALID_TYPE", "WARNING")]);
    const view = buildReadinessInsights(r, []);
    expect(view).toMatchObject({ status: "READY_WITH_WARNINGS", blockingErrors: 0, warnings: 1 });
    expect(view.actions[0]).toMatchObject({ severity: "WARNING", affectedRows: 1 });
  });
  it("prioritizes configuration corrections over data findings and warnings", () => {
    const issues = [
      finding("users", 2, "REQUIRED"),
      finding("users", null, "BAD_SCHEMA"),
      finding("users", null, "UNSUPPORTED_CONSTRAINT", "WARNING"),
    ];
    const view = buildReadinessInsights(report([ds("users")], issues), []);
    expect(view.status).toBe("CONFIG_ERROR");
    expect(view.actions.map((a) => a.code)).toEqual(["BAD_SCHEMA", "REQUIRED", "UNSUPPORTED_CONSTRAINT"]);
    expect(view.explanation).toContain("not evaluated");
  });
  it("counts multiple errors on the same physical CSV row once per action", () => {
    const issues = [
      finding("users", 2, "REQUIRED"),
      createIssue({ ...finding("users", 2, "REQUIRED"), ruleId: "another-rule", column: "email" }),
      finding("users", 3, "REQUIRED"),
    ];
    const view = buildReadinessInsights(report([ds("users")], issues), []);
    expect(view.actions[0]).toMatchObject({ count: 3, affectedRows: 2 });
    expect(view.blockingErrors).toBe(3);
  });
  it("counts equal physical row numbers across different CSVs separately", () => {
    const view = buildReadinessInsights(report([ds("a", [2]), ds("b", [2])], [finding("a", 2, "REQUIRED"), finding("b", 2, "REQUIRED")]), []);
    expect(view.actions[0].affectedRows).toBe(2);
    expect(view.actions[0].datasets).toEqual(["a", "b"]);
  });
  it("sorts unique investigations without collapsing distinct recommendations", () => {
    const r = report([ds("users")], [finding("users", 2, "REQUIRED", "ERROR", "Z: Check records."), finding("users", 3, "REQUIRED", "ERROR", "A: Check mapping.")]);
    expect(buildReadinessInsights(r, []).actions[0].investigations).toEqual(["A: Check mapping.", "Z: Check records."]);
  });
  it("does not fabricate datasets for configuration-only issues", () => {
    const view = buildReadinessInsights(report([ds("users")], [finding("(configuration)", null, "BAD_SCHEMA")]), []);
    expect(view.actions[0].datasets).toEqual([]);
  });
  it("shows stable parent-first order on an acyclic graph", () => {
    const relations = [fk("users", "teams")];
    const view = buildReadinessInsights(report([ds("users"), ds("teams")], [], relations), relations);
    expect(view.dependency.orderKind).toBe("COMPLETE");
    expect(view.dependency.importOrder).toEqual(["teams", "users"]);
    expect(view.dependency.edges).toEqual([{ parentDataset: "teams", childDataset: "users" }]);
  });
  it("distinguishes actual cycle members from downstream blocked datasets", () => {
    const relations = [fk("a", "b"), fk("b", "a"), fk("c", "b")];
    const view = buildReadinessInsights(report([ds("a"), ds("b"), ds("c"), ds("independent")], [], relations), relations);
    expect(view.status).toBe("BLOCKED");
    expect(view.dependency.cycleGroups).toEqual([["a", "b"]]);
    expect(view.dependency.blockedByCycles).toEqual(["c"]);
    expect(view.dependency.unresolvedDatasets).toEqual(["a", "b", "c"]);
    expect(view.dependency.importOrder).toEqual(["independent"]);
    expect(view.dependency.orderKind).toBe("PARTIAL");
    expect(view.actions[0].code).toBe("DEPENDENCY_CYCLE");
  });
  it("hides order on schema CONFIG_ERROR even if topological graph is acyclic", () => {
    const relations = [fk("users", "teams")];
    const r = report([ds("users"), ds("teams")], [finding("users", null, "BAD_SCHEMA")], relations);
    const view = buildReadinessInsights(r, relations);
    expect(view.dependency.orderKind).toBe("UNAVAILABLE");
    expect(view.dependency.importOrder).toEqual([]);
    expect(view.dependency.reason).toContain("configuration errors");
  });
  it("fails closed on relationship changes after a validation run", () => {
    const original = [fk("users", "teams")];
    const view = buildReadinessInsights(report([ds("users"), ds("teams")], [], original), [fk("teams", "users")]);
    expect(view.dependency.orderKind).toBe("UNAVAILABLE");
    expect(view.dependency.edges).toEqual([]);
    expect(view.dependency.reason).toContain("changed since this report");
  });
  it("does not mutate canonical Phase 6 reports or FK declarations", () => {
    const relations = [fk("users", "teams")];
    const r = report([ds("users"), ds("teams")], [finding("users", 2, "REQUIRED")], relations);
    const before = JSON.stringify([r, relations]);
    buildReadinessInsights(r, relations);
    expect(JSON.stringify([r, relations])).toBe(before);
  });
  it("is byte-identical when report issues and relationship order are reversed", () => {
    const relations = [fk("c", "b"), fk("b", "a")];
    const r = report([ds("c"), ds("a"), ds("b")], [finding("c", 2, "REQUIRED"), finding("b", 3, "INVALID_TYPE")], relations);
    expect(JSON.stringify(buildReadinessInsights(r, relations))).toBe(JSON.stringify(buildReadinessInsights({ ...r, issues: [...r.issues].reverse() }, [...relations].reverse())));
  });
  it("does not expose raw CSV cell contents in report interpretation", () => {
    const input = [ds("users")];
    input[0].rows[0].id = "SECRET-CELL-VALUE";
    const view = buildReadinessInsights(report(input), []);
    expect(JSON.stringify(view)).not.toContain("SECRET-CELL-VALUE");
  });
});
