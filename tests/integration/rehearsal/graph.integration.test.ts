import { describe, expect, it } from "vitest";
import { parseCsvText } from "../../../src/lib/csv/parser";
import { analyzeDependencyGraph } from "../../../src/lib/rehearsal/graph";
import type { ForeignKeyDeclaration } from "../../../src/lib/rehearsal/foreign-keys";

describe("Phase 6 dependency graph + parsed CSV integration", () => {
  it("orders actual parsed parent and child dataset names", () => {
    const child = parseCsvText("id,department_id\n1,10\n", "students.csv");
    const parent = parseCsvText("id,name\n10,Engineering\n", "departments.csv");
    const report = analyzeDependencyGraph(
      [child.name, parent.name], [
        { childDataset: child.name, childColumn: "department_id",
          parentDataset: parent.name, parentColumn: "id" },
      ],
    );
    expect(report.importOrder).toEqual(["departments", "students"]);
    expect(report.issues).toEqual([]);
  });

  it("reports a true cycle without misclassifying a dependent CSV", () => {
    const a = parseCsvText("id,b\n1,2\n", "a.csv");
    const b = parseCsvText("id,a\n2,1\n", "b.csv");
    const c = parseCsvText("id,b\n3,2\n", "c.csv");
    const report = analyzeDependencyGraph([c.name, a.name, b.name], [
      { childDataset: a.name, childColumn: "b", parentDataset: b.name, parentColumn: "id" },
      { childDataset: b.name, childColumn: "a", parentDataset: a.name, parentColumn: "id" },
      { childDataset: c.name, childColumn: "b", parentDataset: b.name, parentColumn: "id" },
    ]);
    expect(report.cycleGroups).toEqual([["a", "b"]]);
    expect(report.blockedByCycles).toEqual(["c"]);
    expect(report.issues).toHaveLength(1);
  });

  it("generates byte-for-byte repeatable reports for the same parsed inputs", () => {
    const departments = parseCsvText("id,name\n10,SE\n", "departments.csv");
    const students = parseCsvText("id,department_id\n1,10\n", "students.csv");
    const datasets = [students.name, departments.name];
    const relationships: ForeignKeyDeclaration[] = [{
      childDataset: students.name, childColumn: "department_id",
      parentDataset: departments.name, parentColumn: "id",
    }];
    const a = analyzeDependencyGraph(datasets, relationships);
    const b = analyzeDependencyGraph([...datasets].reverse(), [...relationships].reverse());
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
