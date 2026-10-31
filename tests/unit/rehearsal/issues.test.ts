
import { describe, expect, it } from "vitest";
import {
  createIssue,
  finalizeIssues,
} from "../../../src/lib/rehearsal/issues";
import type {
  IssueDraft,
} from "../../../src/lib/rehearsal/issues";

const sample: IssueDraft = {
  code: "FK_NOT_FOUND",
  severity: "ERROR",
  category: "DATA",
  dataset: "students",
  rowNumber: 4,
  column: "department_id",
  ruleId: "fk:students.department_id->departments.id",
  explanation: "No matching department record was found",
  suggestedInvestigation: "Check the parent dataset and mapping",
};

describe("structured Phase 6 issues", () => {
  it("creates stable issue IDs without embedding issue text", () => {
    const a = createIssue(sample);
    const b = createIssue({
      ...sample,
      explanation: "Reworded explanation",
    });

    expect(a.id).toBe(b.id);
    expect(a.id).toMatch(/^issue_[a-f0-9]{16}$/);
    expect(a.id).not.toContain("students");
  });

  it("distinguishes different rows and FK rules", () => {
    const a = createIssue(sample);

    expect(
      createIssue({ ...sample, rowNumber: 5 }).id
    ).not.toBe(a.id);

    expect(
      createIssue({
        ...sample,
        ruleId: "fk:students.department_id->other.id",
      }).id
    ).not.toBe(a.id);
  });

  it("orders results identically regardless of input order", () => {
    const a = createIssue(sample);
    const b = createIssue({
      ...sample,
      rowNumber: 2,
    });

    const c = createIssue({
      ...sample,
      dataset: "departments",
      rowNumber: null,
      column: null,
      code: "BAD_SCHEMA",
      category: "SCHEMA",
      ruleId: "schema:departments",
    });

    expect(finalizeIssues([a, c, b])).toEqual(
      finalizeIssues([b, a, c])
    );
  });

  it("sorts reference locations and deduplicates related IDs", () => {
    const issue = createIssue({
      ...sample,
      referencedRecords: [
        {
          dataset: "departments",
          rowNumber: 8,
          column: "id",
        },
        {
          dataset: "departments",
          rowNumber: 3,
          column: "id",
        },
      ],
      relatedIssueIds: [
        "issue_z",
        "issue_a",
        "issue_z",
      ],
    });

    expect(
      issue.referencedRecords.map((r) => r.rowNumber)
    ).toEqual([3, 8]);

    expect(issue.relatedIssueIds).toEqual([
      "issue_a",
      "issue_z",
    ]);
  });

  it("rejects duplicate issue identities instead of hiding them", () => {
    const issue = createIssue(sample);

    expect(() =>
      finalizeIssues([issue, createIssue(sample)])
    ).toThrow(/Duplicate issue identity/);
  });

  it("rejects invalid row numbers", () => {
    expect(() =>
      createIssue({ ...sample, rowNumber: 0 })
    ).toThrow(/positive physical line/);
  });
});
