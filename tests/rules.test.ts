// Validation integration tests

import { describe, expect, it } from "vitest";
import { parseCsvText } from "../src/lib/csv/parser";
import { runValidation } from "../src/lib/rehearsal/rules";

const departments = parseCsvText("id,name\n10,Software Engineering\n20,Computer Science\n", "departments.csv");
const students = parseCsvText("id,name,department_id\n1,Ali,10\n2,Sara,20\n3,Ahmed,99\n3,Bilal,10\n", "students.csv");

const rules = {
  students: { primaryKey: "id", required: ["name", "department_id"], types: {} },
  departments: { primaryKey: "id", required: ["name"], types: {} },
};
const relationship = [{
  childDataset: "students", childColumn: "department_id",
  parentDataset: "departments", parentColumn: "id",
}];

describe("validation integration", () => {
  it("returns starter fixture's 6 rows, 2 invalid rows, 3 issues and correct import order", () => {
    const result = runValidation([students, departments], rules, relationship);
    expect(result.report.totalRows).toBe(6);
    expect(result.report.invalidRows).toBe(2);
    expect(result.report.issues).toHaveLength(3);
    expect(result.order).toEqual(["departments", "students"]);
  });

  it("checks required and typed values and preserves physical CSV line", () => {
    const csv = parseCsvText("id,email,age,joined\n\n1,wrong,xx,2026-02-30\n2,,19,2026-01-02\n", "people.csv");
    const result = runValidation([csv], {
      people: {
        primaryKey: "id", required: ["email"],
        types: { email: "email", age: "integer", joined: "date" },
      },
    }, []);
    expect(result.report.invalidRows).toBe(2);
    expect(result.report.issues.filter((issue) => issue.code === "INVALID_TYPE")).toHaveLength(3);
    expect(result.report.issues.find((issue) => issue.column === "email" && issue.code === "INVALID_TYPE")?.rowNumber).toBe(3);
    expect(result.report.issues.find((issue) => issue.code === "REQUIRED")?.rowNumber).toBe(4);
  });

  it("reports an import-order cycle as blocked", () => {
    const a = parseCsvText("id,b\n1,1", "a.csv");
    const b = parseCsvText("id,a\n1,1", "b.csv");
    const result = runValidation([a, b], {
      a: { primaryKey: "id", required: [], types: {} },
      b: { primaryKey: "id", required: [], types: {} },
    }, [
      { childDataset: "a", childColumn: "b", parentDataset: "b", parentColumn: "id" },
      { childDataset: "b", childColumn: "a", parentDataset: "a", parentColumn: "id" },
    ]);
    expect(result.cycles).toHaveLength(2);
    expect(result.report.blocked).toBe(true);
  });
});

describe("schema checks", () => {
  it("rejects required columns absent from the mapped CSV", () => {
    const dataset = parseCsvText("id,name\n1,Ali", "sample.csv");
    expect(() => runValidation([dataset], {
      sample: { primaryKey: "id", required: ["department_id"], types: {} },
    }, [])).toThrow(/unknown column/);
  });
});
