import type { ParsedCsv } from "../csv/parser";
import type { IssueCategory, IssueCode, IssueSeverity, ReadinessStatus } from "../rehearsal/types";

/** Only row counts and physical line locations are read; never copy row values into analytics. */
export type AnalyticsDataset = Pick<ParsedCsv, "name" | "rows" | "rowNumbers">;

export interface DatasetAnalytics {
  dataset: string;
  totalRows: number;
  validRows: number | null;
  invalidRows: number | null;
  blockingErrors: number;
  warnings: number;
  issueCount: number;
}

export interface IssueDistributionEntry {
  code: IssueCode;
  category: IssueCategory;
  severity: IssueSeverity;
  count: number;
}

export interface ReportAnalytics {
  status: ReadinessStatus;
  summary: {
    totalDatasets: number;
    totalRecords: number;
    validRows: number | null;
    invalidRows: number | null;
    blockingErrors: number;
    warnings: number;
    totalIssues: number;
  };
  datasets: DatasetAnalytics[];
  issueDistribution: IssueDistributionEntry[];
  /** E.g. cycle/configuration issues not tied to a named uploaded dataset. */
  unassignedIssues: number;
  readinessExplanation: string;
}
