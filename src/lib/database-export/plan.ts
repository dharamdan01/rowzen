import { buildWorkspaceSchemaDescriptor } from "../schema-diagram/descriptor";
import { captureSchemaDiagramConfiguration } from "../schema-diagram/workspace";
import type { WorkspaceSchemaDescriptor } from "../schema-diagram/types";
import { configuredPreflightStatusSchema, databaseExportRequestSchema, databaseExportRevisionsSchema, sameExportRevisions } from "./contracts";
import { DATABASE_EXPORT_CAPABILITIES, supportedStorageFamilies } from "./compatibility";
import { DatabaseExportError, freezeExport } from "./types";
import type { ConstraintCompatibility, DatabaseExportPlan, ExportFinding, ExportPlanSource } from "./types";

function constraintsFor(schema: WorkspaceSchemaDescriptor, target: DatabaseExportPlan["manifest"]["target"]): ConstraintCompatibility[] {
  const capabilities = DATABASE_EXPORT_CAPABILITIES[target].constraints;
  const result: ConstraintCompatibility[] = [];
  for (const key of schema.keys) {
    const kind = key.kind === "PRIMARY" ? key.columns.length > 1 ? "COMPOSITE_PRIMARY_KEY" : "PRIMARY_KEY"
      : key.columns.length > 1 ? "COMPOSITE_UNIQUE_KEY" : "UNIQUE_KEY";
    result.push({ id: key.id, kind, support: capabilities[kind] });
  }
  for (const fk of schema.foreignKeys) {
    const kind = fk.pairs.length > 1 ? "COMPOSITE_FOREIGN_KEY" : "FOREIGN_KEY";
    result.push({ id: fk.id, kind, support: capabilities[kind] });
  }
  for (const rule of schema.fieldRules) {
    if (rule.explicitlyRequired) result.push({ id: JSON.stringify(["required", rule.id]), kind: "REQUIRED_NONBLANK", support: capabilities.REQUIRED_NONBLANK });
    if (rule.configuredType === "email") result.push({ id: JSON.stringify(["email", rule.id]), kind: "EMAIL_FORMAT", support: capabilities.EMAIL_FORMAT });
  }
  return result.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}
/** IDs to acknowledge only after the caller has collected explicit target-semantics approval. */
export function metadataOnlyConstraintIds(schema: WorkspaceSchemaDescriptor, target: DatabaseExportPlan["manifest"]["target"]): string[] {
  return constraintsFor(schema, target).filter(item => item.support === "METADATA_ONLY").map(item => item.id);
}

/** Pure metadata planning. It cannot produce a data file or prove a database import. */
export function buildDatabaseExportPlan(source: ExportPlanSource, input: unknown): DatabaseExportPlan {
  const parsed = databaseExportRequestSchema.safeParse(input);
  const revisions = databaseExportRevisionsSchema.safeParse(source.revisions);
  if (!parsed.success || !revisions.success) throw new DatabaseExportError("INVALID_REQUEST");
  const request = parsed.data;
  if (!sameExportRevisions(request.revisions, revisions.data)) throw new DatabaseExportError("STALE");
  let schema: WorkspaceSchemaDescriptor;
  try {
    if (source.configuration.validation && !configuredPreflightStatusSchema.safeParse(source.configuration.validation.report.status).success) {
      throw new DatabaseExportError("INVALID_CONFIGURATION");
    }
    const configuration = captureSchemaDiagramConfiguration(source.configuration);
    schema = buildWorkspaceSchemaDescriptor({ ...configuration, validation: source.configuration.validation });
  } catch { throw new DatabaseExportError("INVALID_CONFIGURATION"); }
  if (schema.datasets.reduce((sum, dataset) => sum + dataset.columns.length, 0) > 5_000 ||
      schema.foreignKeys.reduce((sum, fk) => sum + fk.pairs.length, 0) > 2_000) {
    throw new DatabaseExportError("INVALID_CONFIGURATION");
  }

  const constraints = constraintsFor(schema, request.target);
  const columns = schema.datasets.flatMap(dataset => dataset.columns);
  const columnIds = new Set(columns.map(column => column.id));
  const choices = new Map(request.columns.map(choice => [choice.columnId, choice]));
  const acknowledgements = new Set(request.acknowledgedMetadataOnlyConstraints);
  const metadataOnly = new Set(constraints.filter(item => item.support === "METADATA_ONLY").map(item => item.id));
  if (choices.size !== request.columns.length || acknowledgements.size !== request.acknowledgedMetadataOnlyConstraints.length ||
      [...choices.keys()].some(id => !columnIds.has(id)) || [...acknowledgements].some(id => !metadataOnly.has(id))) {
    throw new DatabaseExportError("INVALID_REQUEST");
  }

  const findings: ExportFinding[] = [];
  const add = (code: ExportFinding["code"], severity: ExportFinding["severity"], subjectId: string | null = null) => {
    findings.push({ code, severity, subjectId });
  };
  if (source.draftsPending) add("PENDING_DRAFTS", "ERROR");
  if (schema.configurationState !== "DESCRIBED") add("INVALID_CONFIGURATION", "ERROR");
  if (schema.validationStatus === "NOT_EVALUATED") add("CURRENT_REPORT_REQUIRED", "ERROR");
  for (const column of columns) {
    const choice = choices.get(column.id);
    if (!choice) { add("COLUMN_CHOICE_REQUIRED", "CHOICE", column.id); continue; }
    if (!supportedStorageFamilies(request.target, column.configuredType).includes(choice.storage)) add("UNSUPPORTED_STORAGE", "ERROR", column.id);
    const required = column.explicitlyRequired || column.primaryKeyIds.length > 0;
    if ((required && choice.emptyPolicy !== "REJECT_EMPTY") ||
        (choice.emptyPolicy === "EMPTY_STRING_AS_MISSING" && request.target !== "MONGODB") ||
        (choice.storage !== "TEXT" && choice.emptyPolicy === "PRESERVE_EMPTY_STRING")) add("INVALID_EMPTY_POLICY", "ERROR", column.id);
    if (column.configuredType && choice.storage === "TEXT" && !["string", "email"].includes(column.configuredType)) {
      add("TYPE_RULE_METADATA_ONLY", "WARNING", column.id);
    }
    if (["INTEGER", "EXACT_DECIMAL", "FLOATING_POINT", "DATE_ONLY"].includes(choice.storage)) add("TARGET_TYPE_LIMITS_UNVERIFIED", "WARNING", column.id);
  }
  if (constraints.length && !request.comparisonPolicy) add("COMPARISON_POLICY_REQUIRED", "CHOICE");
  for (const constraint of constraints) {
    if (constraint.support === "METADATA_ONLY") add("METADATA_ONLY_CONSTRAINT", acknowledgements.has(constraint.id) ? "WARNING" : "CHOICE", constraint.id);
    if (constraint.support === "UNSUPPORTED") add("UNSUPPORTED_CONSTRAINT", "ERROR", constraint.id);
  }
  if (request.mode === "SCHEMA_AND_RECORDS") {
    add("RECORD_EXPORT_NOT_IMPLEMENTED", "ERROR");
    if (!["READY", "READY_WITH_WARNINGS"].includes(schema.validationStatus)) add("DATA_PREFLIGHT_BLOCKED", "ERROR");
  }
  add("TARGET_ADAPTER_NOT_IMPLEMENTED", "WARNING");
  add("PREFLIGHT_NOT_DATABASE_COMPATIBILITY", "WARNING");
  const status = findings.some(item => item.severity === "ERROR") ? "BLOCKED"
    : findings.some(item => item.severity === "CHOICE") ? "NEEDS_CHOICES" : "PLANNED";
  const orderedChoices = columns.flatMap(column => choices.has(column.id) ? [choices.get(column.id)!] : []);
  return freezeExport({
    revisions: { ...revisions.data }, status, findings,
    manifest: {
      version: 1, target: request.target, mode: request.mode, containsRecords: false,
      configuredPreflight: schema.validationStatus, databaseCompatibility: "NOT_VERIFIED",
      schema: { version: schema.version, configurationState: schema.configurationState, datasets: schema.datasets,
        unresolvedMappings: schema.unresolvedMappings, fieldRules: schema.fieldRules, keys: schema.keys,
        foreignKeys: schema.foreignKeys, diagnostics: schema.diagnostics },
      choices: orderedChoices, comparisonPolicy: request.comparisonPolicy ?? null,
      acknowledgedMetadataOnlyConstraints: [...acknowledgements].sort(), constraints,
      warnings: findings.filter(item => item.severity === "WARNING"),
      unsupportedFeatures: findings.filter(item => ["METADATA_ONLY_CONSTRAINT", "UNSUPPORTED_CONSTRAINT", "UNSUPPORTED_STORAGE",
        "TYPE_RULE_METADATA_ONLY", "TARGET_ADAPTER_NOT_IMPLEMENTED", "RECORD_EXPORT_NOT_IMPLEMENTED"].includes(item.code)),
      assumptions: [
        "Configured static preflight is not database compatibility or an import guarantee.",
        "No database version, collation, physical type bounds, existing objects or permissions have been verified.",
        "Empty-string conversion does not trim whitespace or interpret literal NULL tokens; missing properties must be rejected.",
        "CSV quoting and skipped empty records cannot be reconstructed from parsed snapshots.",
        "Native constraints do not reproduce trimmed string comparison, nonblank rules or all configured format checks.",
        "No cascade, generated identity, cardinality, default, destructive operation or executable command is inferred.",
        "Schema labels are potentially private; review metadata before sharing.",
      ],
      policy: { schemaOnlyDefault: true, destructiveOperations: false, automaticExecution: false,
        dataEncoding: "NOT_IMPLEMENTED", spreadsheetSanitizationForDatabaseValues: false },
    },
  });
}
