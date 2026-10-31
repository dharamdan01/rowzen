import { describe, expect, it } from "vitest";
import { parseCsvText } from "../../../src/lib/csv/parser";
import { runPreflight } from "../../../src/lib/rehearsal/preflight";
import type { PreflightInput } from "../../../src/lib/rehearsal/preflight";

function fixture(): PreflightInput {
  return {
    datasets: [
      parseCsvText("id,name,department_id\n1,Ali,10\n2,Sara,20\n3,Ahmed,99\n3,Bilal,10\n", "students.csv"),
      parseCsvText("id,name\n10,Software Engineering\n20,Computer Science\n", "departments.csv"),
    ],
    rules: {
      students: { primaryKey: "id", required: ["name", "department_id"], types: {} },
      departments: { primaryKey: "id", required: ["name"], types: {} },
    },
    relationships: [{ childDataset: "students", childColumn: "department_id", parentDataset: "departments", parentColumn: "id" }],
  };
}

describe("Phase 6 end-to-end in-memory preflight", () => {
  it("matches 6 / 4 / 2 / 3 starter data numbers, with structured explanations", () => {
    const report = runPreflight(fixture());
    expect(report.status).toBe("BLOCKED");
    expect(report.totals).toEqual({ totalRows: 6, validRows: 4, invalidRows: 2, errors: 3, warnings: 0 });
    expect(report.importOrder).toEqual(["departments", "students"]);
    expect(report.issues.every((i) => Boolean(i.id && i.code && i.suggestedInvestigation))).toBe(true);
  });

  it("is byte-for-byte repeatable across identical input, map ordering and dataset ordering", () => {
    const a = fixture();
    const b = fixture();
    b.datasets = [...b.datasets].reverse();
    b.rules = { departments: b.rules.departments, students: b.rules.students };
    expect(JSON.stringify(runPreflight(a))).toBe(JSON.stringify(runPreflight(b)));
  });

  it("preserves physical row locations through missing FK and type validation", () => {
    const ds = parseCsvText("id,email,department_id\n\n1,invalid,9\n", "students.csv");
    const parent = parseCsvText("id\n10\n", "departments.csv");
    const report = runPreflight({
      datasets: [ds, parent],
      rules: {
        students: { primaryKey: "id", required: ["email"], types: { email: "email" } },
        departments: { primaryKey: "id", required: [], types: {} },
      },
      relationships: [{ childDataset: "students", childColumn: "department_id", parentDataset: "departments", parentColumn: "id" }],
    });
    expect(report.status).toBe("BLOCKED");
    expect(report.totals.invalidRows).toBe(1);
    expect(report.issues.filter((i) => i.dataset === "students").map((i) => i.rowNumber)).toEqual([3, 3]);
  });

  it("stops row findings on invalid FK target declaration", () => {
    const input = fixture();
    input.rules.departments.primaryKey = "";
    const report = runPreflight(input);
    expect(report.status).toBe("CONFIG_ERROR");
    expect(report.totals.validRows).toBeNull();
    expect(report.issues.some((i) => i.code === "FK_TARGET_NOT_UNIQUE")).toBe(true);
    expect(report.issues.every((i) => i.category !== "DATA")).toBe(true);
  });

  it("handles duplicated PK + orphan issues per physical row without double counting", () => {
    const input = fixture();
    input.datasets[0]!.rows[2]!.department_id = "99";
    input.datasets[0]!.rows[3]!.department_id = "99";
    const report = runPreflight(input);
    expect(report.status).toBe("BLOCKED");
    expect(report.totals.invalidRows).toBe(2);
    expect(report.totals.errors).toBe(4);
  });
});
