import { describe, expect, it } from "vitest";
import { parseCsvText } from "../../../src/lib/csv/parser";
import { runPreflight } from "../../../src/lib/rehearsal/preflight";
import { buildReadinessInsights } from "../../../src/lib/reports/readiness-insights";

const rules = {
  departments: { primaryKey: "id", required: ["name"], types: {} },
  students: { primaryKey: "id", required: ["name", "department_id"], types: {} },
};
function input(badTarget = false) {
  return {
    datasets: [
      parseCsvText("id,name,department_id\n1,Ali,10\n2,Sara,20\n3,Ahmed,99\n3,Bilal,10", "students.csv"),
      parseCsvText("id,name\n10,Engineering\n20,Science", "departments.csv"),
    ], rules,
    relationships: [{ childDataset: "students", childColumn: "department_id", parentDataset: "departments", parentColumn: badTarget ? "missing_column" : "id" }],
  };
}

describe("Phase 7 readiness integration with real Phase 6 preflight", () => {
  it("retains actual 6/4/2 row report vs 3 issue actions and parent-first order", () => {
    const config = input();
    const r = runPreflight(config);
    const insight = buildReadinessInsights(r, config.relationships);
    expect(r.totals).toMatchObject({ totalRows: 6, validRows: 4, invalidRows: 2, errors: 3 });
    expect(insight.actions.reduce((n, action) => n + action.count, 0)).toBe(3);
    expect(insight.dependency.importOrder).toEqual(["departments", "students"]);
    expect(insight.dependency.orderKind).toBe("COMPLETE");
  });
  it("preserves schema error status and hides order without invented evaluated counts", () => {
    const config = input(true);
    const r = runPreflight(config);
    const insight = buildReadinessInsights(r, config.relationships);
    expect(r.status).toBe("CONFIG_ERROR");
    expect(r.totals.validRows).toBeNull();
    expect(r.totals.invalidRows).toBeNull();
    expect(insight.status).toBe("CONFIG_ERROR");
    expect(insight.dependency.orderKind).toBe("UNAVAILABLE");
    expect(insight.actions.some((action) => action.category === "SCHEMA")).toBe(true);
  });
  it("keeps canonical issue ordering and presentation stable across reorders", () => {
    const config = input();
    const a = runPreflight(config);
    const b = runPreflight({ ...config, datasets: [...config.datasets].reverse() });
    expect(JSON.stringify(buildReadinessInsights(a, config.relationships))).toBe(JSON.stringify(buildReadinessInsights(b, config.relationships)));
  });
});
