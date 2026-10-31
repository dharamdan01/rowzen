
/** Phase 6 report contracts. No raw CSV records or credentials belong here. */

export type IssueSeverity = "ERROR" | "WARNING";
export type IssueCategory = "DATA" | "SCHEMA" | "DEPENDENCY";

export type IssueCode =
  | "REQUIRED"
  | "INVALID_TYPE"
  | "DUPLICATE_PK"
  | "DUPLICATE_UNIQUE"
  | "FK_NOT_FOUND"
  | "MISSING_REFERENCE_DATASET"
  | "BAD_SCHEMA"
  | "INCOMPATIBLE_COLUMN_TYPE"
  | "FK_TARGET_NOT_UNIQUE"
  | "UNSUPPORTED_CONSTRAINT"
  | "DEPENDENCY_CYCLE";

export interface IssueReference {
  dataset: string;
  /** Original physical CSV line, not the array index. */
  rowNumber: number;
  column: string | null;
}

export interface RehearsalIssue {
  /** Stable for the same issue location, code, and ruleId. Not an auth token. */
  id: string;
  code: IssueCode;
  severity: IssueSeverity;
  category: IssueCategory;
  dataset: string;
  /** null for dataset-level/schema/graph issues. */
  rowNumber: number | null;
  column: string | null;
  /** Stable constraint key, e.g. 'fk:students.department_id->departments.id'. */
  ruleId: string;
  explanation: string;
  referencedRecords: IssueReference[];
  suggestedInvestigation: string;
  relatedIssueIds: string[];
}

export type ReadinessStatus =
  | "READY"
  | "READY_WITH_WARNINGS"
  | "BLOCKED"
  | "CONFIG_ERROR";

/** Reserved for later subfeatures. Do not persist the full report yet. */
export interface RehearsalReportV1 {
  schemaVersion: "1";
  mode: "STATIC_PREFLIGHT";
  status: ReadinessStatus;
  datasets: string[];
  issues: RehearsalIssue[];
  totals: {
    totalRows: number;
    validRows: number | null;
    invalidRows: number | null;
    errors: number;
    warnings: number;
  };
  importOrder: string[];
  cycleGroups: string[][];
  assumptions: string[];
}
