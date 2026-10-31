import { describe, expect, it } from "vitest";
import { validateForeignKeys, type ForeignKeyDataset } from "../../../src/lib/rehearsal/foreign-keys";
import type { ForeignKeyDeclaration } from "../../../src/lib/rehearsal/foreign-keys";
import type { KeyConfiguration } from "../../../src/lib/rehearsal/keys";

function fixtures() {
  const datasets: ForeignKeyDataset[] = [
    {
      name: "departments", headers: ["id", "name"],
      rows: [{ id: "10", name: "CS" }, { id: "20", name: "SE" }],
      rowNumbers: [2, 3],
    },
    {
      name: "students", headers: ["id", "department_id"],
      rows: [{ id: "1", department_id: "10" }, { id: "2", department_id: "20" }],
      rowNumbers: [2, 3],
    },
  ];
  const rules: KeyConfiguration = { departments: { primaryKey: ["id"] } };
  const fk: ForeignKeyDeclaration = {
    childDataset: "students", childColumn: "department_id",
    parentDataset: "departments", parentColumn: "id",
  };
  return { datasets, rules, fk };
}

describe("Phase 6 cross-file foreign-key preflight", () => {
  it("accepts valid single-column relationships (legacy Phase 5 shape)", () => {
    const { datasets, rules, fk } = fixtures();
    expect(validateForeignKeys(datasets, [fk], rules)).toEqual([]);
  });

  it("reports orphan references with actual child row and no raw value", () => {
    const { datasets, rules, fk } = fixtures();
    datasets[1].rows[1].department_id = "999-SECRET";
    const issues = validateForeignKeys(datasets, [fk], rules);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      code: "FK_NOT_FOUND", severity: "ERROR", category: "DATA",
      dataset: "students", rowNumber: 3, column: "department_id",
      referencedRecords: [], relatedIssueIds: [],
    });
    expect(JSON.stringify(issues)).not.toContain("999-SECRET");
  });

  it("reports an absent parent dataset as a configuration issue", () => {
    const { datasets, rules, fk } = fixtures();
    const issues = validateForeignKeys(datasets.slice(1), [fk], rules);
    expect(issues.map((i) => i.code)).toContain("MISSING_REFERENCE_DATASET");
    expect(issues.every((i) => i.rowNumber === null)).toBe(true);
  });

  it("reports an absent child dataset as a configuration issue", () => {
    const { datasets, rules, fk } = fixtures();
    const issues = validateForeignKeys(datasets.slice(0, 1), [fk], rules);
    expect(issues.map((i) => i.code)).toContain("MISSING_REFERENCE_DATASET");
  });

  it("reports an unknown child column and does not emit FK data issues", () => {
    const { datasets, rules, fk } = fixtures();
    const bad = { ...fk, childColumn: "missing_column" };
    const issues = validateForeignKeys(datasets, [bad], rules);
    expect(issues.map((i) => i.code)).toEqual(["BAD_SCHEMA"]);
  });

  it("reports an unknown parent column", () => {
    const { datasets, rules, fk } = fixtures();
    const issues = validateForeignKeys(datasets, [{ ...fk, parentColumn: "missing" }], rules);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ code: "BAD_SCHEMA", dataset: "departments" });
  });

  it("rejects a parent column with no primary/unique declaration", () => {
    const { datasets, fk } = fixtures();
    const issues = validateForeignKeys(datasets, [fk], {});
    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe("FK_TARGET_NOT_UNIQUE");
  });

  it("supports a target declared by a UNIQUE constraint", () => {
    const { datasets, fk } = fixtures();
    const issues = validateForeignKeys(datasets, [fk], {
      departments: { uniqueKeys: [["id"]] },
    });
    expect(issues).toEqual([]);
  });

  it("matches composite FK tuples without joining ambiguous strings", () => {
    const datasets: ForeignKeyDataset[] = [
      { name: "parents", headers: ["a", "b"], rows: [{ a: "ab", b: "c" }], rowNumbers: [2] },
      { name: "children", headers: ["x", "y"], rows: [
        { x: "ab", y: "c" }, { x: "a", y: "bc" },
      ], rowNumbers: [2, 5] },
    ];
    const issues = validateForeignKeys(datasets, [{
      childDataset: "children", childColumns: ["x", "y"],
      parentDataset: "parents", parentColumns: ["a", "b"],
    }], { parents: { primaryKey: ["a", "b"] } });
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ code: "FK_NOT_FOUND", rowNumber: 5, column: null });
  });

  it("skips incomplete composite FK tuples under declared MATCH SIMPLE-like semantics", () => {
    const datasets: ForeignKeyDataset[] = [
      { name: "parents", headers: ["a", "b"], rows: [{ a: "1", b: "2" }], rowNumbers: [2] },
      { name: "children", headers: ["x", "y"], rows: [
        { x: "1", y: "" }, { x: "", y: "2" }, { x: "  ", y: "  " },
      ], rowNumbers: [2, 3, 4] },
    ];
    expect(validateForeignKeys(datasets, [{
      childDataset: "children", childColumns: ["x", "y"],
      parentDataset: "parents", parentColumns: ["a", "b"],
    }], { parents: { primaryKey: ["a", "b"] } })).toEqual([]);
  });

  it("rejects mismatched composite key length", () => {
    const { datasets, rules } = fixtures();
    const issues = validateForeignKeys(datasets, [{
      childDataset: "students", childColumns: ["id", "department_id"],
      parentDataset: "departments", parentColumns: ["id"],
    }], rules);
    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe("BAD_SCHEMA");
  });

  it("reports repeated identical foreign-key declarations once", () => {
    const { datasets, rules, fk } = fixtures();
    const issues = validateForeignKeys(datasets, [fk, fk, fk], rules);
    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe("BAD_SCHEMA");
  });

  it("reports duplicate dataset names without producing row findings", () => {
    const { datasets, rules, fk } = fixtures();
    const issues = validateForeignKeys([...datasets, { ...datasets[0] }], [fk], rules);
    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe("BAD_SCHEMA");
  });

  it("returns reproducible IDs and issue order when dataset/rule ordering changes", () => {
    const { datasets, rules, fk } = fixtures();
    datasets[1].rows.push({ id: "3", department_id: "88" });
    datasets[1].rowNumbers.push(7);
    const fks = [fk, {
      childDataset: "students", childColumn: "id", parentDataset: "departments", parentColumn: "id",
    }];
    const a = validateForeignKeys(datasets, fks, rules);
    const b = validateForeignKeys([...datasets].reverse(), [...fks].reverse(), rules);
    expect(a).toEqual(b);
    expect(a.every((issue) => /^issue_[a-f0-9]{16}$/.test(issue.id))).toBe(true);
  });
});
