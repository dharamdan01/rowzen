import type { SchemaDescriptorInput, WorkspaceSchemaDescriptor } from "../schema-diagram/types";
import type { DatabaseExportRequest, DatabaseExportTarget, ExportRevisions } from "./contracts";

export type Capability = "SUPPORTED" | "CHOICE_REQUIRED" | "METADATA_ONLY" | "UNSUPPORTED";
export type ConstraintKind = "PRIMARY_KEY" | "COMPOSITE_PRIMARY_KEY" | "UNIQUE_KEY" |
  "COMPOSITE_UNIQUE_KEY" | "FOREIGN_KEY" | "COMPOSITE_FOREIGN_KEY" | "REQUIRED_NONBLANK" | "EMAIL_FORMAT" |
  "CUSTOM_CHECK" | "DEFAULT_VALUE" | "GENERATED_IDENTITY" | "CASCADE_ACTION" | "TRIGGER";
export type ExportFindingCode =
  | "INVALID_CONFIGURATION" | "CURRENT_REPORT_REQUIRED" | "STALE_REPORT" | "PENDING_DRAFTS"
  | "COLUMN_CHOICE_REQUIRED" | "UNSUPPORTED_STORAGE" | "INVALID_EMPTY_POLICY"
  | "COMPARISON_POLICY_REQUIRED" | "METADATA_ONLY_CONSTRAINT" | "UNSUPPORTED_CONSTRAINT"
  | "TARGET_ADAPTER_NOT_IMPLEMENTED" | "RECORD_EXPORT_NOT_IMPLEMENTED" | "DATA_PREFLIGHT_BLOCKED"
  | "TARGET_TYPE_LIMITS_UNVERIFIED" | "TYPE_RULE_METADATA_ONLY" | "PREFLIGHT_NOT_DATABASE_COMPATIBILITY";

export interface ExportFinding {
  readonly code: ExportFindingCode;
  readonly severity: "ERROR" | "CHOICE" | "WARNING";
  readonly subjectId: string | null;
}

export interface ConstraintCompatibility {
  readonly id: string;
  readonly kind: ConstraintKind;
  readonly support: Capability;
}

/** These are metadata collections from our explicit projection, not caller objects. */
export type ExportSchemaMetadata = Pick<WorkspaceSchemaDescriptor,
  "version" | "configurationState" | "datasets" | "unresolvedMappings" | "fieldRules" | "keys" | "foreignKeys" | "diagnostics">;

export interface DatabaseExportManifest {
  readonly version: 1;
  readonly target: DatabaseExportTarget;
  readonly mode: DatabaseExportRequest["mode"];
  readonly containsRecords: false;
  readonly configuredPreflight: WorkspaceSchemaDescriptor["validationStatus"];
  readonly databaseCompatibility: "NOT_VERIFIED";
  readonly schema: ExportSchemaMetadata;
  readonly choices: readonly DatabaseExportRequest["columns"][number][];
  readonly comparisonPolicy: DatabaseExportRequest["comparisonPolicy"] | null;
  readonly acknowledgedMetadataOnlyConstraints: readonly string[];
  readonly constraints: readonly ConstraintCompatibility[];
  readonly warnings: readonly ExportFinding[];
  readonly unsupportedFeatures: readonly ExportFinding[];
  readonly assumptions: readonly string[];
  readonly policy: {
    readonly schemaOnlyDefault: true;
    readonly destructiveOperations: false;
    readonly automaticExecution: false;
    readonly dataEncoding: "NOT_IMPLEMENTED";
    readonly spreadsheetSanitizationForDatabaseValues: false;
  };
}

export interface DatabaseExportPlan {
  readonly revisions: ExportRevisions;
  /** PLANNED means metadata choices are resolved, never permission to execute/import. */
  readonly status: "PLANNED" | "NEEDS_CHOICES" | "BLOCKED";
  readonly findings: readonly ExportFinding[];
  readonly manifest: DatabaseExportManifest;
}

export interface ExportPlanSource {
  readonly configuration: SchemaDescriptorInput;
  readonly revisions: ExportRevisions;
  readonly draftsPending: boolean;
}

export class DatabaseExportError extends Error {
  constructor(readonly code: "INVALID_REQUEST" | "INVALID_CONFIGURATION" | "STALE" | "CANCELLED" | "DISPOSED") {
    super(code === "STALE" ? "The export scope changed. Prepare a new plan." : `Database export refused: ${code}.`);
    this.name = "DatabaseExportError";
  }
}

export function freezeExport<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) freezeExport(child);
    Object.freeze(value);
  }
  return value;
}
