import { describe, expect, it } from "vitest";
import { validateSchemaConfiguration } from "../../../src/lib/rehearsal/schema";
import type { DatasetRules, Relationship } from "../../../src/lib/rehearsal/rules";

type S = { name: string; headers: string[] };

const departments: S = { name: "departments", headers: ["id", "name"] };
const students: S = { name: "students", headers: ["id", "name", "department_id"] };

function settings() {
  const datasets: S[] = [departments, students];
  const rules: Record<string, DatasetRules> = {
    departments: { primaryKey: "id", required: ["name"], types: { id: "integer" } },
    students: { primaryKey: "id", required: ["name"], types: { department_id: "integer" } },
  };
  const relationships: Relationship[] = [{
    childDataset: "students", childColumn: "department_id",
    parentDataset: "departments", parentColumn: "id",
  }];
  return { datasets, rules, relationships };
}

describe("Phase 6 schema configuration checks", () => {
  it("accepts the declared compatible student/department schema", () => {
    const { datasets, rules, relationships } = settings();
    expect(validateSchemaConfiguration(datasets, rules, relationships)).toEqual([]);
  });

  it("is deterministic despite dataset and relationship input order", () => {
    const { datasets, rules, relationships } = settings();
    rules.students.required.push("does_not_exist");
    const left = validateSchemaConfiguration(datasets, rules, relationships);
    const right = validateSchemaConfiguration([...datasets].reverse(), rules, [...relationships].reverse());
    expect(left).toEqual(right);
    expect(left[0]?.id).toMatch(/^issue_[a-f0-9]{16}$/);
    expect(left[0]?.rowNumber).toBeNull();
  });

  it("reports absent dataset rules", () => {
    const { datasets, rules, relationships } = settings();
    delete rules.students;
    const issues = validateSchemaConfiguration(datasets, rules, relationships);
    expect(issues.some((i) => i.code === "BAD_SCHEMA" && i.dataset === "students")).toBe(true);
  });

  it("reports unknown primary-key, required, and typed columns", () => {
    const { datasets, rules } = settings();
    rules.students.primaryKey = "unknown_pk";
    rules.students.required = ["unknown_required"];
    rules.students.types = { unknown_type: "integer" };
    const issues = validateSchemaConfiguration(datasets, rules, []);
    expect(issues.filter((i) => i.code === "BAD_SCHEMA")).toHaveLength(3);
  });

  it("reports a missing parent dataset without throwing", () => {
    const { datasets, rules, relationships } = settings();
    relationships[0]!.parentDataset = "missing_departments";
    const issues = validateSchemaConfiguration(datasets, rules, relationships);
    expect(issues.map((i) => i.code)).toContain("MISSING_REFERENCE_DATASET");
  });

  it("reports a missing child dataset without throwing", () => {
    const { datasets, rules, relationships } = settings();
    relationships[0]!.childDataset = "missing_students";
    const issues = validateSchemaConfiguration(datasets, rules, relationships);
    expect(issues.map((i) => i.code)).toContain("MISSING_REFERENCE_DATASET");
  });

  it("reports an FK child column missing after mapping", () => {
    const { datasets, rules, relationships } = settings();
    relationships[0]!.childColumn = "unknown_column";
    const issues = validateSchemaConfiguration(datasets, rules, relationships);
    expect(issues.map((i) => i.code)).toContain("BAD_SCHEMA");
  });

  it("reports an FK parent column missing after mapping", () => {
    const { datasets, rules, relationships } = settings();
    relationships[0]!.parentColumn = "unknown_column";
    const issues = validateSchemaConfiguration(datasets, rules, relationships);
    expect(issues.map((i) => i.code)).toContain("BAD_SCHEMA");
  });

  it("flags parent targets without a declared single-column primary key", () => {
    const { datasets, rules, relationships } = settings();
    relationships[0]!.parentColumn = "name";
    const issues = validateSchemaConfiguration(datasets, rules, relationships);
    expect(issues.map((i) => i.code)).toContain("FK_TARGET_NOT_UNIQUE");
  });

  it("flags mismatched explicitly declared FK types", () => {
    const { datasets, rules, relationships } = settings();
    rules.students.types.department_id = "string";
    const issues = validateSchemaConfiguration(datasets, rules, relationships);
    expect(issues.map((i) => i.code)).toContain("INCOMPATIBLE_COLUMN_TYPE");
  });

  it("does not invent compatibility errors for unspecified types", () => {
    const { datasets, rules, relationships } = settings();
    delete rules.students.types.department_id;
    expect(validateSchemaConfiguration(datasets, rules, relationships)).toEqual([]);
  });

  it("reports duplicate dataset names without throwing", () => {
    const { datasets, rules, relationships } = settings();
    const issues = validateSchemaConfiguration([...datasets, { ...students }], rules, relationships);
    expect(issues.map((i) => i.code)).toContain("BAD_SCHEMA");
  });

  it("reports repeated identical FK declarations once", () => {
    const { datasets, rules, relationships } = settings();
    const issues = validateSchemaConfiguration(datasets, rules, [...relationships, ...relationships, ...relationships]);
    expect(issues.filter((i) => i.code === "BAD_SCHEMA")).toHaveLength(1);
  });

  it("rejects unsupported field types as configuration errors", () => {
    const { datasets, rules } = settings();
    rules.students.types.name = "uuid" as DatasetRules["types"][string];
    const issues = validateSchemaConfiguration(datasets, rules, []);
    expect(issues.map((i) => i.code)).toContain("UNSUPPORTED_CONSTRAINT");
  });
});
