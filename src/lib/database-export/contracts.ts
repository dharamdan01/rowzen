import { z } from "zod";

export const DATABASE_EXPORT_TARGETS = ["POSTGRESQL", "MYSQL", "MONGODB", "GRAPHQL_SDL"] as const;
export const databaseExportTargetSchema = z.enum(DATABASE_EXPORT_TARGETS);
export const configuredPreflightStatusSchema = z.enum(["READY", "READY_WITH_WARNINGS", "BLOCKED", "CONFIG_ERROR"]);
const counter = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const databaseExportRevisionsSchema = z.object({
  workspace: counter, configuration: counter, correction: counter, report: counter,
}).strict();

export const storageFamilySchema = z.enum([
  "TEXT", "INTEGER", "EXACT_DECIMAL", "FLOATING_POINT", "BOOLEAN", "DATE_ONLY",
]);
export const columnExportChoiceSchema = z.object({
  columnId: z.string().min(1).max(32_768),
  storage: storageFamilySchema,
  emptyPolicy: z.enum(["PRESERVE_EMPTY_STRING", "EMPTY_STRING_AS_NULL", "EMPTY_STRING_AS_MISSING", "REJECT_EMPTY"]),
}).strict();

/** Intent only: no SQL, values, filenames, code, connection settings or operations. */
export const databaseExportRequestSchema = z.object({
  target: databaseExportTargetSchema,
  revisions: databaseExportRevisionsSchema,
  mode: z.enum(["SCHEMA_ONLY", "SCHEMA_AND_RECORDS"]).default("SCHEMA_ONLY"),
  columns: z.array(columnExportChoiceSchema).max(5_000).default([]),
  comparisonPolicy: z.literal("ACKNOWLEDGE_TARGET_NATIVE_DIFFERENCES").optional(),
  acknowledgedMetadataOnlyConstraints: z.array(z.string().min(1).max(32_768)).max(5_000).default([]),
  recordsConsent: z.object({
    target: databaseExportTargetSchema,
    revisions: databaseExportRevisionsSchema,
    approved: z.literal(true),
  }).strict().optional(),
}).strict().superRefine((request, context) => {
  if (request.mode === "SCHEMA_ONLY" && request.recordsConsent) {
    context.addIssue({ code: "custom", message: "Record consent is not part of a schema-only request." });
  }
  if (request.mode === "SCHEMA_AND_RECORDS" && (!request.recordsConsent ||
      request.recordsConsent.target !== request.target ||
      !sameExportRevisions(request.recordsConsent.revisions, request.revisions))) {
    context.addIssue({ code: "custom", message: "Current target-scoped record consent is required." });
  }
});

export type DatabaseExportTarget = z.infer<typeof databaseExportTargetSchema>;
export type ExportRevisions = z.infer<typeof databaseExportRevisionsSchema>;
export type StorageFamily = z.infer<typeof storageFamilySchema>;
export type ColumnExportChoice = z.infer<typeof columnExportChoiceSchema>;
export type DatabaseExportRequest = z.infer<typeof databaseExportRequestSchema>;
export const postgresRecordsConsentSchema = z.object({
  target: z.literal("POSTGRESQL"), revisions: databaseExportRevisionsSchema, approved: z.literal(true),
}).strict();
export const mongoRecordsConsentSchema = z.object({
  target: z.literal("MONGODB"), revisions: databaseExportRevisionsSchema, approved: z.literal(true),
}).strict();
export const mysqlRecordsConsentSchema = z.object({
  target: z.literal("MYSQL"), revisions: databaseExportRevisionsSchema, approved: z.literal(true),
}).strict();

export function sameExportRevisions(a: ExportRevisions, b: ExportRevisions): boolean {
  return a.workspace === b.workspace && a.configuration === b.configuration &&
    a.correction === b.correction && a.report === b.report;
}
