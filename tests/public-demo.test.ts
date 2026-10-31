import { describe, expect, it } from "vitest";
import { demoConfiguration, emptyDemoSettings, exampleDemoSettings, hasDemoChecks, readDemoFiles } from "../src/lib/demo/configuration";
import { parseCsvText } from "../src/lib/csv/parser";
import { revalidateCorrectionSnapshot } from "../src/lib/corrections/revalidation";
import { prepareReportExport } from "../src/lib/reports/export";
const csv = (text: string, name = "anything.csv") => parseCsvText(text, name);
describe("public demo canonical configuration", () => {
  it("accepts one arbitrary CSV, keeps all checks explicitly unconfigured and never infers keys", async () => {
    const datasets = await readDemoFiles([new File(["SKU,description\n001,hello"], "own.csv")]);
    const settings = emptyDemoSettings(datasets);
    expect(hasDemoChecks(settings, [])).toBe(false); expect(exampleDemoSettings(datasets)).toBeNull();
    const { report } = revalidateCorrectionSnapshot(datasets, demoConfiguration(datasets, settings, []));
    expect(report.status).toBe("READY"); expect(report.issues).toEqual([]);
    expect(datasets[0].rows[0].SKU).toBe("001");
  });
  it("preserves multiline physical locations and original values while detecting declared types", () => {
    const datasets = [csv('SKU,notes,amount\r\n001,"first\r\nsecond",PRIVATE_BAD\r\n002,ok,2')];
    const before = structuredClone(datasets), settings = emptyDemoSettings(datasets);
    settings[0].columns[2].type = "integer";
    const result = revalidateCorrectionSnapshot(datasets, demoConfiguration(datasets, settings, []));
    expect(result.report.issues).toMatchObject([{ code: "INVALID_TYPE", rowNumber: 2, column: "amount" }]);
    expect(datasets[0].rowNumbers).toEqual([2, 4]); expect(datasets).toEqual(before);
    const exported = prepareReportExport(result.report, result.analytics, "json").content;
    expect(exported).not.toContain("PRIVATE_BAD"); expect(exported).not.toContain("first"); expect(exported).not.toContain('"001"');
  });
  it("uses canonical composite PK, required and independent unique semantics", () => {
    const datasets = [csv("country,code,email\nA,01,same\nA,01,same\nB,,")], settings = emptyDemoSettings(datasets);
    settings[0].columns[0].primary = true; settings[0].columns[1].primary = true; settings[0].columns[2].unique = true; settings[0].columns[2].required = true;
    const result = revalidateCorrectionSnapshot(datasets, demoConfiguration(datasets, settings, [])).report;
    expect(result.issues.map(issue => issue.code)).toEqual(expect.arrayContaining(["DUPLICATE_PK", "DUPLICATE_UNIQUE", "REQUIRED"]));
  });
  it("never invents a relationship; explicit example rules preserve the two-file demo", () => {
    const datasets = [csv("id,name,department_id\n1,Ada,99", "students.csv"), csv("id,name\n10,Science", "departments.csv")];
    expect(demoConfiguration(datasets, emptyDemoSettings(datasets), []).relationships).toEqual([]);
    const example = exampleDemoSettings(datasets)!;
    const report = revalidateCorrectionSnapshot(datasets, demoConfiguration(datasets, example.settings, example.relationships)).report;
    expect(report.issues).toMatchObject([{ code: "FK_NOT_FOUND" }]); expect(report.importOrder).toEqual(["departments", "students"]);
  });
  it("retains configuration errors and unevaluated counts for a nonunique parent key", () => {
    const datasets = [csv("fk\n1", "child.csv"), csv("key\n1", "parent.csv")], settings = emptyDemoSettings(datasets);
    const config = demoConfiguration(datasets, settings, [{ childDataset: "child", childColumn: "fk", parentDataset: "parent", parentColumn: "key" }]);
    const report = revalidateCorrectionSnapshot(datasets, config).report;
    expect(report.status).toBe("CONFIG_ERROR"); expect(report.totals.validRows).toBeNull();
  });
  it("rejects stale header rules and unknown relationship endpoints", () => {
    const datasets = [csv("code\n001")], settings = emptyDemoSettings(datasets);
    const changed = [csv("replacement\n001")];
    expect(() => demoConfiguration(changed, settings, [])).toThrow(/headers/);
    expect(() => demoConfiguration(datasets, settings, [{ childDataset: "missing", childColumn: "code", parentDataset: "anything", parentColumn: "code" }])).toThrow(/Relationship/);
  });
  it.each(["code,code\n1,2", 'code,name\n1,"unterminated', "", "code\n"])("rejects malformed or empty CSV %j using the canonical parser", async text => {
    await expect(readDemoFiles([new File([text], "custom.csv")])).rejects.toThrow();
  });
  it("retains file-count, duplicate-name, byte-size and strict UTF-8 limits", async () => {
    const file = () => new File(["x\n1"], "x.csv");
    await expect(readDemoFiles([])).rejects.toThrow(/1 or 2/);
    await expect(readDemoFiles([file(), file(), file()])).rejects.toThrow(/1 or 2/);
    await expect(readDemoFiles([file(), file()])).rejects.toThrow(/distinct/);
    await expect(readDemoFiles([new File([new Uint8Array(1048577)], "big.csv")])).rejects.toThrow(/1 MB/);
    await expect(readDemoFiles([new File([new Uint8Array([255])], "bad.csv")])).rejects.toThrow(/UTF-8/);
  });
  it("preserves hostile-looking UTF-8 headers as data without invoking them", () => {
    const datasets = [csv("__proto__,<script>,日本語\n001,plain,yes")], settings = emptyDemoSettings(datasets);
    const config = demoConfiguration(datasets, settings, []);
    const report = revalidateCorrectionSnapshot(datasets, config).report;
    expect(report.status).toBe("READY"); expect(datasets[0].rows[0].__proto__).toBe("001");
  });
});
