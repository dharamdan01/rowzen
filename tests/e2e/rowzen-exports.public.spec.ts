import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import HistoryResults from "../../src/components/reports/history-results";
import { parseHistoryFilters, historyPageHref } from "../../src/lib/reports/history-filters";
import { mkdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { packFile, packDataset } from "../fixtures/workspace-csv-pack";
import { themeFixture } from "./helpers/theme-fixture";
import { workspaceStep } from "./helpers/workspace-navigation";
import { parseCsvText } from "../../src/lib/csv/parser";

const folder = resolve("playwright/.cache/rowzen-exports-20261027");
const dataset = packDataset("06_export/escaping_unicode.csv");
const approvedText = "LOCAL_EXPORT_APPROVED\nSecond line";
const pg = (page: Page) => page.getByRole("region", {name: "PostgreSQL schema export", exact: true});
const mysql = (page: Page) => page.getByRole("region", {name: "MySQL database export", exact: true});
const mongo = (page: Page) => page.getByRole("region", {name: "MongoDB document export", exact: true});
async function show(page: Page, theme: "light" | "dark" = "light") {
  const posts: {url: string; body: unknown}[] = [];
  let template: Record<string, unknown> | null = null, failSave = false;
  await page.route("**/api/projects**", route => {
    const url = route.request().url();
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON(); posts.push({url, body});
      if (url.endsWith("/templates")) {template = {...body, id: "export-template", projectId: "theme-project"}; return route.fulfill({status: 201, contentType: "application/json", body: JSON.stringify({template})});}
      return route.fulfill({status: failSave ? 503 : 201, contentType: "application/json", body: JSON.stringify(failSave ? {} : {run: {...body, id: "export-summary"}})});
    }
    return route.fulfill({contentType: "application/json", body: JSON.stringify(url.endsWith("/templates") ? {templates: template ? [template] : []} : {projects: [{id: "theme-project", name: "Synthetic export project"}]})});
  });
  await page.route("http://127.0.0.1:11434/**", route => route.abort("connectionrefused"));
  await themeFixture(page, "workspace", theme);
  await page.locator("#csv-files").setInputFiles(packFile("06_export/escaping_unicode.csv"));
  await workspaceStep(page, "Configure"); await page.getByLabel("Primary key for escaping_unicode", {exact: true}).selectOption("record_id");
  await workspaceStep(page, "Validate"); await page.getByRole("button", {name: "Run Validation", exact: true}).click();
  await expect(page.getByRole("heading", {name: "Migration readiness: READY", exact: true})).toBeVisible();
  await workspaceStep(page, "Correct"); await page.getByRole("button", {name: "Edit escaping_unicode line 2 column description", exact: true}).click();
  await page.getByRole("textbox", {name: "Proposed value for escaping_unicode line 2 column description", exact: true}).fill(approvedText);
  await page.getByRole("button", {name: "Apply correction", exact: true}).click(); await workspaceStep(page, "Export");
  return {posts, failSave: (value: boolean) => {failSave = value;}, template: () => template};
}
async function file(page: Page, name: string) {
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", {name, exact: true}).click()]);
  return {name: download.suggestedFilename(), text: await readFile((await download.path())!, "utf8")};
}
async function preparePg(page: Page) {
  const panel = pg(page); await panel.getByText("Choose PostgreSQL column types", {exact: true}).click();
  await panel.getByRole("button", {name: "Use text for all columns", exact: true}).click();
  await panel.getByRole("checkbox").check(); await panel.getByRole("button", {name: "Generate PostgreSQL schema", exact: true}).click();
  await expect(panel.getByLabel("PostgreSQL schema preview", {exact: true})).toBeVisible();
  await panel.getByText("Choose PostgreSQL column types", {exact: true}).click();
}
async function shot(page: Page, name: string) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.evaluate(() => scrollTo(0, 0)); mkdirSync(folder, {recursive: true});
  await page.screenshot({path: resolve(folder, `${name}.png`), fullPage: true});
}
for (const width of [320, 375, 390, 768, 1024, 1440]) for (const theme of ["light", "dark"] as const) {
  test(`Export uses actual formats and schema-only consent ${theme} ${width}px`, async ({page}) => {
    await page.setViewportSize({width, height: 1000}); const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
    const fixture = await show(page, theme);
    await expect(page.getByRole("button", {name: /GraphQL|PNG/})).toHaveCount(0);
    await preparePg(page);
    const records = pg(page).getByRole("region", {name: "Optional PostgreSQL records", exact: true});
    await expect(records.getByRole("checkbox")).not.toBeChecked(); await expect(records.getByRole("button", {name: "Prepare PostgreSQL data export", exact: true})).toBeDisabled();
    const schema = await file(page, "Download PostgreSQL schema"); expect(schema.text).toContain('CREATE TABLE "public"."escaping_unicode"'); expect(schema.text).toContain("PRIMARY KEY"); expect(schema.text).not.toMatch(/LOCAL_EXPORT_APPROVED|INSERT|DROP|TRUNCATE/);
    const manifest = JSON.parse((await file(page, "Download PostgreSQL manifest")).text); expect(manifest).toMatchObject({target: "POSTGRESQL", containsRecords: false, execution: "NOT_EXECUTED"});
    const report = JSON.parse((await file(page, "Download privacy-safe JSON")).text); expect(report.status).toBe("READY"); expect(JSON.stringify(report)).not.toContain("LOCAL_EXPORT_APPROVED");
    await shot(page, `export-${theme}-${width}`); expect(fixture.posts).toEqual([]); expect(errors).toEqual([]);
  });
}
for (const width of [320, 1440]) {
  test(`actual corrected CSV, SQL, JSONL, SVG and manifest downloads ${width}px`, async ({page}) => {
    test.setTimeout(90000); await page.setViewportSize({width, height: 1000}); const fixture = await show(page, width === 320 ? "dark" : "light");
    const csv = parseCsvText((await file(page, "Download corrected CSV")).text, "corrected.csv");
    expect(csv.headers).toEqual(dataset.headers); expect(csv.rows[0].description).toBe(approvedText); expect(csv.rows[1].postal_code).toBe("00002"); expect(csv.rows[2].description).toBe("'=2+2");
    expect(csv.rows[3].description).toBe(dataset.rows[3].description);
    const issues = parseCsvText((await file(page, "Download dataset summary CSV")).text, "summary.csv"); expect(issues.headers.length).toBeGreaterThan(1);
    expect((await file(page, "Download issues CSV")).text).not.toContain("LOCAL_EXPORT_APPROVED");
    expect(JSON.parse((await file(page, "Download JSON report")).text).status).toBe("READY");
    await preparePg(page); const records = pg(page).getByRole("region", {name: "Optional PostgreSQL records", exact: true});
    await records.getByRole("checkbox").check(); await records.getByRole("button", {name: "Prepare PostgreSQL data export", exact: true}).click();
    const pgSql = (await file(page, "Download PostgreSQL restore")).text;
    expect(pgSql).toContain(Buffer.from(approvedText).toString("hex")); expect(pgSql).toContain(Buffer.from("=2+2").toString("hex")); expect(pgSql).not.toContain(Buffer.from("'=2+2").toString("hex"));
    expect(JSON.parse((await file(page, "Download data manifest")).text)).toMatchObject({containsRecords: true, records: {totalRows: 4}, execution: "NOT_EXECUTED"});
    expect((await file(page, "Download import instructions")).text).toContain("ON_ERROR_STOP=1");
    const my = mysql(page); await my.getByText("Choose MySQL column types", {exact: true}).click(); await my.getByRole("button", {name: "Use VARCHAR(255) types", exact: true}).click();
    await my.getByLabel("Destination MySQL database", {exact: true}).fill("reviewed_export"); await my.getByRole("checkbox", {name: /I acknowledge MySQL/}).check();
    await my.getByRole("button", {name: "Prepare MySQL export", exact: true}).click();
    expect((await file(page, "Download MySQL schema")).text).not.toMatch(/INSERT|LOCAL_EXPORT_APPROVED|DROP|TRUNCATE/);
    await my.getByRole("checkbox", {name: /I consent to include approved current CSV records/}).check(); await my.getByRole("button", {name: "Prepare MySQL records", exact: true}).click();
    const mySql = (await file(page, "Download MySQL restore")).text.toLowerCase(); expect(mySql).toContain(Buffer.from(approvedText).toString("hex")); expect(mySql).toContain(Buffer.from("=2+2").toString("hex")); expect(mySql).not.toContain(Buffer.from("'=2+2").toString("hex"));
    expect(JSON.parse((await file(page, "Download MySQL manifest")).text)).toMatchObject({target: "MYSQL", containsRecords: true, records: {totalRows: 4}, execution: "NOT_EXECUTED"});
    expect((await file(page, "Download MySQL instructions")).text).toContain("--binary-mode");
    const mo = mongo(page); await mo.getByText("Choose MongoDB types and collections", {exact: true}).click(); await mo.getByRole("button", {name: "Use string types", exact: true}).click();
    await mo.getByLabel("MongoDB id policy for escaping_unicode", {exact: true}).selectOption("ALLOW_SERVER_GENERATED_ID"); await mo.getByRole("checkbox", {name: /I understand FKs/}).check();
    await mo.getByRole("button", {name: "Prepare MongoDB export", exact: true}).click(); expect((await file(page, "Download MongoDB definitions")).text).not.toContain("LOCAL_EXPORT_APPROVED");
    const metadata = JSON.parse((await file(page, "Download MongoDB manifest")).text); expect(metadata).toMatchObject({containsRecords: false, foreignKeyEnforcement: "NONE"});
    await mo.getByRole("checkbox", {name: /I consent to include approved current CSV records/}).check(); await mo.getByRole("button", {name: "Prepare MongoDB documents", exact: true}).click();
    const jsonl = (await file(page, "Download JSONL: escaping_unicode")).text.trim().split("\n").map(line => JSON.parse(line)); expect(jsonl).toHaveLength(4);
    for (let i = 0; i < dataset.rows.length; i++) expect(jsonl[i]).toMatchObject({...dataset.rows[i], ...(i === 0 ? {description: approvedText} : {})});
    expect(JSON.parse((await file(page, "Download MongoDB manifest")).text)).toMatchObject({containsRecords: true, foreignKeyEnforcement: "NONE", records: {totalDocuments: 4}, execution: "NOT_EXECUTED"});
    expect((await file(page, "Download MongoDB instructions")).text).toContain("--stopOnError");
    await workspaceStep(page, "Review"); await page.getByRole("button", {name: "Generate schema diagram", exact: true}).click();
    const svg = (await file(page, "Download schema SVG")).text;
    const parsed = await page.evaluate(text => {const d = new DOMParser().parseFromString(text, "image/svg+xml"); return {errors: d.querySelectorAll("parsererror").length, columns: [...d.querySelectorAll("g[id]")].filter(node => /-column-\d+$/.test(node.id)).length, unsafe: d.querySelectorAll("script,image,foreignObject,a,use,animate").length};}, svg);
    expect(parsed).toEqual({errors: 0, columns: 5, unsafe: 0}); expect(svg).not.toContain("LOCAL_EXPORT_APPROVED");
    await workspaceStep(page, "Upload"); await expect(page.getByRole("region", {name: "Preview of escaping_unicode.csv", exact: true})).not.toContainText("LOCAL_EXPORT_APPROVED");
    expect(fixture.posts).toEqual([]);
  });
  test(`template reuse and saved-summary retry preserve corrected records ${width}px`, async ({page}) => {
    await page.setViewportSize({width, height: 1000}); const fixture = await show(page);
    await workspaceStep(page, "Configure"); await page.getByText("Project and mapping templates", {exact: true}).click();
    await page.getByLabel("New template name", {exact: true}).fill("Reusable export schema"); await page.getByRole("button", {name: "Save mapping template", exact: true}).click();
    await expect(page.getByLabel("Saved mapping template", {exact: true})).toHaveValue("export-template");
    await page.getByLabel("Primary key for escaping_unicode", {exact: true}).selectOption("");
    page.once("dialog", dialog => dialog.dismiss()); await page.getByRole("button", {name: "Load mapping template", exact: true}).click(); await expect(page.getByLabel("Primary key for escaping_unicode", {exact: true})).toHaveValue("");
    page.once("dialog", dialog => dialog.accept()); await page.getByRole("button", {name: "Load mapping template", exact: true}).click(); await expect(page.getByLabel("Primary key for escaping_unicode", {exact: true})).toHaveValue("record_id");
    await workspaceStep(page, "Correct"); await expect(page.getByText("Correction activity history (1)", {exact: true})).toBeVisible(); await expect(page.getByText(/currently changed cell/)).toContainText("1 currently changed cell");
    await workspaceStep(page, "Validate"); await page.getByRole("button", {name: "Run Validation", exact: true}).click(); await workspaceStep(page, "Export");
    fixture.failSave(true); await page.getByRole("button", {name: "Save validation summary", exact: true}).click(); await expect(page.getByText("Save failed (HTTP 503)", {exact: true})).toBeVisible();
    await expect(page.getByRole("link", {name: "View saved summary", exact: true})).toHaveCount(0);
    fixture.failSave(false); await page.getByRole("button", {name: "Save validation summary", exact: true}).click();
    await expect(page.getByRole("link", {name: "View saved summary", exact: true})).toHaveAttribute("href", "/results/export-summary");
    const runs = fixture.posts.filter(post => post.url.endsWith("/runs")); expect(runs).toHaveLength(2); expect(runs[1].body).toMatchObject({status: "READY", totalRows: 4, validRows: 4, invalidRows: 0, issueCount: 0});
    expect(JSON.stringify(fixture.posts)).not.toMatch(/LOCAL_EXPORT_APPROVED|Quotes:|postal_code.*00101/);
    expect(JSON.stringify(fixture.template())).not.toMatch(/LOCAL_EXPORT_APPROVED|correctionHistory|undoStack/);
  });
}


for (const width of [320, 1440]) test(`bounded history keeps all rows and scoped pagination ${width}px`, async ({page}) => {
  await page.setViewportSize({width, height: 1000}); await page.goto("/");
  const shell = await page.evaluate(() => ({styles: [...document.head.querySelectorAll('link[rel="stylesheet"],style')].map(node => node.outerHTML).join(""), font: document.documentElement.className}));
  const filters = parseHistoryFilters({projectId: "history-fixture", pageSize: "50", order: "oldest"});
  const items = Array.from({length: 50}, (_, index) => ({id: `summary-${index}`, projectId: "history-fixture", projectName: `Synthetic project ${index}`, status: "READY" as const, totalRows: 1, validRows: 1, invalidRows: 0, issueCount: 0, createdAt: new Date("2026-10-20T00:00:00Z")}));
  const markup = renderToStaticMarkup(h(HistoryResults, {filters, history: {items, total: 75, page: 1, pageSize: 50, totalPages: 2}}));
  await page.setContent(`<!doctype html><html lang="en" class="${shell.font}" data-theme="light"><head>${shell.styles}</head><body><main style="padding:16px;max-width:1152px;margin:auto;min-width:0">${markup}</main></body></html>`);
  const table = page.getByRole("region", {name: "Saved validation reports", exact: true});
  await expect(table.locator("tbody tr")).toHaveCount(50); expect((await table.boundingBox())!.height).toBeLessThanOrEqual(545);
  await table.focus(); await expect(table).toBeFocused(); await page.keyboard.press("PageDown"); await expect.poll(() => table.evaluate(node => node.scrollTop)).toBeGreaterThan(0);
  await expect(page.getByRole("link", {name: "Next", exact: true})).toHaveAttribute("href", historyPageHref(filters, 2));
  await expect(page.locator('input[name="projectId"]')).toHaveValue("history-fixture");
  await shot(page, `history-${width}`);
});

test("System appearance and step changes retain schema choices and unchecked record consent", async ({page}) => {
  await page.setViewportSize({width: 390, height: 1000}); await page.emulateMedia({colorScheme: "dark"});
  await show(page, "dark"); await preparePg(page);
  const before = await file(page, "Download PostgreSQL schema");
  await page.getByRole("combobox", {name: "Color theme", exact: true}).selectOption("system"); await page.emulateMedia({colorScheme: "light"});
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await workspaceStep(page, "Configure"); await workspaceStep(page, "Export");
  await expect(pg(page).getByRole("region", {name: "Optional PostgreSQL records", exact: true}).getByRole("checkbox")).not.toBeChecked();
  expect((await file(page, "Download PostgreSQL schema")).text).toBe(before.text);
});
