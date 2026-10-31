import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { themeFixture } from "./helpers/theme-fixture";
import { workspaceStep } from "./helpers/workspace-navigation";
import { configuredPack, driftPack, packFile } from "../fixtures/workspace-csv-pack";
import type { TemplateConfiguration } from "../../src/lib/templates/schema";
import { approvedLocalModels } from "../../src/lib/ai/providers/ollama";

const folder = resolve("playwright/.cache/rowzen-workspace-20261027");
async function fixture(page: Page, blocked = false, theme: "light" | "dark" = "light", template?: TemplateConfiguration) {
  const pack = configuredPack(blocked);
  await page.route("**/api/projects**", route => route.fulfill({contentType: "application/json", body: JSON.stringify(route.request().url().includes("/templates") ? {templates: [{id: "pack-template", projectId: "theme-project", name: "Pack configured rules", configuration: template ?? pack.template}]} : {projects: [{id: "theme-project", name: "Synthetic pack project"}]})}));
  await themeFixture(page, "workspace", theme);
  return pack;
}
async function templates(page: Page) {
  const summary = page.getByText("Project and mapping templates", {exact: true});
  if (!await page.getByLabel("Saved mapping template", {exact: true}).isVisible()) await summary.click();
  await page.getByLabel("Saved mapping template", {exact: true}).selectOption("pack-template");
}
async function shot(page: Page, name: string) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.evaluate(() => scrollTo(0, 0));
  mkdirSync(folder, {recursive: true});
  await page.screenshot({path: resolve(folder, `${name}.png`), fullPage: true});
}
for (const width of [320, 375, 390, 768, 1024, 1440]) for (const theme of ["light", "dark"] as const) {
  test(`supplied clean pack, local rules and mounted drafts ${theme} ${width}px`, async ({page}) => {
    await page.setViewportSize({width, height: 1000});
    const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
    const {datasets} = await fixture(page, false, theme);
    await page.locator("#csv-files").setInputFiles(datasets.map(dataset => packFile(`01_clean/${dataset.filename}`)));
    await expect(page.getByRole("region", {name: "Selected datasets"})).toContainText("4 datasets parsed");
    const preview = page.getByRole("region", {name: "Preview of students_clean.csv", exact: true});
    await expect(preview).toContainText("00123"); await preview.focus(); await expect(preview).toBeFocused();
    await expect(preview).toHaveCSS("max-height", "320px");
    await shot(page, `upload-${theme}-${width}`);
    await page.getByRole("button", {name: "Continue to Configure", exact: true}).focus(); await page.keyboard.press("Enter");
    await expect(page.locator("#workspace-configure-heading")).toBeFocused();
    const target = page.getByLabel("Target for students_clean.full_name", {exact: true});
    const node = await target.elementHandle();
    await expect(page.getByLabel("Type of students_clean.full_name", {exact: true})).toHaveValue("");
    await target.fill("draft_name"); await workspaceStep(page, "Upload"); await workspaceStep(page, "Configure");
    await expect(target).toHaveValue("draft_name");
    expect(await target.evaluate((el, previous) => el === previous, node)).toBe(true);
    await expect(page.getByLabel("Type of students_clean.full_name", {exact: true})).toBeDisabled();
    await page.getByRole("button", {name: "Cancel mapping for students_clean", exact: true}).click();
    await expect(page.getByLabel("Target for students_clean.student_id", {exact: true})).toBeFocused(); await expect(target).toHaveValue("full_name");
    await templates(page);
    await expect(page.getByRole("region", {name: "Mapping and validation templates"})).toContainText("1 of 20 template slots used");
    page.once("dialog", dialog => dialog.accept());
    await page.getByRole("button", {name: "Load mapping template", exact: true}).click();
    await expect(page.getByLabel("Primary key for students_clean", {exact: true})).toHaveValue("student_id");
    await expect(page.getByLabel("Type of students_clean.email", {exact: true})).toHaveValue("email");
    await expect(page.getByRole("group", {name: "Local column evidence"})).toContainText("Leading zeros: 4; preserve as text");
    await shot(page, `configure-${theme}-${width}`);
    await workspaceStep(page, "Validate"); await page.getByRole("button", {name: "Run Validation", exact: true}).click();
    await expect(page.getByRole("heading", {name: "Migration readiness: READY", exact: true})).toBeVisible();
    await workspaceStep(page, "Upload"); await expect(preview).toContainText("00123");
    if (width < 768) await expect(page.getByRole("combobox", {name: "Workspace step", exact: true})).toBeVisible();
    expect(errors).toEqual([]);
  });
}
for (const width of [320, 1440]) {
  test(`supplied blocked pack and invalid replacement recovery ${width}px`, async ({page}) => {
    await page.setViewportSize({width, height: 1000});
    const {datasets} = await fixture(page, true);
    await page.locator("#csv-files").setInputFiles(datasets.map(dataset => packFile(`02_blocked/${dataset.filename}`)));
    await workspaceStep(page, "Configure"); await templates(page);
    page.once("dialog", dialog => dialog.accept());
    await page.getByRole("button", {name: "Load mapping template", exact: true}).click();
    await workspaceStep(page, "Validate"); await page.getByRole("button", {name: "Run Validation", exact: true}).click();
    await expect(page.getByRole("heading", {name: "Migration readiness: BLOCKED", exact: true})).toBeVisible();
    const beforeReport = await page.getByRole("region", {name: "Validation results", exact: true}).textContent();
    await workspaceStep(page, "Upload");
    for (const name of ["duplicate_headers.csv", "header_only.csv", "invalid_utf8.csv", "malformed_quotes.csv", "missing_header_cell.csv", "not_a_csv.txt", "over_1mb.csv"]) {
      await page.locator("#csv-files").setInputFiles(packFile(`07_upload_errors/${name}`));
      await expect(page.getByRole("alert")).toContainText("Your previous selection, settings and corrections are still available");
      await expect(page.getByRole("region", {name: "Selected datasets"})).toContainText("2 datasets parsed");
    }
    await workspaceStep(page, "Review");
    expect(await page.getByRole("region", {name: "Validation results", exact: true}).textContent()).toBe(beforeReport);
    await workspaceStep(page, "Configure"); await expect(page.getByLabel("Primary key for students_issues", {exact: true})).toHaveValue("student_id");
    await shot(page, `blocked-${width}`);
  });
  test(`supplied drift remains local while Ollama is unavailable ${width}px`, async ({page}) => {
    await page.setViewportSize({width, height: 1000});
    const previous = driftPack("v1");
    await fixture(page, false, "light", previous.template);
    let calls = 0;
    await page.route("http://127.0.0.1:11434/**", route => {calls++; return route.abort("connectionrefused");});
    await page.locator("#csv-files").setInputFiles(driftPack("v2").file);
    await workspaceStep(page, "Configure"); await templates(page);
    const ai = page.getByRole("region", {name: "AI schema mapping", exact: true});
    await expect(ai.getByLabel("Schema drift comparison")).toContainText("Added columns: student_id, semester. Removed columns: student_no.");
    expect(calls).toBe(0);
    await page.getByRole("button", {name: "Load mapping template", exact: true}).click();
    await expect(page.getByRole("region", {name: "Mapping and validation templates"})).toContainText("original header order does not match");
    await ai.getByLabel("Allow local schema metadata request", {exact: true}).check();
    await ai.getByRole("button", {name: "Suggest schema settings", exact: true}).click();
    await expect(ai.getByRole("alert")).toContainText("unavailable");
    await expect(ai.getByRole("button", {name: "Apply selected suggestions", exact: true})).toHaveCount(0);
    await ai.getByRole("button", {name: "Retry schema suggestions", exact: true}).click();
    await expect(ai.getByRole("alert")).toContainText("unavailable");
    for (const version of ["v3", "v4"] as const) {
      await workspaceStep(page, "Upload"); await page.locator("#csv-files").setInputFiles(driftPack(version).file);
      await workspaceStep(page, "Configure");
      await expect(ai.getByLabel("Schema drift comparison")).toContainText(version === "v3" ? "Removed columns: dept_code" : "Column order changed.");
    }
    await workspaceStep(page, "Validate"); await page.getByRole("button", {name: "Run Validation", exact: true}).click();
    await expect(page.getByRole("heading", {name: "Migration readiness: READY", exact: true})).toBeVisible();
  });
}

test("supplied pack AI approval is explicit, rejects safely and sends no record values", async ({page}) => {
  await fixture(page);
  const payloads: string[] = [];
  await page.route("http://127.0.0.1:11434/**", route => {
    const headers = {"Content-Type": "application/json", "Access-Control-Allow-Origin": new URL(page.url()).origin};
    if (route.request().method() === "OPTIONS") return route.fulfill({status: 204, headers: {...headers, "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "content-type"}});
    if (route.request().url().endsWith("/api/tags")) return route.fulfill({headers, body: JSON.stringify({models: [{name: "qwen2.5:0.5b", digest: approvedLocalModels["qwen2.5:0.5b"]}]})});
    if (route.request().url().endsWith("/api/show")) return route.fulfill({headers, body: '{"details":{"format":"gguf"}}'});
    payloads.push(route.request().postData()!);
    return route.fulfill({headers, body: JSON.stringify({model: "qwen2.5:0.5b", done: true, message: {role: "assistant", content: JSON.stringify({schemaVersion: 1, suggestions: [{sourceId: "c3", targetId: "t3", type: "boolean", required: "unsure", key: "none", reason: "name_hint"}]})}})});
  });
  await page.locator("#csv-files").setInputFiles(driftPack("v2").file);
  await workspaceStep(page, "Configure");
  const ai = page.getByRole("region", {name: "AI schema mapping", exact: true});
  const type = page.getByLabel("Type of students.is_active", {exact: true});
  await ai.getByLabel("Allow local schema metadata request", {exact: true}).check();
  await ai.getByRole("button", {name: "Suggest schema settings", exact: true}).click();
  await expect(ai).toContainText("Unverified suggestions"); await expect(type).toHaveValue("");
  await ai.getByRole("button", {name: "Reject suggestions", exact: true}).click(); await expect(type).toHaveValue("");
  await ai.getByRole("button", {name: "Suggest schema settings", exact: true}).click();
  await ai.getByLabel("Accept suggestion for is_active", {exact: true}).check();
  page.once("dialog", dialog => dialog.dismiss()); await ai.getByRole("button", {name: "Apply selected suggestions", exact: true}).click(); await expect(type).toHaveValue("");
  page.once("dialog", dialog => dialog.accept()); await ai.getByRole("button", {name: "Apply selected suggestions", exact: true}).click(); await expect(type).toHaveValue("boolean");
  await workspaceStep(page, "Upload"); await expect(page.getByRole("region", {name: "Preview of students.csv", exact: true})).toContainText("Tariq");
  expect(payloads).toHaveLength(2);
  expect(payloads.join(" ")).not.toMatch(/Tariq|Zain|Fall-2026|correctionHistory|students/);
});

test("System theme follows OS changes without remounting workspace drafts", async ({page}) => {
  await page.setViewportSize({width: 390, height: 900});
  await page.emulateMedia({colorScheme: "dark"});
  await fixture(page, false, "dark");
  await page.locator("#csv-files").setInputFiles(driftPack("v1").file);
  await workspaceStep(page, "Configure");
  const target = page.getByLabel("Target for students.full_name", {exact: true});
  await target.fill("pending_name"); const node = await target.elementHandle();
  await page.getByRole("combobox", {name: "Color theme", exact: true}).selectOption("system");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const background = await target.evaluate(el => getComputedStyle(el).backgroundColor);
  await page.emulateMedia({colorScheme: "light"});
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect.poll(() => target.evaluate(el => getComputedStyle(el).backgroundColor)).not.toBe(background);
  await expect(target).toHaveValue("pending_name");
  expect(await target.evaluate((el, previous) => el === previous, node)).toBe(true);
  await workspaceStep(page, "Upload"); await workspaceStep(page, "Configure");
  await expect(target).toHaveValue("pending_name");
  await page.getByRole("button", {name: "Cancel mapping for students", exact: true}).click();
  await expect(target).toHaveValue("full_name");
});
