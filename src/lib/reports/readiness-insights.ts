/**
 * Phase 7 S4: deterministic, presentation-only interpretation of a Phase 6 report.
 * Never reruns validation, sends data, mutates the report, or declares an import safe.
 */
import { analyzeDependencyGraph, type DependencyEdge } from "../rehearsal/graph";
import type { ForeignKeyDeclaration } from "../rehearsal/foreign-keys";
import type { IssueCategory, IssueCode, IssueSeverity, ReadinessStatus, RehearsalReportV1 } from "../rehearsal/types";

const cmp = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;

export interface ReadinessAction {
  code: IssueCode;
  category: IssueCategory;
  severity: IssueSeverity;
  count: number;
  datasets: string[];
  affectedRows: number;
  investigations: string[];
}

export interface ReadinessInsights {
  status: ReadinessStatus;
  explanation: string;
  blockingErrors: number;
  warnings: number;
  actions: ReadinessAction[];
  dependency: {
    edges: DependencyEdge[];
    importOrder: string[];
    cycleGroups: string[][];
    blockedByCycles: string[];
    unresolvedDatasets: string[];
    orderKind: "COMPLETE" | "PARTIAL" | "UNAVAILABLE";
    reason: string;
  };
}

const readinessText: Record<ReadinessStatus, string> = {
  READY: "All configured static checks passed. The actual database import has not been tested.",
  READY_WITH_WARNINGS: "No blocking errors were reported. Review warnings before an import attempt.",
  BLOCKED: "Blocking findings or dependency cycles require attention before an import attempt.",
  CONFIG_ERROR: "Fix schema or relationship configuration first. Row validity was not evaluated.",
};

const priority: Record<IssueCategory | "WARNING", number> = {
  SCHEMA: 0,
  DEPENDENCY: 1,
  DATA: 2,
  WARNING: 3,
};

/** Returns only preflight metadata; no CSV cells, DB reads, timestamps, or network. */
export function buildReadinessInsights(
  report: RehearsalReportV1,
  relationships: readonly ForeignKeyDeclaration[],
): ReadinessInsights {
  const graph = analyzeDependencyGraph(report.datasets, relationships);
  const groups = new Map<string, {
    code: IssueCode;
    category: IssueCategory;
    severity: IssueSeverity;
    count: number;
    datasets: Set<string>;
    rows: Set<string>;
    investigations: Set<string>;
  }>();

  for (const issue of report.issues) {
    const key = JSON.stringify([issue.category, issue.severity, issue.code]);
    let group = groups.get(key);
    if (!group) {
      group = {
        code: issue.code, category: issue.category, severity: issue.severity,
        count: 0, datasets: new Set(), rows: new Set(), investigations: new Set(),
      };
      groups.set(key, group);
    }
    group.count++;
    if (report.datasets.includes(issue.dataset)) group.datasets.add(issue.dataset);
    if (issue.category === "DATA" && issue.rowNumber !== null) {
      group.rows.add(JSON.stringify([issue.dataset, issue.rowNumber]));
    }
    if (issue.suggestedInvestigation.trim()) group.investigations.add(issue.suggestedInvestigation.trim());
  }

  const actions: ReadinessAction[] = [...groups.values()].map((group) => ({
    code: group.code,
    category: group.category,
    severity: group.severity,
    count: group.count,
    datasets: [...group.datasets].sort(cmp),
    affectedRows: group.rows.size,
    investigations: [...group.investigations].sort(cmp),
  })).sort((a, b) =>
    (a.severity === "WARNING" ? priority.WARNING : priority[a.category]) -
    (b.severity === "WARNING" ? priority.WARNING : priority[b.category]) ||
    cmp(a.code, b.code) || cmp(a.category, b.category) || cmp(a.severity, b.severity));

  // The canonical report owns readiness, cycle groups, and import order.
  // Fresh graph analysis supplies only extra impact metadata. If declarations
  // no longer match the report, avoid presenting a misleading import plan.
  const graphMatchesReport =
    JSON.stringify(graph.importOrder) === JSON.stringify(report.importOrder) &&
    JSON.stringify(graph.cycleGroups) === JSON.stringify(report.cycleGroups);
  const configInvalid = report.status === "CONFIG_ERROR" || graph.issues.some((issue) => issue.category === "SCHEMA" && issue.severity === "ERROR");
  const orderKind: ReadinessInsights["dependency"]["orderKind"] =
    !graphMatchesReport || configInvalid || report.importOrder.length === 0
      ? "UNAVAILABLE"
      : report.cycleGroups.length > 0 ? "PARTIAL" : "COMPLETE";
  const reason = !graphMatchesReport
    ? "Configured relationships have changed since this report. Run validation again."
    : configInvalid
      ? "Import order is unavailable until configuration errors are corrected."
      : report.cycleGroups.length > 0
        ? "Only acyclic datasets have a justified parent-first position. Cyclic and downstream datasets remain unresolved."
        : report.importOrder.length === 0
          ? "No validated import order is available."
          : "Parent-first order is an advisory sequence for configured datasets, not an executed migration plan.";

  return {
    status: report.status,
    explanation: readinessText[report.status],
    blockingErrors: report.issues.filter((issue) => issue.severity === "ERROR").length,
    warnings: report.issues.filter((issue) => issue.severity === "WARNING").length,
    actions,
    dependency: {
      edges: graphMatchesReport ? graph.edges : [],
      importOrder: orderKind === "UNAVAILABLE" ? [] : [...report.importOrder],
      cycleGroups: report.cycleGroups.map((group) => [...group]),
      blockedByCycles: graphMatchesReport ? [...graph.blockedByCycles] : [],
      unresolvedDatasets: graphMatchesReport ? [...graph.unresolvedDatasets] : [...report.datasets].sort(cmp),
      orderKind,
      reason,
    },
  };
}
