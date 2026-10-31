import { mkdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { configuredPack, packFile } from "../fixtures/workspace-csv-pack";
import { relationshipPack, type ReviewPackKind } from "../fixtures/review-csv-pack";
import { themeFixture } from "./helpers/theme-fixture";
import { workspaceStep } from "./helpers/workspace-navigation";
import type { TemplateConfiguration } from "../../src/lib/templates/schema";

const folder = resolve("playwright/.cache/rowzen-review-20261027");
type Pack = ReturnType<typeof configuredPack> | ReturnType<typeof relationshipPack>;
async function fixture(page: Page, pack: Pack, theme: "light" | "dark" = "light", template: TemplateConfiguration = pack.template) {
  const outbound: string[] = [], aiCalls: string[] = [];
  page.on("request", request => {if (request.postData()) outbound.push(request.postData()!); if (request.url().includes(":11434")) aiCalls.push(request.url());});
  await page.route("**/api/projects**", route => route.fulfill({contentType: "application/json", body: JSON.stringify(route.request().url().includes("/templates") ? {templates: [{id: "review-template", projectId: "theme-project", name: "Approved pack rules", configuration: template}]} : {projects: [{id: "theme-project", name: "Synthetic Review project"}]})}));
  await themeFixture(page, "workspace", theme);
  await page.locator("#csv-files").setInputFiles(pack.datasets.map(dataset => packFile(`${dataset.filename.includes("_clean") ? "01_clean" : /students_issues|departments_parent/.test(dataset.name) ? "02_blocked" : "04_relationships"}/${dataset.filename}`)));
  await workspaceStep(page, "Configure");
  await page.getByText("Project and mapping templates", {exact: true}).click();
  await page.getByLabel("Saved mapping template", {exact: true}).selectOption("review-template");
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", {name: "Load mapping template", exact: true}).click();
  await expect(page.getByRole("region", {name: "Mapping and validation templates"})).toContainText("Template applied");
  await workspaceStep(page, "Validate");
  return {outbound, aiCalls};
}
async function run(page: Page, status: string) {
  await page.getByRole("button", {name: "Run Validation", exact: true}).focus(); await page.keyboard.press("Enter");
  await expect(page.locator("#workspace-review-heading")).toBeFocused();
  await expect(page.getByRole("heading", {name: `Migration readiness: ${status}`, exact: true})).toBeVisible();
}
async function view(page: Page, name: string) {await page.getByRole("combobox", {name: "Review section", exact: true}).selectOption(name);}
async function shot(page: Page, name: string) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.evaluate(() => scrollTo(0, 0)); mkdirSync(folder, {recursive: true});
  await page.screenshot({path: resolve(folder, `${name}.png`), fullPage: true});
}
function metric(page: Page, label: string) {return page.locator("section[aria-labelledby='report-summary-title'] dl > div").filter({has: page.locator("dt", {hasText: new RegExp(`^${label}$`)})}).locator("dd");}
for (const width of [320, 375, 390, 768, 1024, 1440]) for (const theme of ["light", "dark"] as const) {
  test(`supplied blocked Review preserves metrics, filters and navigation ${theme} ${width}px`, async ({page}) => {
    await page.setViewportSize({width, height: 1000});
    const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
    const network = await fixture(page, configuredPack(true), theme);
    await expect(page.getByRole("region", {name: "Run validation", exact: true})).toContainText("2 datasets");
    await run(page, "BLOCKED");
    await expect(metric(page, "Blocking errors")).toHaveText("9"); await expect(metric(page, "Invalid rows")).toHaveText("3");
    await expect(metric(page, "Valid rows")).toHaveText("4"); await expect(metric(page, "Total records")).toHaveText("7");
    await shot(page, `summary-${theme}-${width}`);
    await view(page, "issues"); const search = page.getByRole("searchbox", {name: "Search issues", exact: true});
    await search.fill("student_id"); await expect(page.locator("#issue-filter-count")).toContainText("2 matching issues (9 total)");
    const originalNode = await search.elementHandle();
    await page.getByText("Sorting and page size", {exact: true}).click();
    await page.getByRole("combobox", {name: "Sort by", exact: true}).selectOption("rowNumber");
    await page.getByRole("combobox", {name: "Sort direction", exact: true}).selectOption("desc");
    await page.getByRole("combobox", {name: "Issues per page", exact: true}).selectOption("25");
    await view(page, "analytics");
    await expect(page.getByRole("region", {name: "Dataset-level validation analytics"})).toContainText("students_issues");
    const studentRow = page.getByRole("region", {name: "Dataset-level validation analytics"}).locator("tbody tr").filter({hasText: "students_issues"});
    await expect(studentRow.locator("td")).toHaveText(["5", "2", "3", "9", "0", "9"]);
    await view(page, "issues"); await expect(search).toHaveValue("student_id");
    expect(await search.evaluate((el, original) => el === original, originalNode)).toBe(true);
    await expect(page.getByRole("combobox", {name: "Issues per page", exact: true})).toHaveValue("25");
    await page.getByRole("combobox", {name: "Severity", exact: true}).selectOption("WARNING");
    await expect(page.getByText("No issues match the selected filters.", {exact: true})).toBeVisible();
    await page.getByRole("button", {name: "Reset filters", exact: true}).click(); await expect(page.locator("#issue-filter-count")).toContainText("9 matching issues");
    await shot(page, `issues-${theme}-${width}`);
    await view(page, "dependencies"); await expect(page.getByRole("group", {name: "Interactive dataset dependency diagram", exact: true})).toBeVisible();
    await view(page, "summary"); await expect(metric(page, "Blocking errors")).toHaveText("9");
    expect(network.aiCalls).toEqual([]); expect(network.outbound).toEqual([]); expect(errors).toEqual([]);
  });
}
for (const width of [320, 1440]) {
  test(`supplied clean Review is READY with zero findings ${width}px`, async ({page}) => {
    await page.setViewportSize({width, height: 1000}); await fixture(page, configuredPack()); await run(page, "READY");
    await expect(metric(page, "Total records")).toHaveText("14"); await expect(metric(page, "Valid rows")).toHaveText("14");
    await expect(metric(page, "Invalid rows")).toHaveText("0"); await expect(metric(page, "Total issues")).toHaveText("0");
    await view(page, "issues"); await expect(page.getByText("No validation issues in this report.", {exact: true})).toBeVisible();
  });
  test(`supplied CONFIG_ERROR keeps row validity unevaluated ${width}px`, async ({page}) => {
    await page.setViewportSize({width, height: 1000}); const pack = relationshipPack("parallel"), template = structuredClone(pack.template);
    template.relationships[1].parentColumn = "missing_endpoint";
    await fixture(page, pack, "dark", template); await run(page, "CONFIG ERROR");
    await expect(metric(page, "Invalid rows")).toHaveText("Not evaluated"); await expect(metric(page, "Valid rows")).toHaveText("Not evaluated");
    await shot(page, `config-error-${width}`);
  });
  test(`offline Root-Cause advice cannot change supplied findings or record navigation ${width}px`, async ({page}) => {
    await page.setViewportSize({width, height: 1000});
    await page.route("http://127.0.0.1:11434/**", route => route.abort("connectionrefused"));
    await fixture(page, configuredPack(true)); await run(page, "BLOCKED"); await view(page, "issues");
    await page.getByRole("searchbox", {name: "Search issues", exact: true}).fill("student_id");
    await page.getByRole("button", {name: /Explain DUPLICATE_PK.*with AI/}).first().click();
    const ai = page.getByRole("region", {name: /^Explain issues with AI/});
    await ai.getByLabel("Allow local issue analysis", {exact: true}).check();
    await ai.getByRole("button", {name: "Explain Issues with AI", exact: true}).click(); await expect(ai.getByRole("alert")).toContainText("unavailable");
    await ai.getByRole("button", {name: "Retry local AI", exact: true}).click(); await expect(ai.getByRole("alert")).toContainText("unavailable");
    await expect(metric(page, "Blocking errors")).toHaveText("9"); await view(page, "issues");
    const locate = page.getByRole("button", {name: "Locate students_issues CSV line 4 column student_id", exact: true});
    await locate.click(); await expect(page.getByRole("textbox", {name: "Proposed value for students_issues line 4 column student_id", exact: true})).toBeFocused();
    await workspaceStep(page, "Review"); await view(page, "summary"); await expect(metric(page, "Blocking errors")).toHaveText("9");
  });
}
for (const kind of ["composite", "composite-invalid", "parallel", "cycle"] as ReviewPackKind[]) for (const width of [320, 1440]) {
  test(`supplied ${kind} schema and actual SVG preserve all FK identities ${width}px`, async ({page}) => {
    await page.setViewportSize({width, height: 1000}); const pack = relationshipPack(kind), theme = width === 320 ? "dark" : "light";
    const network = await fixture(page, pack, theme); await run(page, kind === "cycle" || kind === "composite-invalid" ? "BLOCKED" : "READY");
    await view(page, "dependencies"); if (kind === "cycle") await expect(page.getByText("There is no complete parent-first order for cyclic datasets.", {exact: true})).toBeVisible();
    await page.getByRole("button", {name: "Generate schema diagram", exact: true}).click();
    const section = page.getByRole("region", {name: "Schema diagram", exact: true}), canvas = section.getByRole("group", {name: "Interactive schema diagram", exact: true}), svg = canvas.locator("svg");
    await expect(svg.locator("path[marker-end]")).toHaveCount(2);
    const camera = await svg.getAttribute("viewBox"); await canvas.focus(); await canvas.press("+"); await canvas.press("ArrowRight");
    await expect(svg).not.toHaveAttribute("viewBox", camera!);
    await section.getByRole("button", {name: "Schema tables", exact: true}).click();
    await section.getByText("Foreign-key pairs (", {exact: false}).click();
    const pairs = section.getByRole("region", {name: "Schema foreign-key pair list", exact: true}); await expect(pairs.locator("tbody tr")).toHaveCount(2);
    if (kind.startsWith("composite")) {await expect(pairs.locator("tbody tr").first()).toContainText("campus_id"); await expect(pairs.locator("tbody tr").last()).toContainText("dept_id");}
    if (kind === "parallel") {await expect(pairs).toContainText("billing_address_id"); await expect(pairs).toContainText("shipping_address_id");}
    await section.getByRole("button", {name: "Diagram", exact: true}).click();
    const [download] = await Promise.all([page.waitForEvent("download"), section.getByRole("button", {name: "Download schema SVG", exact: true}).click()]);
    expect(download.suggestedFilename()).toMatch(/\.svg$/);
    const content = await readFile((await download.path())!, "utf8");
    const exported = await page.evaluate(text => {const doc = new DOMParser().parseFromString(text, "image/svg+xml"); return {errors: doc.querySelectorAll("parsererror").length, pairs: doc.querySelectorAll("path[marker-end]").length, tables: [...doc.querySelectorAll("g[id]")].filter(node => /^er-0-table-\d+$/.test(node.id)).length, width: Number(doc.documentElement.getAttribute("width")), height: Number(doc.documentElement.getAttribute("height")), viewBox: doc.documentElement.getAttribute("viewBox"), unsafe: doc.querySelectorAll("script,image,foreignObject,a,use,animate").length + [...doc.querySelectorAll("*")].flatMap(node => [...node.attributes]).filter(attribute => /^on/i.test(attribute.name) || /href$/i.test(attribute.name)).length};}, content);
    expect(exported).toMatchObject({errors: 0, pairs: 2, tables: 2, unsafe: 0}); expect(exported.viewBox).toBe(`0 0 ${exported.width} ${exported.height}`);
    expect(content).not.toMatch(/Karachi|Lahore|Islamabad|CSE|Math/);
    expect(network.aiCalls).toEqual([]); expect(network.outbound).toEqual([]);
    await shot(page, `${kind}-${theme}-${width}`);
    await section.getByRole("button", {name: "Schema tables", exact: true}).click(); await section.getByRole("button", {name: "Diagram", exact: true}).click();
    await workspaceStep(page, "Configure"); await workspaceStep(page, "Review"); await expect(svg.locator("path[marker-end]")).toHaveCount(2);
  });
}

test("Review filters and schema camera survive System appearance changes", async ({page}) => {
  await page.setViewportSize({width: 390, height: 1000}); await page.emulateMedia({colorScheme: "dark"});
  await fixture(page, relationshipPack("parallel"), "dark"); await run(page, "READY");
  await view(page, "issues");
  await page.getByRole("searchbox", {name: "Search issues", exact: true}).fill("retained_filter");
  await page.getByRole("combobox", {name: "Severity", exact: true}).selectOption("WARNING");
  await page.getByRole("button", {name: "Generate schema diagram", exact: true}).click();
  const svg = page.getByRole("group", {name: "Interactive schema diagram", exact: true}).locator("svg");
  await page.getByRole("button", {name: "Pan schema right", exact: true}).click(); const camera = await svg.getAttribute("viewBox");
  await page.getByRole("combobox", {name: "Color theme", exact: true}).selectOption("system"); await page.emulateMedia({colorScheme: "light"});
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light"); await expect(svg).toHaveAttribute("viewBox", camera!);
  await expect(svg.locator("path[marker-end]")).toHaveCount(2);
  await view(page, "issues");
  await expect(page.getByRole("searchbox", {name: "Search issues", exact: true})).toHaveValue("retained_filter");
  await expect(page.getByRole("combobox", {name: "Severity", exact: true})).toHaveValue("WARNING");
  await view(page, "schema"); await expect(svg).toHaveAttribute("viewBox", camera!);
});
