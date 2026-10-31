import { describe, expect, it } from "vitest";
import { validateKeyConstraints, type KeyDataset } from "../../../src/lib/rehearsal/keys";

const dataset = (
  name: string,
  rows: Record<string, string>[],
  rowNumbers = rows.map((_, i) => i + 2),
): KeyDataset => ({
  name,
  headers: [...new Set(rows.flatMap((row) => Object.keys(row)))],
  rows,
  rowNumbers,
});

describe("Phase 6 primary and unique-key preflight", () => {
  it("returns no issues for distinct primary keys", () => {
    const students = dataset("students", [{ id: "1" }, { id: "2" }]);
    expect(validateKeyConstraints([students], { students: { primaryKey: ["id"] } })).toEqual([]);
  });

  it("reports each row of a repeated single-column primary key", () => {
    const students = dataset("students", [{ id: "1" }, { id: "2" }, { id: "1" }], [2, 7, 13]);
    const issues = validateKeyConstraints([students], { students: { primaryKey: ["id"] } });
    expect(issues.map((i) => i.code)).toEqual(["DUPLICATE_PK", "DUPLICATE_PK"]);
    expect(issues.map((i) => i.rowNumber)).toEqual([2, 13]);
    expect(issues[0]?.referencedRecords.map((r) => r.rowNumber)).toEqual([13]);
    expect(issues[0]?.relatedIssueIds).toEqual([issues[1]?.id]);
    expect(issues[0]?.explanation).not.toContain("1");
  });

  it("validates composite PK tuples without ambiguous concatenation", () => {
    const regions = dataset("regions", [
      { country: "AB", code: "C" },
      { country: "A", code: "BC" },
      { country: "AB", code: "C" },
    ]);
    const issues = validateKeyConstraints([regions], {
      regions: { primaryKey: ["country", "code"] },
    });
    expect(issues.map((i) => [i.code, i.rowNumber, i.column])).toEqual([
      ["DUPLICATE_PK", 2, null],
      ["DUPLICATE_PK", 4, null],
    ]);
  });

  it("reports missing primary components but does not compare incomplete tuples", () => {
    const regions = dataset("regions", [
      { country: "PK", code: "" },
      { country: "PK", code: "" },
    ]);
    const issues = validateKeyConstraints([regions], {
      regions: { primaryKey: ["country", "code"] },
    });
    expect(issues.map((i) => i.code)).toEqual(["REQUIRED", "REQUIRED"]);
    expect(issues.map((i) => i.column)).toEqual(["code", "code"]);
  });

  it("reports duplicate single-column unique values, skipping blank values", () => {
    const users = dataset("users", [
      { id: "1", email: " a@b.test " },
      { id: "2", email: "" },
      { id: "3", email: "a@b.test" },
      { id: "4", email: "" },
    ]);
    const issues = validateKeyConstraints([users], {
      users: { uniqueKeys: [["email"]] },
    });
    expect(issues.map((i) => i.code)).toEqual(["DUPLICATE_UNIQUE", "DUPLICATE_UNIQUE"]);
    expect(issues.map((i) => i.rowNumber)).toEqual([2, 4]);
  });

  it("skips composite UNIQUE tuples with any blank component", () => {
    const ds = dataset("d", [
      { a: "1", b: "" }, { a: "1", b: "" },
      { a: "1", b: "2" }, { a: "1", b: "2" },
    ]);
    const issues = validateKeyConstraints([ds], { d: { uniqueKeys: [["a", "b"]] } });
    expect(issues.map((i) => i.rowNumber)).toEqual([4, 5]);
  });

  it("keeps exact case-sensitive comparison rather than guessing a SQL collation", () => {
    const ds = dataset("d", [{ code: "ABC" }, { code: "abc" }]);
    expect(validateKeyConstraints([ds], { d: { uniqueKeys: [["code"]] } })).toEqual([]);
  });

  it("is independent of dataset ordering and unique declaration ordering", () => {
    const a = dataset("a", [{ x: "p", y: "q" }, { x: "p", y: "q" }]);
    const b = dataset("b", [{ k: "1" }, { k: "1" }]);
    const first = validateKeyConstraints([a, b], {
      a: { uniqueKeys: [["x", "y"], ["x"]] },
      b: { primaryKey: ["k"] },
    });
    const second = validateKeyConstraints([b, a], {
      b: { primaryKey: ["k"] },
      a: { uniqueKeys: [["x"], ["y", "x"]] },
    });
    expect(second).toEqual(first);
  });

  it("reports invalid or unknown key columns as schema issues", () => {
    const ds = dataset("d", [{ id: "1" }]);
    const issues = validateKeyConstraints([ds], { d: {
      primaryKey: ["id", "missing"],
      uniqueKeys: [["id", "id"], []],
    } });
    expect(issues).toHaveLength(3);
    expect(issues.every((i) => i.code === "BAD_SCHEMA" && i.rowNumber === null)).toBe(true);
  });

  it("identifies duplicate UNIQUE declarations without duplicating row issues", () => {
    const ds = dataset("d", [{ x: "1" }, { x: "1" }]);
    const issues = validateKeyConstraints([ds], { d: { uniqueKeys: [["x"], ["x"]] } });
    expect(issues.filter((i) => i.code === "BAD_SCHEMA")).toHaveLength(1);
    expect(issues.filter((i) => i.code === "DUPLICATE_UNIQUE")).toHaveLength(2);
  });

  it("detects duplicate dataset names as configuration errors", () => {
    const ds = dataset("same", [{ id: "1" }]);
    const issues = validateKeyConstraints([ds, ds], { same: { primaryKey: ["id"] } });
    expect(issues).toHaveLength(1);
    expect(issues[0]?.code).toBe("BAD_SCHEMA");
  });

  it("reports key rules for datasets not supplied", () => {
    const issues = validateKeyConstraints([], { absent: { primaryKey: ["id"] } });
    expect(issues).toHaveLength(1);
    expect(issues[0]?.code).toBe("BAD_SCHEMA");
  });

  it("rejects invalid physical row numbers rather than inventing locations", () => {
    const ds = dataset("d", [{ id: "1" }, { id: "1" }], [2, 2]);
    const issues = validateKeyConstraints([ds], { d: { primaryKey: ["id"] } });
    expect(issues).toHaveLength(1);
    expect(issues[0]?.code).toBe("BAD_SCHEMA");
  });

  it("creates independent issues for two violated constraints on one row", () => {
    const ds = dataset("d", [
      { id: "1", email: "x" },
      { id: "1", email: "x" },
    ]);
    const issues = validateKeyConstraints([ds], {
      d: { primaryKey: ["id"], uniqueKeys: [["email"]] },
    });
    expect(issues).toHaveLength(4);
    expect(new Set(issues.map((i) => i.id)).size).toBe(4);
    expect(new Set(issues.map((i) => i.rowNumber)).size).toBe(2);
  });
});
