import { describe, expect, it } from "vitest";
import { parseCsvText } from "../src/lib/csv/parser";
import { applyMapping } from "../src/lib/rehearsal/mapping";

describe("column mapping", () => {
  const dataset = parseCsvText("id,student_name\n1,Ali", "students.csv");

  it("renames source fields to target fields", () => {
    const mapped = applyMapping(dataset, [
      { source: "id", target: "id" },
      { source: "student_name", target: "name" },
    ]);
    expect(mapped.rows).toEqual([{ id: "1", name: "Ali" }]);
    expect(mapped.rowNumbers).toEqual([2]);
  });

  it("rejects duplicate target columns", () => {
    expect(() => applyMapping(dataset, [
      { source: "id", target: "name" },
      { source: "student_name", target: "NAME" },
    ])).toThrow(/duplicate target/i);
  });
});
