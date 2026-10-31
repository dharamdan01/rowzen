import { describe, expect, it } from "vitest";
import type { RehearsalReportV1, RehearsalIssue } from "../../../src/lib/rehearsal/types";
import { createIssue } from "../../../src/lib/rehearsal/issues";
import {
  toLegacyRunSummary,
  toValidationRunSummary,
} from "../../../src/lib/rehearsal/report-persistence";
import { validationRunSchema } from "../../../src/lib/services/schemas";

const errorIssue = createIssue({
  code: "FK_NOT_FOUND", severity: "ERROR", category: "DATA",
  dataset: "students", rowNumber: 3, column: "department_id",
  ruleId: "fk:students.department_id->departments.id",
  explanation: "Parent record missing", suggestedInvestigation: "Check parent CSV",
});
const warningIssue: RehearsalIssue = {
  ...errorIssue, id: "issue_warning", severity: "WARNING", category: "DEPENDENCY", rowNumber: null,
};
const schemaIssue: RehearsalIssue = {
  ...errorIssue, id: "issue_schema", code: "BAD_SCHEMA", category: "SCHEMA", rowNumber: null,
};

function report(
  status: RehearsalReportV1["status"],
  issues: RehearsalIssue[],
  validRows: number | null,
  invalidRows: number | null,
): RehearsalReportV1 {
  return {
    schemaVersion: "1", mode: "STATIC_PREFLIGHT", status,
    datasets: ["students"], issues,
    totals: { totalRows: 6, validRows, invalidRows,
      errors: issues.filter((i) => i.severity === "ERROR").length,
      warnings: issues.filter((i) => i.severity === "WARNING").length },
    importOrder: ["students"], cycleGroups: [], assumptions: [],
  };
}

describe("safe report-to-API conversion", () => {
  const cases: RehearsalReportV1[] = [
    report("READY", [], 6, 0),
    report("BLOCKED", [errorIssue], 5, 1),
    report("READY_WITH_WARNINGS", [warningIssue], 6, 0),
    report("CONFIG_ERROR", [schemaIssue], null, null),
  ];

  it("accepts all four preflight states and matches server validation", () => {
    for (const item of cases) {
      const summary = toValidationRunSummary(item);
      expect(summary).not.toBeNull();
      expect(validationRunSchema.safeParse(summary).success).toBe(true);
      expect(Object.keys(summary!).sort()).toEqual(
        ["status", "totalRows", "validRows", "invalidRows", "issueCount"].sort(),
      );
    }
  });
  it("preserves null for unassessed configuration-error rows", () => {
    expect(toValidationRunSummary(cases[3])?.validRows).toBeNull();
    expect(toValidationRunSummary(cases[3])?.invalidRows).toBeNull();
  });
  it("does not send issue details or raw CSV contents", () => {
    const json = JSON.stringify(toValidationRunSummary(cases[1]));
    expect(json).not.toContain("students");
    expect(json).not.toContain("department_id");
    expect(json).not.toContain("explanation");
  });
  it("rejects inconsistent states rather than fabricating counts", () => {
    expect(toValidationRunSummary(report("CONFIG_ERROR", [schemaIssue], 0, 6))).toBeNull();
    expect(toValidationRunSummary(report("READY_WITH_WARNINGS", [], 6, 0))).toBeNull();
    expect(toValidationRunSummary(report("READY_WITH_WARNINGS", [errorIssue], 5, 1))).toBeNull();
    expect(toValidationRunSummary(report("READY", [errorIssue], 5, 1))).toBeNull();
  });
  it("keeps the original READY/BLOCKED helper working for existing tests", () => {
    expect(toLegacyRunSummary(cases[0])?.status).toBe("READY");
    expect(toLegacyRunSummary(cases[1])?.status).toBe("BLOCKED");
    expect(toLegacyRunSummary(cases[2])).toBeNull();
    expect(toLegacyRunSummary(cases[3])).toBeNull();
  });
});
