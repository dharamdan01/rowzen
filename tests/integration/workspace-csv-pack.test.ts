import { describe, expect, it } from "vitest";
import { configuredPack, driftPack, packFile } from "../fixtures/workspace-csv-pack";
import { readCsvFile } from "../../src/lib/csv/parser";
import { revalidateCorrectionSnapshot } from "../../src/lib/corrections/revalidation";
import { applyCellCorrection, createCorrectionState, undoCorrection, redoCorrection } from "../../src/lib/corrections/engine";
import { compareSchemaTemplate, buildSchemaMappingContext, serializeSchemaMappingContext } from "../../src/lib/ai/schema-mapping";
import { createAiVersion } from "../../src/lib/ai/contracts";

describe("supplied CSV pack with the current workspace pipeline", () => {
  it.each([false, true])("validates actual configured clean/blocked pack (blocked=%s) without changing its records", blocked => {
    const {datasets, config} = configuredPack(blocked);
    const before = structuredClone(datasets);
    const {report} = revalidateCorrectionSnapshot(datasets, config);
    expect(report.status).toBe(blocked ? "BLOCKED" : "READY");
    expect(report.totals).toMatchObject(blocked ? {totalRows: 7, validRows: 4, invalidRows: 3} : {totalRows: 14, validRows: 14, invalidRows: 0});
    expect(report.issues).toHaveLength(blocked ? 9 : 0);
    expect(datasets[0].rows[0].postal_code).toBe("00123");
    expect(datasets).toEqual(before);
  });
  it("preserves original pack bytes, leading-zero strings and corrections across revalidation, undo and redo", () => {
    const {datasets, config} = configuredPack();
    const original = createCorrectionState(datasets);
    const changed = applyCellCorrection(original, {dataset: datasets[0].name, rowNumber: 2, column: "full_name", expectedValue: datasets[0].rows[0].full_name, value: "Approved local correction"});
    revalidateCorrectionSnapshot(changed.current, config);
    expect(changed.original).toEqual(datasets);
    expect(changed.current[0].rows[0].postal_code).toBe("00123");
    const undone = undoCorrection(changed);
    expect(undone.current).toEqual(original.current);
    expect(redoCorrection(undone).current).toEqual(changed.current);
    expect(changed.undoStack).toHaveLength(1);
  });
  it.each([
    ["v2", ["student_id", "semester"], ["student_no"], false],
    ["v3", [], ["dept_code"], false],
    ["v4", [], [], true],
  ] as const)("detects %s drift using real headers, without assuming a successful template load", (version, added, removed, reordered) => {
    const current = driftPack(version), previous = driftPack("v1");
    expect(compareSchemaTemplate(current.template, "students", previous.template)).toMatchObject({status: "compared", added, removed, reordered, compatibility: {ok: false}});
  });
  it("does not compare differently named pack datasets as though their identities match", () => {
    const current = driftPack("v2", false), previous = driftPack("v1", false);
    expect(compareSchemaTemplate(current.template, current.dataset.name, previous.template).status).toBe("dataset_missing");
  });
  it("keeps pack row values and dataset names out of optional AI metadata", () => {
    const {datasets, template} = configuredPack();
    const context = buildSchemaMappingContext({configuration: template, datasetName: datasets[0].name, dataset: datasets[0], template: null, version: createAiVersion()});
    const wire = serializeSchemaMappingContext(context);
    for (const row of datasets[0].rows) for (const key of ["full_name", "email", "postal_code"]) expect(wire).not.toContain(row[key]);
    expect(wire).not.toContain(datasets[0].name);
    expect(wire).not.toMatch(/correctionHistory|undoStack|rowNumbers/);
  });
  it.each(["duplicate_headers.csv", "header_only.csv", "invalid_utf8.csv", "malformed_quotes.csv", "missing_header_cell.csv", "not_a_csv.txt", "over_1mb.csv"])("rejects actual invalid upload %s", async name => {
    const file = packFile(`07_upload_errors/${name}`);
    await expect(readCsvFile(new File([new Uint8Array(file.buffer)], file.name))).rejects.toThrow();
  });
});
