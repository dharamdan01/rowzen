import { describe, expect, it } from "vitest";
import { parseCsvText } from "../../../src/lib/csv/parser";
import { runPreflight } from "../../../src/lib/rehearsal/preflight";
import { buildReportAnalytics } from "../../../src/lib/reports/analytics";
import { prepareReportExport } from "../../../src/lib/reports/export";

function example(badParent = false, reverse = false) {
  const datasets = [
    parseCsvText("id,name,department_id\n1,PRIVATE_ALICE_219,10\n2,PRIVATE_BOB_771,20\n3,PRIVATE_CAROL_649,99\n3,PRIVATE_DAVE_718,10", "students.csv"),
    parseCsvText("id,name\n10,PRIVATE_ENGINEERING_221\n20,PRIVATE_SCIENCE_938", "departments.csv"),
  ];
  const input = {
    datasets: reverse ? [...datasets].reverse() : datasets,
    rules: {
      students: { primaryKey: "id", required: ["name", "department_id"], types: {} },
      departments: { primaryKey: "id", required: ["name"], types: {} },
    },
    relationships: [{ childDataset: "students", childColumn: "department_id", parentDataset: "departments", parentColumn: badParent ? "missing_parent" : "id" }],
  };
  const report = runPreflight(input);
  return { report, analytics: buildReportAnalytics(report, input.datasets) };
}

describe("Phase 7 S5 integration with actual parser and preflight", () => {
  it("exports true 6/4/2 record metrics while counting all three errors", () => {
    const { report, analytics } = example();
    const snapshot = JSON.parse(prepareReportExport(report, analytics, "json").content);
    expect(snapshot.status).toBe("BLOCKED");
    expect(snapshot.summary).toMatchObject({ totalDatasets: 2, totalRecords: 6, validRows: 4, invalidRows: 2, blockingErrors: 3, totalIssues: 3 });
    expect(snapshot.issues).toHaveLength(3);
    expect(snapshot.dependency.recommendedImportOrder).toEqual(["departments", "students"]);
  });
  it("does not export any original private CSV cell content across three formats", () => {
    const { report, analytics } = example();
    for (const kind of ["json", "issues-csv", "datasets-csv"] as const) {
      const data = prepareReportExport(report, analytics, kind).content;
      for (const secret of ["PRIVATE_ALICE_219", "PRIVATE_BOB_771", "PRIVATE_CAROL_649", "PRIVATE_ENGINEERING_221", "PRIVATE_SCIENCE_938"]) {
        expect(data).not.toContain(secret);
      }
      expect(data).not.toContain("department_id,99");
    }
  });
  it("exports byte-for-byte identical outputs regardless of parsed dataset order", () => {
    const a = example(false, false);
    const b = example(false, true);
    for (const kind of ["json", "issues-csv", "datasets-csv"] as const) {
      expect(prepareReportExport(a.report, a.analytics, kind).content)
        .toBe(prepareReportExport(b.report, b.analytics, kind).content);
    }
  });
  it("keeps CONFIG_ERROR unknown row validity and does not fabricate a full import order", () => {
    const { report, analytics } = example(true);
    const snap = JSON.parse(prepareReportExport(report, analytics, "json").content);
    expect(snap.status).toBe("CONFIG_ERROR");
    expect(snap.summary).toMatchObject({ totalRecords: 6, validRows: null, invalidRows: null });
    expect(snap.dependency.recommendedImportOrder).toEqual([]);
    expect(prepareReportExport(report, analytics, "datasets-csv").content).toContain("Not evaluated");
  });
});
