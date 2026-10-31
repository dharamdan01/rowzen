
import { describe, expect, it } from "vitest";

import {
  buildWorkspaceKeyRules,
  splitKeyColumns,
} from "../../../src/lib/rehearsal/workspace-config";

import {
  toLegacyRunSummary,
} from "../../../src/lib/rehearsal/report-persistence";

import { createIssue } from "../../../src/lib/rehearsal/issues";

import type {
  DatasetRules,
} from "../../../src/lib/rehearsal/rules";

import type {
  RehearsalReportV1,
} from "../../../src/lib/rehearsal/types";

const rules: Record<string, DatasetRules> = {
  students: {
    primaryKey: "id",
    required: ["name"],
    types: {},
  },
  departments: {
    primaryKey: "id",
    required: [],
    types: {},
  },
};

const report = (
  status: RehearsalReportV1["status"],
): RehearsalReportV1 => ({
  schemaVersion: "1",
  mode: "STATIC_PREFLIGHT",
  status,
  datasets: ["students"],
  issues: [],
  totals: {
    totalRows: 2,
    validRows: status === "CONFIG_ERROR" ? null : 2,
    invalidRows: status === "CONFIG_ERROR" ? null : 0,
    errors: 0,
    warnings: 0,
  },
  importOrder: ["students"],
  cycleGroups: [],
  assumptions: [],
});

describe(
  "Phase 6 UI configuration and report persistence boundary",
  () => {
    it("defaults to legacy PK when no Phase 6 controls are configured", () => {
      expect(
        buildWorkspaceKeyRules(rules, {}, {})
      ).toEqual({});
    });

    it("supports composite primary keys without ambiguous joining", () => {
      expect(
        buildWorkspaceKeyRules(
          rules,
          { students: "country, code" },
          {},
        ).students?.primaryKey
      ).toEqual(["country", "code"]);
    });

    it("supports a legacy PK combined with additional UNIQUE keys", () => {
      expect(
        buildWorkspaceKeyRules(
          rules,
          {},
          { students: "email\ncountry, code" },
        ).students
      ).toEqual({
        primaryKey: ["id"],
        uniqueKeys: [
          ["email"],
          ["country", "code"],
        ],
      });
    });

    it("keeps malformed key tokens visible for schema validation", () => {
      expect(splitKeyColumns("a,, b")).toEqual([
        "a",
        "",
        "b",
      ]);
    });

    it("produces deterministic config regardless of dataset property order", () => {
      expect(
        buildWorkspaceKeyRules(
          rules,
          {},
          { students: "email" },
        )
      ).toEqual(
        buildWorkspaceKeyRules(
          {
            departments: rules.departments,
            students: rules.students,
          },
          {},
          { students: "email" },
        )
      );
    });

    it("creates a legacy READY summary without raw CSV values", () => {
      expect(toLegacyRunSummary(report("READY"))).toEqual({
        status: "READY",
        totalRows: 2,
        validRows: 2,
        invalidRows: 0,
        issueCount: 0,
      });
    });

    it("preserves BLOCKED status without conversion", () => {
      const blocked = report("BLOCKED");

      // A BLOCKED report must contain at least one issue.
      blocked.issues = [
        createIssue({
          code: "FK_NOT_FOUND",
          severity: "ERROR",
          category: "DATA",
          dataset: "students",
          rowNumber: 2,
          column: "department_id",
          ruleId:
            "fk:students.department_id->departments.id",
          explanation:
            "Referenced department record is missing.",
          suggestedInvestigation:
            "Check the referenced departments dataset.",
        }),
      ];

      // Two rows: one valid and one invalid.
      blocked.totals.validRows = 1;
      blocked.totals.invalidRows = 1;
      blocked.totals.errors = 1;

      expect(toLegacyRunSummary(blocked)).toEqual({
        status: "BLOCKED",
        totalRows: 2,
        validRows: 1,
        invalidRows: 1,
        issueCount: 1,
      });
    });

    it("does not coerce READY_WITH_WARNINGS into READY", () => {
      expect(
        toLegacyRunSummary(report("READY_WITH_WARNINGS"))
      ).toBeNull();
    });

    it("does not persist unknown row counts for CONFIG_ERROR", () => {
      expect(
        toLegacyRunSummary(report("CONFIG_ERROR"))
      ).toBeNull();
    });

    it("rejects inconsistent totals instead of sending an invalid summary", () => {
      const wrong = report("READY");
      wrong.totals.invalidRows = 9;

      expect(toLegacyRunSummary(wrong)).toBeNull();
    });
  },
);
