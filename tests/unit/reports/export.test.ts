import { describe, expect, it } from "vitest";
import { createIssue } from "../../../src/lib/rehearsal/issues";
import type { RehearsalReportV1 } from "../../../src/lib/rehearsal/types";
import type { ReportAnalytics } from "../../../src/lib/reports/types";
import { encodeCsvCell, prepareReportExport } from "../../../src/lib/reports/export";

const privateValue = "PRIVATE_RAW_CELL_975310";
function fixture(): { report: RehearsalReportV1; analytics: ReportAnalytics } {
  const issue = createIssue({
    code: "REQUIRED", severity: "ERROR", category: "DATA", dataset: "students",
    rowNumber: 2, column: "name", ruleId: `SECRET_RULE_${privateValue}`,
    explanation: `Secret row value ${privateValue}`,
    suggestedInvestigation: `Sensitive ${privateValue}`,
  });
  const report: RehearsalReportV1 = {
    schemaVersion: "1", mode: "STATIC_PREFLIGHT", status: "BLOCKED",
    datasets: ["students"], issues: [issue],
    totals: { totalRows: 2, validRows: 1, invalidRows: 1, errors: 1, warnings: 0 },
    importOrder: ["students"], cycleGroups: [], assumptions: [`SECRET_ASSUMPTION_${privateValue}`],
  };
  const analytics: ReportAnalytics = {
    status: "BLOCKED",
    summary: { totalDatasets: 1, totalRecords: 2, validRows: 1, invalidRows: 1, blockingErrors: 1, warnings: 0, totalIssues: 1 },
    datasets: [{ dataset: "students", totalRows: 2, validRows: 1, invalidRows: 1, blockingErrors: 1, warnings: 0, issueCount: 1 }],
    issueDistribution: [{ code: "REQUIRED", category: "DATA", severity: "ERROR", count: 1 }],
    unassignedIssues: 0, readinessExplanation: `MAYBE_PRIVATE_${privateValue}`,
  };
  return { report, analytics };
}
function output(kind: "json" | "issues-csv" | "datasets-csv") {
  const { report, analytics } = fixture();
  return prepareReportExport(report, analytics, kind);
}

describe("Phase 7 secure metadata exports", () => {
  it("produces fixed names, correct MIME types, and no timestamps", () => {
    expect(output("json")).toMatchObject({ filename: "data-rehearsal-report-safe.json", contentType: "application/json;charset=utf-8" });
    expect(output("issues-csv")).toMatchObject({ filename: "data-rehearsal-issues.csv", contentType: "text/csv;charset=utf-8" });
    expect(output("datasets-csv")).toMatchObject({ filename: "data-rehearsal-datasets.csv", contentType: "text/csv;charset=utf-8" });
    expect(output("json").content).not.toMatch(/createdAt|exportedAt|timestamp/);
  });
  it("omits arbitrary issue explanations, rule IDs, investigations and assumptions from JSON", () => {
    const json = output("json").content;
    expect(json).not.toContain(privateValue);
    for (const key of ['"ruleId"', '"explanation"', '"suggestedInvestigation"', '"assumptions"']) expect(json).not.toContain(key);
    expect(JSON.parse(json).issues[0]).toMatchObject({ code: "REQUIRED", dataset: "students", rowNumber: 2, recommendedAction: expect.any(String) });
  });
  it("omits sensitive user-defined issue text from both CSV outputs", () => {
    expect(output("issues-csv").content).not.toContain(privateValue);
    expect(output("datasets-csv").content).not.toContain(privateValue);
  });
  it("keeps distinct invalid rows separate from issue counts", () => {
    expect(JSON.parse(output("json").content).summary).toMatchObject({ invalidRows: 1, blockingErrors: 1, totalIssues: 1 });
  });
  it("includes only safe metadata with fixed recommendations in issues CSV", () => {
    const csv = output("issues-csv").content;
    expect(csv).toContain('"Issue ID","Severity","Category","Code","Dataset","CSV line","Column","Recommended action"');
    expect(csv).toContain('"ERROR","DATA","REQUIRED","students","2","name"');
    expect(csv).toContain("Provide the required field");
  });
  it("exports dataset analytics in sorted table format", () => {
    const csv = output("datasets-csv").content;
    expect(csv).toContain('"students","2","1","1","1","0","1"');
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv.endsWith("\r\n")).toBe(true);
  });
  it("properly doubles double quotes without disrupting CSV fields", () => {
    expect(encodeCsvCell('a"b,"c')).toBe('"a""b,""c"');
  });
  it("protects basic spreadsheet formula prefixes", () => {
    for (const prefix of ["=", "+", "-", "@"]) {
      expect(encodeCsvCell(`${prefix}SUM(1,1)`)).toBe(`"'${prefix}SUM(1,1)"`);
    }
  });
  it("protects leading tab, CR, newline, whitespace, BOM and zero-width bypasses", () => {
    for (const lead of ["\t", "\r", "\n", "  ", "\uFEFF", "\u200B", "\u2060"]) {
      expect(encodeCsvCell(`${lead}=1+1`)).toBe(`"'${lead}=1+1"`);
    }
  });
  it("escapes fullwidth Unicode spreadsheet function prefixes", () => {
    expect(encodeCsvCell("＝1+1")).toBe('"\'＝1+1"');
    expect(encodeCsvCell("＋CMD()")).toBe('"\'＋CMD()"');
  });
  it("does not change ordinary labels, quotation, or numeric zero", () => {
    expect(encodeCsvCell("normal")).toBe('"normal"');
    expect(encodeCsvCell(0)).toBe('"0"');
    expect(encodeCsvCell(null)).toBe('"Not evaluated"');
  });
  it("protects suspicious dataset and column labels in all three exports", () => {
    const { report, analytics } = fixture();
    report.datasets = ["=HYPERLINK(\"https://bad\")"];
    report.issues[0].dataset = report.datasets[0];
    report.issues[0].column = "+DANGEROUS";
    analytics.datasets[0].dataset = report.datasets[0];
    const issues = prepareReportExport(report, analytics, "issues-csv").content;
    const datasets = prepareReportExport(report, analytics, "datasets-csv").content;
    expect(issues).toContain("'=HYPERLINK");
    expect(issues).toContain("'+DANGEROUS");
    expect(datasets).toContain("'=HYPERLINK");
    const snapshot = JSON.parse(prepareReportExport(report, analytics, "json").content);
    expect(snapshot.datasets[0].dataset).toBe(report.datasets[0]);
  });
  it("returns exactly a CSV header for an empty issues report", () => {
    const { report, analytics } = fixture();
    report.status = "READY"; report.issues = [];
    report.totals = { totalRows: 2, validRows: 2, invalidRows: 0, errors: 0, warnings: 0 };
    analytics.status = "READY";
    analytics.summary = { ...analytics.summary, validRows: 2, invalidRows: 0, blockingErrors: 0, totalIssues: 0 };
    analytics.datasets = [{ ...analytics.datasets[0], validRows: 2, invalidRows: 0, blockingErrors: 0, issueCount: 0 }];
    expect(prepareReportExport(report, analytics, "issues-csv").content.split("\r\n")).toHaveLength(2);
  });
  it("preserves CONFIG_ERROR null validity in JSON/CSV and hides import order", () => {
    const { report, analytics } = fixture();
    report.status = "CONFIG_ERROR"; report.totals.validRows = null; report.totals.invalidRows = null;
    analytics.status = "CONFIG_ERROR"; analytics.summary.validRows = null; analytics.summary.invalidRows = null;
    analytics.datasets[0].validRows = null; analytics.datasets[0].invalidRows = null;
    const snap = JSON.parse(prepareReportExport(report, analytics, "json").content);
    expect(snap.summary).toMatchObject({ validRows: null, invalidRows: null });
    expect(snap.dependency.recommendedImportOrder).toEqual([]);
    expect(prepareReportExport(report, analytics, "datasets-csv").content).toContain('"Not evaluated","Not evaluated"');
  });
  it("preserves READY_WITH_WARNINGS without turning warnings into invalid rows", () => {
    const { report, analytics } = fixture();
    report.status = "READY_WITH_WARNINGS";
    report.issues[0].severity = "WARNING";
    report.totals = { totalRows: 2, validRows: 2, invalidRows: 0, errors: 0, warnings: 1 };
    analytics.status = "READY_WITH_WARNINGS";
    analytics.summary = { ...analytics.summary, validRows: 2, invalidRows: 0, blockingErrors: 0, warnings: 1 };
    analytics.datasets = [{ ...analytics.datasets[0], validRows: 2, invalidRows: 0, blockingErrors: 0, warnings: 1 }];
    const snapshot = JSON.parse(prepareReportExport(report, analytics, "json").content);
    expect(snapshot).toMatchObject({ status: "READY_WITH_WARNINGS", summary: { validRows: 2, invalidRows: 0, blockingErrors: 0, warnings: 1 } });
  });
  it("fails closed on mismatched row totals or stale report", () => {
    const { report, analytics } = fixture();
    analytics.summary.invalidRows = 2;
    expect(() => prepareReportExport(report, analytics, "json")).toThrow(/do not match/);
  });
  it("fails closed on duplicate issue identities", () => {
    const { report, analytics } = fixture();
    report.issues.push(report.issues[0]);
    report.totals.errors = 2; analytics.summary.blockingErrors = 2; analytics.summary.totalIssues = 2;
    expect(() => prepareReportExport(report, analytics, "json")).toThrow(/duplicated issue identity/);
  });
  it("rejects unsafe externally supplied issue identifiers instead of exporting them", () => {
    const { report, analytics } = fixture();
    report.issues[0].id = "=SENSITIVE_USER_VALUE";
    expect(() => prepareReportExport(report, analytics, "issues-csv")).toThrow(/Invalid or duplicated/);
  });
  it("rejects unknown export kinds", () => {
    const { report, analytics } = fixture();
    expect(() => prepareReportExport(report, analytics, "xml" as "json")).toThrow(/Unsupported/);
  });
});
