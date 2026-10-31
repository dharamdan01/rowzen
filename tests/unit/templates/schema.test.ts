import { describe, expect, it } from "vitest";
import { createMappingTemplateSchema, templateConfigurationSchema } from "../../../src/lib/templates/schema";
import { captureTemplateConfiguration, checkTemplateCompatibility } from "../../../src/lib/templates/workspace";

const dataset = { name: "students", filename: "students.csv", headers: ["id", "name"], rows: [{ id: "1", name: "Private raw student" }], rowNumbers: [2] };
const config = () => captureTemplateConfiguration({
  datasets: [dataset], mappings: { students: [{ source: "id", target: "id" }, { source: "name", target: "name" }] },
  rules: { students: { primaryKey: "id", required: ["name"], types: { id: "integer" } } },
  relationships: [], compositeRelationships: [], primaryOverrides: {}, uniqueSpecs: {},
});
const clone = () => JSON.parse(JSON.stringify(config()));

describe("Phase 8 S7 schema and privacy contracts", () => {
  it("captures mapping and rule configuration only", () => {
    const value = config();
    expect(value.datasets).toEqual([{ name: "students", headers: ["id", "name"] }]);
    expect(JSON.stringify(value)).not.toContain("Private raw student");
    expect(JSON.stringify(value)).not.toContain("rows");
  });
  it("accepts a valid strict template", () => expect(createMappingTemplateSchema.safeParse({ name: "Class roster", configuration: config() }).success).toBe(true));
  it("rejects empty template names", () => expect(createMappingTemplateSchema.safeParse({ name: " ", configuration: config() }).success).toBe(false));
  it("rejects overly long names", () => expect(createMappingTemplateSchema.safeParse({ name: "x".repeat(81), configuration: config() }).success).toBe(false));
  it("rejects pasted raw CSV rows", () => {
    const x = clone(); x.datasets[0].rows = dataset.rows;
    expect(templateConfigurationSchema.safeParse(x).success).toBe(false);
  });
  it("rejects top-level correction history", () => {
    const x = clone(); x.correctionHistory = [{ before: "1", after: "2" }];
    expect(templateConfigurationSchema.safeParse(x).success).toBe(false);
  });
  it("rejects future schema versions", () => {
    const x = clone(); x.version = 2;
    expect(templateConfigurationSchema.safeParse(x).success).toBe(false);
  });
  it("rejects duplicated datasets", () => {
    const x = clone(); x.datasets.push(x.datasets[0]);
    expect(templateConfigurationSchema.safeParse(x).success).toBe(false);
  });
  it("rejects mismatched mapping source order", () => {
    const x = clone(); x.mappings.students.reverse();
    expect(templateConfigurationSchema.safeParse(x).success).toBe(false);
  });
  it("rejects duplicate mapping targets", () => {
    const x = clone(); x.mappings.students[1].target = "ID";
    expect(templateConfigurationSchema.safeParse(x).success).toBe(false);
  });
  it("rejects unknown extra dataset config keys", () => {
    const x = clone(); x.rules.other = x.rules.students;
    expect(templateConfigurationSchema.safeParse(x).success).toBe(false);
  });
  it("rejects missing rule configuration", () => {
    const x = clone(); delete x.rules.students;
    expect(templateConfigurationSchema.safeParse(x).success).toBe(false);
  });
  it("rejects unknown relationship dataset", () => {
    const x = clone(); x.relationships.push({ childDataset: "students", childColumn: "id", parentDataset: "missing", parentColumn: "id" });
    expect(templateConfigurationSchema.safeParse(x).success).toBe(false);
  });
  it("rejects composite FK arity mismatch", () => {
    const x = clone(); x.compositeRelationships.push({ childDataset: "students", childColumns: ["id", "name"], parentDataset: "students", parentColumns: ["id"] });
    expect(templateConfigurationSchema.safeParse(x).success).toBe(false);
  });
  it("requires same dataset names and original headers", () => {
    expect(checkTemplateCompatibility(config(), [dataset])).toEqual({ ok: true });
    expect(checkTemplateCompatibility(config(), [{ name: "students", headers: ["name", "id"] }]).ok).toBe(false);
    expect(checkTemplateCompatibility(config(), [{ name: "other", headers: ["id", "name"] }]).ok).toBe(false);
  });
  it("does not alter original records when capturing", () => {
    const before = structuredClone(dataset);
    config();
    expect(dataset).toEqual(before);
  });
});
