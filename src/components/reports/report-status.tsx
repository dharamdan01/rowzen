import type { IssueSeverity } from "../../lib/rehearsal/types";

export const readinessStyles: Record<string, string> = {
  READY: "border-success bg-success-surface text-success",
  READY_WITH_WARNINGS: "border-warning bg-warning-surface text-warning",
  BLOCKED: "border-danger bg-danger-surface text-danger",
  CONFIG_ERROR: "border-danger bg-danger-surface text-danger",
};

export default function SeverityBadge({ severity }: { severity: IssueSeverity }) {
  return <span className={`inline-flex whitespace-nowrap rounded-md px-2 py-1 text-xs font-semibold ${severity === "ERROR" ? "bg-danger-surface text-danger" : "bg-warning-surface text-warning"}`}>{severity === "ERROR" ? "Error" : "Warning"}</span>;
}
