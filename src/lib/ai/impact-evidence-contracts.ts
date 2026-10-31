import { z } from "zod";
import { aiCounterSchema as count, aiIssueCodeSchema, aiReadinessStatusSchema, aiVersionSchema } from "./contracts";

const alias = (prefix: string) => z.string().regex(new RegExp(`^${prefix}\\d{1,5}$`));
export const impactIssueIdSchema = alias("i");
const datasetId = alias("d"), relationshipId = alias("f");
const issueIds = z.array(impactIssueIdSchema).max(10_000);
const datasets = z.array(datasetId).max(5);
const severity = z.enum(["ERROR", "WARNING"]), category = z.enum(["DATA", "SCHEMA", "DEPENDENCY"]);

/** Serializable facts only. Labels, real issue/rule IDs, locations and prose stay local. */
export const impactEvidenceSchema = z.object({
  schemaVersion: z.literal(1), source: z.literal("LIVE_REPORT"), version: aiVersionSchema,
  report: z.object({
    status: aiReadinessStatusSchema, rowValidity: z.enum(["EVALUATED", "UNEVALUATED"]),
    totalRows: count, validRows: count.nullable(), invalidRows: count.nullable(),
    errors: count, warnings: count, issueCount: count, affectedRecords: count.nullable(),
  }).strict(),
  datasets: z.array(z.object({
    id: datasetId, totalRows: count, validRows: count.nullable(), invalidRows: count.nullable(),
    errors: count, warnings: count, issueCount: count, affectedRecords: count.nullable(),
  }).strict()).min(1).max(5),
  issues: z.array(z.object({
    id: impactIssueIdSchema, code: aiIssueCodeSchema, severity, category,
    datasetId: datasetId.nullable(), columnId: alias("c").nullable(), ruleId: alias("r"),
    relationshipIds: z.array(relationshipId).max(200), relatedIssueIds: issueIds, actionId: alias("a"),
  }).strict()).max(10_000),
  actions: z.array(z.object({
    id: alias("a"), code: aiIssueCodeSchema, severity, category, count,
    datasetIds: datasets, affectedRecords: count.nullable(),
  }).strict()).max(66),
  relationships: z.array(z.object({
    id: relationshipId, parentId: datasetId, childId: datasetId,
    parentColumnIds: z.array(alias("c")).min(1).max(16), childColumnIds: z.array(alias("c")).min(1).max(16),
    evidence: z.enum(["VERIFIED_DEPENDENCY", "CONFIGURATION_ONLY"]),
  }).strict()).max(200),
  dependency: z.object({
    evidence: z.enum(["VERIFIED", "UNAVAILABLE"]), orderKind: z.enum(["COMPLETE", "PARTIAL", "UNAVAILABLE"]),
    edges: z.array(z.object({ parentId: datasetId, childId: datasetId, relationshipIds: z.array(relationshipId).min(1).max(200) }).strict()).max(25),
    importOrder: datasets, cycleGroups: z.array(datasets).max(5), blockedByCycles: datasets, unresolvedDatasets: datasets,
  }).strict(),
  potentialDownstream: z.array(z.object({
    sourceId: datasetId, datasetIds: datasets, affectedRecords: z.null(),
    evidence: z.literal("CONFIGURED_DEPENDENCY_ONLY"),
  }).strict()).max(5),
}).strict();

export type ImpactEvidenceData = z.infer<typeof impactEvidenceSchema>;
