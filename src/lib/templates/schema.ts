import { z } from "zod";

const identifier = z.string().min(1).max(128).refine((v) => v.trim() === v && !/[\u0000-\u001f\u007f]/.test(v), "Invalid identifier");
const datasetName = z.string().min(1).max(255).refine((v) => v.trim() === v && !/[\u0000-\u001f\u007f]/.test(v));
const fieldType = z.enum(["string", "integer", "number", "boolean", "date", "email"]);
const mapping = z.object({ source: identifier, target: identifier }).strict();
const rule = z.object({
  primaryKey: z.string().max(128),
  required: z.array(identifier).max(256),
  types: z.record(identifier, fieldType),
}).strict();
const relationship = z.object({
  childDataset: datasetName, childColumn: identifier,
  parentDataset: datasetName, parentColumn: identifier,
}).strict();
const compositeRelationship = z.object({
  childDataset: datasetName, childColumns: z.array(identifier).min(1).max(16),
  parentDataset: datasetName, parentColumns: z.array(identifier).min(1).max(16),
}).strict().refine((r) => r.childColumns.length === r.parentColumns.length, "FK column counts differ");

/** Configuration only: strict schemas reject unexpected raw CSV or correction history properties. */
export const templateConfigurationSchema = z.object({
  version: z.literal(1),
  datasets: z.array(z.object({ name: datasetName, headers: z.array(identifier).min(1).max(256) }).strict()).min(1).max(5),
  mappings: z.record(datasetName, z.array(mapping).min(1).max(256)),
  rules: z.record(datasetName, rule),
  relationships: z.array(relationship).max(100),
  compositeRelationships: z.array(compositeRelationship).max(100),
  primaryOverrides: z.record(datasetName, z.string().max(512)),
  uniqueSpecs: z.record(datasetName, z.string().max(4096)),
}).strict().superRefine((value, ctx) => {
  const seen = new Set<string>();
  for (const dataset of value.datasets) {
    if (seen.has(dataset.name)) {
      ctx.addIssue({ code: "custom", message: "Duplicate dataset", path: ["datasets"] });
    }
    seen.add(dataset.name);
    if (new Set(dataset.headers).size !== dataset.headers.length) {
      ctx.addIssue({ code: "custom", message: "Duplicate header", path: ["datasets"] });
    }
    const configured = value.mappings[dataset.name];
    if (!configured || configured.length !== dataset.headers.length ||
      configured.some((entry, i) => entry.source !== dataset.headers[i]) ||
      new Set(configured.map((entry) => entry.target.toLowerCase())).size !== configured.length) {
      ctx.addIssue({ code: "custom", message: "Mapping must cover original source headers exactly, in order, with distinct targets", path: ["mappings", dataset.name] });
    }
    if (!value.rules[dataset.name]) {
      ctx.addIssue({ code: "custom", message: "Dataset rules missing", path: ["rules", dataset.name] });
    }
  }
  for (const collection of ["mappings", "rules", "primaryOverrides", "uniqueSpecs"] as const) {
    for (const name of Object.keys(value[collection])) {
      if (!seen.has(name)) {
        ctx.addIssue({ code: "custom", message: "Unknown dataset in template", path: [collection, name] });
      }
    }
  }
  for (const rel of [...value.relationships, ...value.compositeRelationships]) {
    if (!seen.has(rel.childDataset) || !seen.has(rel.parentDataset)) {
      ctx.addIssue({ code: "custom", message: "Relationship references unknown dataset", path: ["relationships"] });
    }
  }
});

export const createMappingTemplateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  configuration: templateConfigurationSchema,
}).strict();

export type TemplateConfiguration = z.infer<typeof templateConfigurationSchema>;
export type MappingTemplateInput = z.infer<typeof createMappingTemplateSchema>;

export interface StoredMappingTemplate {
  id: string;
  name: string;
  projectId: string;
  configuration: TemplateConfiguration;
  createdAt: string;
  updatedAt: string;
}
