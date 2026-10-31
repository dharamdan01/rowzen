import { describe, expect, it } from "vitest";
import { validationRunSchema } from "../../src/lib/services/schemas";
import { createMappingTemplateSchema } from "../../src/lib/templates/schema";

const summary = { status: "BLOCKED", totalRows: 6, validRows: 4, invalidRows: 2, issueCount: 3 };
const config = {
  version: 1 as const,
  datasets: [{ name: "students", headers: ["id"] }],
  mappings: { students: [{ source: "id", target: "id" }] },
  rules: { students: { primaryKey: "id", required: [], types: {} } },
  relationships: [], compositeRelationships: [], primaryOverrides: {}, uniqueSpecs: {},
};

describe("Phase 8 release: strict server persistence privacy contracts", () => {
  it("accepts valid summary-only metadata", () => {
    expect(validationRunSchema.safeParse(summary).success).toBe(true);
  });
  it("rejects raw CSV fields even with otherwise valid summary metadata", () => {
    expect(validationRunSchema.safeParse({ ...summary, rows: [{ id: "private" }] }).success).toBe(false);
    expect(validationRunSchema.safeParse({ ...summary, rawCsv: "private" }).success).toBe(false);
  });
  it("rejects correction history and individual issue details in summary", () => {
    expect(validationRunSchema.safeParse({ ...summary, correctionHistory: [] }).success).toBe(false);
    expect(validationRunSchema.safeParse({ ...summary, issues: [{ message: "personal data" }] }).success).toBe(false);
  });
  it("CONFIG_ERROR cannot fabricate evaluated row counts", () => {
    expect(validationRunSchema.safeParse({ status: "CONFIG_ERROR", totalRows: 6, validRows: 0, invalidRows: 0, issueCount: 1 }).success).toBe(false);
    expect(validationRunSchema.safeParse({ status: "CONFIG_ERROR", totalRows: 6, validRows: null, invalidRows: null, issueCount: 1 }).success).toBe(true);
  });
  it("accepts strict configuration-only mapping template", () => {
    expect(createMappingTemplateSchema.safeParse({ name: "Student mapping", configuration: config }).success).toBe(true);
  });
  it("rejects records nested inside mapping template datasets", () => {
    const bad = { ...config, datasets: [{ name: "students", headers: ["id"], rows: [{ id: "private" }] }] };
    expect(createMappingTemplateSchema.safeParse({ name: "Student mapping", configuration: bad }).success).toBe(false);
  });
  it("rejects correction values and history in template payload", () => {
    expect(createMappingTemplateSchema.safeParse({ name: "Student mapping", configuration: { ...config, corrections: [{ value: "private" }] } }).success).toBe(false);
    expect(createMappingTemplateSchema.safeParse({ name: "Student mapping", configuration: config, correctionHistory: [] }).success).toBe(false);
  });
});
