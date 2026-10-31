import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { parseCsvText } from "../../src/lib/csv/parser";
import { runPreflight } from "../../src/lib/rehearsal/preflight";
import ReadinessInsightsPanel from "../../src/components/reports/readiness-insights-panel";
import DependencyGraph from "../../src/components/validation/dependency-graph";

function fixture(configError = false) {
  const datasets = [
    parseCsvText("id,name,department_id\n1,Sam,99\n1,Kai,10", "students.csv"),
    parseCsvText("id,name\n10,HR\n20,Eng", "departments.csv"),
  ];
  const rules = {
    students: { primaryKey: "id", required: ["name"], types: {} },
    departments: { primaryKey: "id", required: [], types: {} },
  };
  const relationships = [{ childDataset: "students", childColumn: "department_id", parentDataset: "departments", parentColumn: configError ? "absent" : "id" }];
  return { report: runPreflight({ datasets, rules, relationships }), relationships };
}
function cycle() {
  const datasets = [
    parseCsvText("id,ref\n1,2", "a.csv"),
    parseCsvText("id,ref\n2,1", "b.csv"),
    parseCsvText("id,ref\n3,2", "c.csv"),
    parseCsvText("id\n4", "independent.csv"),
  ];
  const relationships = [
    { childDataset: "a", childColumn: "ref", parentDataset: "b", parentColumn: "id" },
    { childDataset: "b", childColumn: "ref", parentDataset: "a", parentColumn: "id" },
    { childDataset: "c", childColumn: "ref", parentDataset: "b", parentColumn: "id" },
  ];
  const rules = Object.fromEntries(datasets.map((ds) => [ds.name, { primaryKey: "id", required: [], types: {} }]));
  return { report: runPreflight({ datasets, rules, relationships }), relationships };
}

describe("Phase 7 readiness and dependency UI", () => {
  it.each([
    { name: "ordered datasets", input: () => fixture(), titles: ["departments: Order 1", "students: Order 2"] },
    { name: "configuration errors", input: () => fixture(true), titles: ["departments: Unresolved order", "students: Unresolved order"] },
    { name: "cycles and downstream blocking", input: cycle, titles: ["a: Cycle group 1", "b: Cycle group 1", "c: Blocked by cycle", "independent: Order 1"] },
  ])("renders complete SVG titles without React warnings for $name", ({ input, titles }) => {
    const errors = vi.spyOn(console, "error");
    try {
      const html = renderToStaticMarkup(createElement(DependencyGraph, input()));
      expect(errors).not.toHaveBeenCalled();
      for (const title of titles) expect(html).toContain(`<title>${title}</title>`);
    } finally {
      errors.mockRestore();
    }
  });

  it("renders prioritized issues with correct issue count and investigation hints", () => {
    const html = renderToStaticMarkup(createElement(ReadinessInsightsPanel, fixture()));
    expect(html).toContain("Readiness action plan");
    expect(html).toContain("FK NOT FOUND");
    expect(html).toContain("DUPLICATE PK");
    expect(html).toContain("<strong>3</strong> blocking issues and <strong>0</strong> warnings.");
    expect(html).toContain("Prioritized validation actions");
  });
  it("does not imply migration execution or reveal raw row values", () => {
    const html = renderToStaticMarkup(createElement(ReadinessInsightsPanel, fixture()));
    expect(html).toContain("actual execution remain unverified");
    expect(html).not.toContain(">Sam<");
    expect(html).not.toContain(">99<");
  });
  it("with CONFIG_ERROR renders no suggested import order", () => {
    const { report, relationships } = fixture(true);
    const html = renderToStaticMarkup(createElement(DependencyGraph, { report, relationships }));
    expect(html).toContain("Import order unavailable");
    expect(html).not.toContain("Suggested import order:");
  });
  it("renders parent first order and accessible relationship list", () => {
    const { report, relationships } = fixture();
    const html = renderToStaticMarkup(createElement(DependencyGraph, { report, relationships }));
    expect(html).toContain("Parent to child dependencies");
    expect(html).toContain("Suggested import order:");
    expect(html).toContain("departments");
    expect(html).toContain("students");
  });
  it("separates actual cycle group from downstream blocked dataset", () => {
    const { report, relationships } = cycle();
    const html = renderToStaticMarkup(createElement(DependencyGraph, { report, relationships }));
    expect(html).toContain("Dependency cycle groups");
    expect(html).toContain("a ↔ b");
    expect(html).toContain("Downstream datasets blocked by cycles");
    expect(html).toContain("Partial import order:");
    expect(html).toContain("independent");
  });
});
