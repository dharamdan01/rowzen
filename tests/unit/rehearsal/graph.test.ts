import { describe, expect, it } from "vitest";
import { analyzeDependencyGraph } from "../../../src/lib/rehearsal/graph";
import type { ForeignKeyDeclaration } from "../../../src/lib/rehearsal/foreign-keys";

function fk(childDataset: string, parentDataset: string): ForeignKeyDeclaration {
  return {
    childDataset,
    childColumn: "parent_id",
    parentDataset,
    parentColumn: "id",
  };
}

describe("Phase 6 dependency graph (unit)", () => {
  it("orders independent datasets lexicographically", () => {
    const report = analyzeDependencyGraph(["z", "a", "m"], []);
    expect(report.importOrder).toEqual(["a", "m", "z"]);
    expect(report.issues).toEqual([]);
  });

  it("suggests parent-before-child ordering regardless of upload order", () => {
    const report = analyzeDependencyGraph(
      ["students", "departments"], [fk("students", "departments")],
    );
    expect(report.importOrder).toEqual(["departments", "students"]);
    expect(report.edges).toEqual([{ parentDataset: "departments", childDataset: "students" }]);
  });

  it("orders transitive dependencies parent first", () => {
    const report = analyzeDependencyGraph(["line_items", "orders", "customers"], [
      fk("line_items", "orders"), fk("orders", "customers"),
    ]);
    expect(report.importOrder).toEqual(["customers", "orders", "line_items"]);
  });

  it("uses stable alphabetical tie breaking when several nodes are ready", () => {
    const report = analyzeDependencyGraph(["z", "b", "a", "c"], [fk("c", "b")]);
    expect(report.importOrder).toEqual(["a", "b", "c", "z"]);
  });

  it("returns identical results after reversing input and relationship order", () => {
    const relations = [fk("orders", "customers"), fk("items", "orders")];
    const names = ["items", "customers", "orders"];
    expect(analyzeDependencyGraph(names, relations)).toEqual(
      analyzeDependencyGraph([...names].reverse(), [...relations].reverse()),
    );
  });

  it("deduplicates multiple FK constraints between the same datasets", () => {
    const report = analyzeDependencyGraph(["child", "parent"], [
      fk("child", "parent"),
      { ...fk("child", "parent"), childColumn: "owner_id" },
      fk("child", "parent"),
    ]);
    expect(report.edges).toHaveLength(1);
    expect(report.issues).toEqual([]);
  });

  it("accepts composite FK declarations without changing edge semantics", () => {
    const composite: ForeignKeyDeclaration = {
      childDataset: "cities", childColumns: ["country", "region"],
      parentDataset: "regions", parentColumns: ["country", "code"],
    };
    const report = analyzeDependencyGraph(["cities", "regions"], [composite]);
    expect(report.importOrder).toEqual(["regions", "cities"]);
  });

  it("marks actual cycle members but not their downstream dependents", () => {
    const report = analyzeDependencyGraph(["A", "B", "C"], [
      fk("A", "B"), fk("B", "A"), fk("C", "B"),
    ]);
    expect(report.cycleGroups).toEqual([["A", "B"]]);
    expect(report.blockedByCycles).toEqual(["C"]);
    expect(report.unresolvedDatasets).toEqual(["A", "B", "C"]);
    expect(report.issues.map((i) => i.code)).toEqual(["DEPENDENCY_CYCLE"]);
  });

  it("detects a self-referential FK as a self-cycle", () => {
    const report = analyzeDependencyGraph(["employees"], [fk("employees", "employees")]);
    expect(report.cycleGroups).toEqual([["employees"]]);
    expect(report.importOrder).toEqual([]);
    expect(report.issues[0]?.rowNumber).toBeNull();
  });

  it("reports distinct strongly connected cycle groups separately", () => {
    const report = analyzeDependencyGraph(["D", "B", "A", "C"], [
      fk("A", "B"), fk("B", "A"), fk("C", "D"), fk("D", "C"),
    ]);
    expect(report.cycleGroups).toEqual([["A", "B"], ["C", "D"]]);
    expect(report.issues).toHaveLength(2);
    expect(report.issues[0]?.id).not.toBe(report.issues[1]?.id);
  });

  it("returns an explicitly partial order with unrelated nodes if a cycle exists", () => {
    const report = analyzeDependencyGraph(["B", "A", "independent", "another"], [
      fk("A", "B"), fk("B", "A"),
    ]);
    expect(report.importOrder).toEqual(["another", "independent"]);
    expect(report.unresolvedDatasets).toEqual(["A", "B"]);
  });

  it("reports missing parent and refuses to invent a valid ordering", () => {
    const report = analyzeDependencyGraph(["students"], [fk("students", "departments")]);
    expect(report.issues[0]?.code).toBe("MISSING_REFERENCE_DATASET");
    expect(report.importOrder).toEqual([]);
    expect(report.unresolvedDatasets).toEqual(["students"]);
  });

  it("reports missing child datasets as configuration errors", () => {
    const report = analyzeDependencyGraph(["parents"], [fk("children", "parents")]);
    expect(report.issues[0]?.code).toBe("MISSING_REFERENCE_DATASET");
    expect(report.importOrder).toEqual([]);
  });

  it("rejects duplicate and empty dataset names rather than guessing", () => {
    const report = analyzeDependencyGraph(["A", "A", " "], []);
    expect(report.importOrder).toEqual([]);
    expect(report.issues).toHaveLength(2);
    expect(report.issues.every((i) => i.code === "BAD_SCHEMA")).toBe(true);
  });

  it("rejects malformed composite FK declarations", () => {
    const report = analyzeDependencyGraph(["child", "parent"], [{
      childDataset: "child", childColumns: ["a", "b"],
      parentDataset: "parent", parentColumns: ["id"],
    }]);
    expect(report.importOrder).toEqual([]);
    expect(report.issues.map((i) => i.code)).toEqual(["BAD_SCHEMA"]);
  });

  it("rejects an empty graph without claiming readiness", () => {
    const report = analyzeDependencyGraph([], []);
    expect(report.importOrder).toEqual([]);
    expect(report.issues.map((i) => i.code)).toEqual(["BAD_SCHEMA"]);
  });
});
