import { describe, expect, it } from "vitest";
import { parseCsvText } from "../../../src/lib/csv/parser";
import { validateForeignKeys } from "../../../src/lib/rehearsal/foreign-keys";
import { validateKeyConstraints } from "../../../src/lib/rehearsal/keys";

const rules = { departments: { primaryKey: ["id"] } };
const fk = [{
  childDataset: "students", childColumn: "department_id",
  parentDataset: "departments", parentColumn: "id",
}];

describe("Phase 6 FK validator + real PapaParse + keys", () => {
  it("preserves physical row numbers after blank lines and quoted multiline data", () => {
    const dep = parseCsvText("id,name\n10,CS\n", "departments.csv");
    const stu = parseCsvText(
      'id,department_id,notes\n1,10,"hello, world"\n\n2,99,"two\nlines"\n',
      "students.csv",
    );
    const issues = validateForeignKeys([dep, stu], fk, rules);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ code: "FK_NOT_FOUND", rowNumber: 4 });
  });

  it("identifies parent duplicate-key issues separately from FK membership", () => {
    const dep = parseCsvText("id,name\n10,CS\n10,Duplicate\n", "departments.csv");
    const stu = parseCsvText("id,department_id\n1,10\n", "students.csv");
    const keyIssues = validateKeyConstraints([dep], rules);
    const fkIssues = validateForeignKeys([dep, stu], fk, rules);
    expect(keyIssues.filter((issue) => issue.code === "DUPLICATE_PK")).toHaveLength(2);
    expect(fkIssues).toEqual([]);
  });

  it("produces identical output for the same parsed datasets and rules", () => {
    const dep = parseCsvText("id,name\n10,CS\n", "departments.csv");
    const stu = parseCsvText("id,department_id\n1,99\n2, 99 \n", "students.csv");
    const first = validateForeignKeys([dep, stu], fk, rules);
    const second = validateForeignKeys([stu, dep], fk, rules);
    expect(first).toEqual(second);
    expect(first).toHaveLength(2);
  });
});
