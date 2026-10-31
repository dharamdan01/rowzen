import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createIssue } from "../../src/lib/rehearsal/issues";
import IssueExplorer from "../../src/components/reports/issue-explorer";

const sampleIssue = createIssue({
  dataset: "students",
  rowNumber: 4,
  column: "department_id",
  code: "FK_NOT_FOUND",
  category: "DATA",
  severity: "ERROR",
  ruleId: "fk:students.department_id->departments.id",
  explanation: "No matching department record",
  suggestedInvestigation: "Review the parent CSV",
});

describe("Phase 7 issue explorer accessible markup", () => {
  it("renders labeled search, filters, and navigation", () => {
    const html = renderToStaticMarkup(createElement(IssueExplorer, { issues: [sampleIssue] }));
    expect(html).toContain("Issue explorer");
    expect(html).toContain("Search issues");
    expect(html).toContain("Sort direction");
    expect(html).toContain("Filtered validation issues");
    expect(html).toContain("Previous");
    expect(html).toContain("Next");
    expect(html).toContain("FK_NOT_FOUND");
  });
  it("explains an empty report without fabricating rows", () => {
    const html = renderToStaticMarkup(createElement(IssueExplorer, { issues: [] }));
    expect(html).toContain("No validation issues in this report");
    expect(html).toContain("Showing 0–0 of 0 matching issues");
  });
  it("escapes untrusted display text", () => {
    const malicious = { ...sampleIssue, explanation: '<script>alert("x")</script>' };
    const html = renderToStaticMarkup(createElement(IssueExplorer, { issues: [malicious] }));
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
  });
});
