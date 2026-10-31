import { describe, expect, it } from "vitest";
import { runPreflight } from "../../../src/lib/rehearsal/preflight";
import type { PreflightInput } from "../../../src/lib/rehearsal/preflight";
import type { DatasetRules } from "../../../src/lib/rehearsal/rules";
import { parseCsvText } from "../../../src/lib/csv/parser";

function fixture(): PreflightInput {
  return {
    datasets: [
      parseCsvText("id,department_id,name\n1,10,Alice\n2,20,Bob\n", "students.csv"),
      parseCsvText("id,name\n10,Engineering\n20,Science\n", "departments.csv"),
    ],
    rules: {
      students: { primaryKey: "id", required: ["name", "department_id"], types: { id: "integer", department_id: "integer" } },
      departments: { primaryKey: "id", required: ["name"], types: { id: "integer" } },
    },
    relationships: [{ childDataset: "students", childColumn: "department_id", parentDataset: "departments", parentColumn: "id" }],
  };
}

const peopleRules: DatasetRules = { primaryKey: "id", required: ["email"], types: { id: "integer", email: "email" } };

describe("Phase 6 canonical preflight (unit)", () => {
  it("reports READY with configured PK/FK and parent-first order", () => {
    const report = runPreflight(fixture());
    expect(report.status).toBe("READY");
    expect(report.importOrder).toEqual(["departments", "students"]);
    expect(report.totals).toEqual({ totalRows: 4, validRows: 4, invalidRows: 0, errors: 0, warnings: 0 });
  });

  it("is byte-identical after reversing dataset and relationship declaration order", () => {
    const input = fixture();
    expect(JSON.stringify(runPreflight(input))).toBe(JSON.stringify(runPreflight({
      ...input, datasets: [...input.datasets].reverse(), relationships: [...input.relationships].reverse(),
    })));
  });

  it("counts two errors on one row as just one invalid record", () => {
    const input = fixture();
    input.datasets[0]!.rows[0]!.department_id = "999";
    input.datasets[0]!.rows[0]!.name = "";
    const report = runPreflight(input);
    expect(report.status).toBe("BLOCKED");
    expect(report.totals).toMatchObject({ totalRows: 4, validRows: 3, invalidRows: 1, errors: 2 });
    expect(report.issues.map((i) => i.code)).toEqual(["FK_NOT_FOUND", "REQUIRED"]);
  });

  it("does not double report required primary-key components", () => {
    const input = fixture();
    input.datasets[0]!.rows[0]!.id = "";
    input.rules.students.required.push("id");
    const report = runPreflight(input);
    expect(report.issues.filter((i) => i.dataset === "students" && i.code === "REQUIRED" && i.column === "id")).toHaveLength(1);
  });

  it("checks invalid numeric and email formats using mapped field rules", () => {
    const report = runPreflight({
      datasets: [parseCsvText("id,email\nabc,bad\n", "people.csv")],
      rules: { people: peopleRules }, relationships: [],
    });
    expect(report.status).toBe("BLOCKED");
    expect(report.issues.filter((i) => i.code === "INVALID_TYPE")).toHaveLength(2);
    expect(report.issues.every((i) => !i.explanation.includes("bad"))).toBe(true);
  });

  it("checks missing nonkey required values with correct physical rows", () => {
    const report = runPreflight({
      datasets: [parseCsvText("id,email\n\n1,\n", "people.csv")],
      rules: { people: peopleRules }, relationships: [],
    });
    expect(report.issues.find((i) => i.code === "REQUIRED")?.rowNumber).toBe(3);
  });

  it("returns CONFIG_ERROR for missing legacy rule configuration", () => {
    const input = fixture();
    input.rules = { departments: input.rules.departments };
    const report = runPreflight(input);
    expect(report.status).toBe("CONFIG_ERROR");
    expect(report.totals.validRows).toBeNull();
    expect(report.issues.some((i) => i.code === "BAD_SCHEMA")).toBe(true);
  });

  it("returns CONFIG_ERROR for missing referenced parent dataset", () => {
    const input = fixture();
    const report = runPreflight({ ...input, datasets: [input.datasets[0]!] });
    expect(report.status).toBe("CONFIG_ERROR");
    expect(report.totals.invalidRows).toBeNull();
    expect(report.issues.some((i) => i.code === "MISSING_REFERENCE_DATASET")).toBe(true);
    expect(report.issues.every((i) => i.category !== "DATA")).toBe(true);
  });

  it("recognizes FK type mismatches without reporting speculative orphan rows", () => {
    const input = fixture();
    input.rules.students.types.department_id = "string";
    const report = runPreflight(input);
    expect(report.status).toBe("CONFIG_ERROR");
    expect(report.issues.some((i) => i.code === "INCOMPATIBLE_COLUMN_TYPE")).toBe(true);
    expect(report.issues.every((i) => i.category !== "DATA")).toBe(true);
  });

  it("rejects contradictory legacy and explicit PK declarations", () => {
    const input = fixture();
    const report = runPreflight({ ...input, keyRules: { students: { primaryKey: ["name"] }, departments: { primaryKey: ["id"] } } });
    expect(report.status).toBe("CONFIG_ERROR");
    expect(report.issues.some((i) => i.explanation.includes("disagree"))).toBe(true);
  });

  it("accepts composite FK references to a matching composite primary key", () => {
    const report = runPreflight({
      datasets: [
        parseCsvText("country,code\nPK,SINDH\n", "regions.csv"),
        parseCsvText("id,country,code\n1,PK,SINDH\n", "cities.csv"),
      ],
      rules: {
        regions: { primaryKey: "", required: [], types: {} },
        cities: { primaryKey: "id", required: [], types: {} },
      },
      keyRules: { regions: { primaryKey: ["country", "code"] }, cities: { primaryKey: ["id"] } },
      relationships: [{ childDataset: "cities", childColumns: ["country", "code"], parentDataset: "regions", parentColumns: ["country", "code"] }],
    });
    expect(report.status).toBe("READY");
    expect(report.importOrder).toEqual(["regions", "cities"]);
  });

  it("accepts a parent UNIQUE FK target that is not a primary key", () => {
    const input = fixture();
    input.relationships = [{ childDataset: "students", childColumn: "department_id", parentDataset: "departments", parentColumn: "id" }];
    input.keyRules = {
      departments: { uniqueKeys: [["id"]] },
      students: { primaryKey: ["id"] },
    };
    input.rules.departments.primaryKey = "";
    expect(runPreflight(input).status).toBe("READY");
  });

  it("reports actual cycle membership and remains BLOCKED", () => {
    const input: PreflightInput = {
      datasets: [parseCsvText("id,b\n1,1\n", "a.csv"), parseCsvText("id,a\n1,1\n", "b.csv")],
      rules: {
        a: { primaryKey: "id", required: [], types: {} },
        b: { primaryKey: "id", required: [], types: {} },
      },
      relationships: [
        { childDataset: "a", childColumn: "b", parentDataset: "b", parentColumn: "id" },
        { childDataset: "b", childColumn: "a", parentDataset: "a", parentColumn: "id" },
      ],
    };
    const report = runPreflight(input);
    expect(report.status).toBe("BLOCKED");
    expect(report.cycleGroups).toEqual([["a", "b"]]);
    expect(report.issues.filter((i) => i.code === "DEPENDENCY_CYCLE")).toHaveLength(1);
  });

  it("fails closed with CONFIG_ERROR if physical row locations are inconsistent", () => {
    const input = fixture();
    input.datasets[0]!.rowNumbers = [];
    expect(runPreflight(input).status).toBe("CONFIG_ERROR");
  });

  it("fails closed for empty CSV collection", () => {
    expect(runPreflight({ datasets: [], rules: {}, relationships: [] }).status).toBe("CONFIG_ERROR");
  });

  it("returns canonical metadata, without raw CSV values in issues", () => {
    const input = fixture();
    input.datasets[0]!.rows[0]!.department_id = "VERY_PRIVATE_987";
    const report = runPreflight(input);
    expect(report.schemaVersion).toBe("1");
    expect(report.mode).toBe("STATIC_PREFLIGHT");
    expect(JSON.stringify(report)).not.toContain("VERY_PRIVATE_987");
  });
});
