import type { ColumnMapping } from "../rehearsal/mapping";
import type { FieldType } from "../rehearsal/rules";
import type { PreflightInput } from "../rehearsal/preflight";
import type { IssueCode, ReadinessStatus, RehearsalReportV1 } from "../rehearsal/types";

/** The workspace owner must change the key on every applied configuration change. */
export interface SchemaDescriptorIdentity {
  readonly sessionId: number;
  readonly configurationKey: string;
}

/** Applied metadata only. TemplateConfiguration and CSV rows are deliberately unnecessary. */
export interface SchemaDescriptorInput {
  readonly identity: SchemaDescriptorIdentity;
  readonly datasets: readonly { readonly name: string; readonly headers: readonly string[] }[];
  readonly mappings: Readonly<Record<string, readonly ColumnMapping[]>>;
  readonly rules: PreflightInput["rules"];
  readonly primaryOverrides?: Readonly<Record<string, string>>;
  readonly uniqueSpecs?: Readonly<Record<string, string>>;
  readonly relationships: PreflightInput["relationships"];
  readonly validation?: {
    readonly identity: SchemaDescriptorIdentity;
    readonly report: Pick<RehearsalReportV1, "status" | "issues">;
  };
}

export type SchemaDiagnosticCode =
  | "NO_DATASETS" | "EMPTY_DATASET_NAME" | "DUPLICATE_DATASET" | "INVALID_HEADERS"
  | "INVALID_MAPPING" | "MISSING_RULES" | "UNRESOLVED_DATASET" | "UNRESOLVED_COLUMN"
  | "AMBIGUOUS_COLUMN" | "UNRESOLVED_MAPPING" | "UNSUPPORTED_TYPE"
  | "INVALID_KEY" | "DUPLICATE_KEY" | "CONFLICTING_PRIMARY_KEY"
  | "INVALID_FOREIGN_KEY" | "DUPLICATE_FOREIGN_KEY"
  | "PREFLIGHT_CONFIGURATION" | "STALE_REPORT";

/** Fixed codes and schema locations only; never copy issue messages, IDs or rule prose. */
export interface SchemaDiagnostic {
  readonly id: string;
  readonly code: SchemaDiagnosticCode;
  readonly subjectId: string;
  readonly dataset: string | null;
  readonly column: string | null;
  readonly preflightCode: IssueCode | null;
}

export interface SchemaColumnReference {
  readonly dataset: string;
  readonly target: string | null;
  readonly datasetId: string | null;
  readonly columnId: string | null;
  readonly state: "RESOLVED" | "UNRESOLVED_DATASET" | "UNRESOLVED_COLUMN" | "AMBIGUOUS_COLUMN" | "UNRESOLVED_MAPPING";
}

export interface SchemaColumnDescriptor {
  readonly id: string;
  readonly source: string;
  readonly target: string | null;
  readonly configuredType: FieldType | null;
  readonly typeLabel: FieldType | "Not configured" | "Unsupported";
  readonly explicitlyRequired: boolean;
  readonly primaryKeyIds: readonly string[];
  readonly uniqueKeyIds: readonly string[];
}

export interface SchemaDatasetDescriptor {
  readonly id: string;
  readonly name: string;
  readonly mappingStatus: "APPLIED" | "UNRESOLVED";
  readonly columns: readonly SchemaColumnDescriptor[];
  /** Retain even extra, missing-source or empty-target declarations for investigation. */
  readonly mappings: readonly { readonly source: string; readonly target: string }[];
}

export interface SchemaFieldRuleDescriptor {
  readonly id: string;
  readonly column: SchemaColumnReference;
  readonly explicitlyRequired: boolean;
  readonly configuredType: FieldType | null;
  readonly typeLabel: SchemaColumnDescriptor["typeLabel"];
}

export interface SchemaKeyDescriptor {
  readonly id: string;
  readonly dataset: string;
  readonly kind: "PRIMARY" | "UNIQUE";
  readonly origin: "LEGACY" | "WORKSPACE";
  /** Selected by existing precedence, not a claim that the key is valid or unique in data. */
  readonly effective: boolean;
  readonly declaredColumns: readonly string[];
  readonly columns: readonly SchemaColumnReference[];
}

export interface SchemaForeignKeyDescriptor {
  readonly id: string;
  readonly childDataset: string;
  readonly parentDataset: string;
  readonly declaredChildColumns: readonly string[];
  readonly declaredParentColumns: readonly string[];
  readonly pairs: readonly {
    readonly position: number;
    readonly child: SchemaColumnReference;
    readonly parent: SchemaColumnReference;
  }[];
}

export interface WorkspaceSchemaDescriptor {
  readonly version: 1;
  readonly identity: SchemaDescriptorIdentity;
  readonly configurationState: "DESCRIBED" | "INCOMPLETE" | "BLOCKED";
  readonly validationStatus: ReadinessStatus | "NOT_EVALUATED";
  readonly datasets: readonly SchemaDatasetDescriptor[];
  readonly unresolvedMappings: readonly {
    readonly dataset: string;
    readonly mappings: readonly { readonly source: string; readonly target: string }[];
  }[];
  readonly fieldRules: readonly SchemaFieldRuleDescriptor[];
  readonly keys: readonly SchemaKeyDescriptor[];
  readonly foreignKeys: readonly SchemaForeignKeyDescriptor[];
  readonly diagnostics: readonly SchemaDiagnostic[];
}
