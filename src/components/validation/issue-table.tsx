import type { ValidationIssue } from "../../lib/rehearsal/rules";
import type { RehearsalIssue } from "../../lib/rehearsal/types";
import { EmptyState, Table } from "../ui/primitives";

type DisplayIssue = ValidationIssue | RehearsalIssue;
function structured(issue: DisplayIssue): issue is RehearsalIssue {
  return "explanation" in issue;
}

/** Accept the legacy Phase 5 issue type and the new structured Phase 6 type. */
export default function IssueTable({ issues }: { issues: readonly DisplayIssue[] }) {
  if (!issues.length) {
    return <EmptyState tone="success">No row-level issues found by configured rules.</EmptyState>;
  }

  return (
    <Table scrollLabel="Validation issues table">
      <caption>Validation issues ({issues.length})</caption>
      <thead><tr>
        {["Dataset", "CSV line", "Column", "Rule", "Message"].map((label) => (
          <th key={label} scope="col">{label}</th>
        ))}
      </tr></thead>
      <tbody>
        {issues.map((issue, index) => (
          <tr key={structured(issue) ? issue.id : `${issue.dataset}-${issue.rowNumber}-${issue.code}-${index}`}>
            <td className="min-w-28">{issue.dataset}</td>
            <td className="whitespace-nowrap tabular-nums">{issue.rowNumber ?? "—"}</td>
            <td className="min-w-28">{issue.column ?? "—"}</td>
            <td className="min-w-32">{issue.code}</td>
            <td className="min-w-56">
              {structured(issue) ? <>
                <span className="font-semibold">{issue.severity}</span>{" — "}{issue.explanation}
                <details className="mt-2 text-sm">
                  <summary className="cursor-pointer">Investigation and issue metadata</summary>
                  <p className="mt-2"><strong>Suggested investigation:</strong> {issue.suggestedInvestigation}</p>
                  <p><strong>Category:</strong> {issue.category}</p>
                  <p className="[overflow-wrap:anywhere]"><strong>Issue ID:</strong> <code>{issue.id}</code></p>
                  <p className="[overflow-wrap:anywhere]"><strong>Rule:</strong> {issue.ruleId}</p>
                  {issue.referencedRecords.length > 0 && <p>
                    <strong>Referenced records:</strong>{" "}{issue.referencedRecords.map((r) => `${r.dataset}:${r.rowNumber}`).join(", ")}
                  </p>}
                  {issue.relatedIssueIds.length > 0 && <p className="[overflow-wrap:anywhere]">
                    <strong>Related issues:</strong> {issue.relatedIssueIds.join(", ")}
                  </p>}
                </details>
              </> : issue.message}
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
