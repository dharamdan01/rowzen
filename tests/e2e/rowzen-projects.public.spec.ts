import { build } from "esbuild";
import { themeFixture } from "./helpers/theme-fixture";
import { expect, test, type Page, type Route } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { applicationStyles } from "./helpers/application-styles";

const shots = resolve("playwright/.cache/rowzen-projects-20261027");
const projects = [{ id: "p-alpha", name: "Revenue migration", description: "Synthetic finance project" }, { id: "p-beta", name: "Inventory refresh", description: "Synthetic inventory project" }];
const timestamp = "2026-10-27T00:00:00.000Z";
const run = (id: string) => ({ id: "run-" + id, projectId: id, status: "CONFIG_ERROR", totalRows: 5, validRows: null, invalidRows: null, issueCount: 2, createdAt: timestamp });
let script: string;
async function show(page: Page, kind: "projects" | "dashboard", theme: "light" | "dark" = "light", items = projects) {
  script ??= (await build({ bundle: true, write: false, platform: "browser", format: "iife", minify: true,
    define: { "process.env.NODE_ENV": '"production"', "process.env": "{}" },
    stdin: { resolveDir: process.cwd(), loader: "tsx", contents: "import React from 'react';import{createRoot}from'react-dom/client';import Projects from './src/components/projects/projects-view';import Dashboard from './src/components/projects/dashboard-overview';createRoot(document.querySelector('#fixture')).render(window.fixtureKind==='projects'?<Projects projects={window.fixtureProjects}/>:<Dashboard projects={window.fixtureProjects}/>);" } })).outputFiles[0].text;
  const shell = await applicationStyles(page);
  await page.setContent(`<!doctype html><html lang="en" class="${shell.font}" data-theme="${theme}"><head>${shell.styles}</head><body><main style="padding:16px;max-width:1200px;margin:auto;min-width:0"><div id="fixture"></div></main></body></html>`);
  await page.evaluate(value => Object.assign(window, { fixtureProjects: value.projects, fixtureKind: value.kind }), { projects: items, kind });
  await page.addScriptTag({ content: script });
  await expect(page.getByRole("heading", { level: 1, name: kind === "projects" ? "Projects" : "Dashboard", exact: true })).toBeVisible();
}
async function existingApiFixture(page: Page) {
  await page.route("**/api/projects/**", route => {
    const path = new URL(route.request().url()).pathname.split("/");
    const id = decodeURIComponent(path[3]);
    const project = projects.find(project => project.id === id)!;
    return route.fulfill({ contentType: "application/json", body: JSON.stringify(path[4] === "runs" ? { runs: [run(id)] } : path[4] === "templates" ? { templates: [{ id: "tpl-" + id, projectId: id, name: "Column mapping", updatedAt: timestamp, configuration: { private: "DO_NOT_RENDER_CONFIGURATION" } }] } : { project: { ...project, createdAt: timestamp } }) });
  });
}
for (const width of [320,375,390,768,1024,1440]) for (const theme of ["light","dark"] as const) {
  test(`projects search, detail scope and focus ${theme} ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 }); await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    const writes: string[] = []; page.on("request", request => { if (request.method() !== "GET") writes.push(request.method()); });
    await existingApiFixture(page); await show(page, "projects", theme);
    const search = page.getByRole("searchbox", { name: "Search projects", exact: true }); await search.fill("Revenue");
    await expect(page.getByText("1 of 2 projects", { exact: true })).toBeVisible();
    const trigger = page.getByRole("button", { name: "Details for Revenue migration", exact: true }); await trigger.focus(); await trigger.press("Enter");
    const dialog = page.getByRole("dialog", { name: "Project details", exact: true }); await expect(dialog.getByRole("button", { name: "Close", exact: true })).toBeFocused();
    await expect(dialog.getByRole("heading", { name: "Revenue migration", exact: true })).toBeVisible();
    await expect(dialog.getByRole("navigation", { name: "Project navigation", exact: true }).getByRole("link", { name: "Open workspace", exact: true })).toHaveAttribute("href", "/upload?projectId=p-alpha");
    await expect(dialog.getByRole("link", { name: "Saved reports", exact: true })).toHaveAttribute("href", "/results?projectId=p-alpha");
    await expect(dialog.getByRole("list", { name: "Project mapping templates", exact: true })).toContainText("Column mapping");
    const summary = dialog.locator('a[href^="/results/run-p-alpha"]');
    await expect(summary).toHaveAttribute("href", /returnTo=%2Fresults%3FprojectId%3Dp-alpha/);
    await expect(dialog).not.toContainText("DO_NOT_RENDER_CONFIGURATION"); await expect(dialog).not.toContainText("Inventory refresh");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    mkdirSync(shots, { recursive: true }); await page.screenshot({ path: resolve(shots, `detail-${theme}-${width}.png`) });
    await page.keyboard.press("Escape"); await expect(dialog).toHaveCount(0); await expect(trigger).toBeFocused(); await expect(search).toHaveValue("Revenue");
    await search.fill("No match"); await expect(page.getByRole("heading", { name: "No matching projects", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Clear search", exact: true }).click(); await page.getByRole("combobox", { name: "Project order", exact: true }).selectOption("name");
    await expect(page.getByRole("list", { name: "Projects", exact: true }).locator("li").first()).toContainText("Inventory refresh");
    await page.screenshot({ path: resolve(shots, `projects-${theme}-${width}.png`), fullPage: true }); expect(writes).toEqual([]);
  });
  test(`dashboard scoped counters and activity ${theme} ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 }); await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    await existingApiFixture(page); await show(page, "dashboard", theme);
    await expect(page.getByRole("list", { name: "Recent saved summaries", exact: true })).toBeVisible();
    await expect(page.locator('a[href^="/results/run-p-alpha"]')).toHaveCount(1);
    await page.getByRole("combobox", { name: "Activity project", exact: true }).selectOption("p-beta");
    await expect(page.locator('a[href^="/results/run-p-beta"]')).toHaveCount(1); await expect(page.locator('a[href^="/results/run-p-alpha"]')).toHaveCount(0);
    await expect(page.getByRole("link", { name: "All project reports", exact: true })).toHaveAttribute("href", "/results?projectId=p-beta");
    await expect(page.getByText("Configuration error", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    mkdirSync(shots, { recursive: true }); await page.screenshot({ path: resolve(shots, `dashboard-${theme}-${width}.png`), fullPage: true });
  });
}
test("project detail loading, ownership failure, resource error and zero remain distinct", async ({ page }) => {
  let projectAvailable = false, templatesAvailable = false;
  await page.route("**/api/projects/p-alpha", route => route.fulfill({ status: projectAvailable ? 200 : 404, contentType: "application/json", body: JSON.stringify(projectAvailable ? { project: projects[0] } : { error: "PRIVATE_OWNER_DETAIL" }) }));
  await page.route("**/api/projects/p-alpha/runs", route => route.fulfill({ contentType: "application/json", body: '{"runs":[]}' }));
  await page.route("**/api/projects/p-alpha/templates", route => route.fulfill({ status: templatesAvailable ? 200 : 503, contentType: "application/json", body: templatesAvailable ? '{"templates":[]}' : "{}" }));
  await show(page, "projects"); await page.getByRole("button", { name: "Details for Revenue migration", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Project details", exact: true });
  await expect(dialog.getByRole("alert")).toContainText("unavailable"); await expect(dialog.getByRole("navigation", { name: "Project navigation", exact: true })).toHaveCount(0); await expect(dialog).not.toContainText("PRIVATE_OWNER_DETAIL");
  projectAvailable = true; await dialog.getByRole("button", { name: "Retry project details", exact: true }).click();
  await expect(dialog.getByText("No saved reports yet", { exact: true })).toBeVisible();
  await expect(dialog.getByRole("alert")).toContainText("Could not load templates"); await expect(dialog.getByText("0 recent templates shown", { exact: false })).toHaveCount(0);
  templatesAvailable = true; await dialog.getByRole("button", { name: "Retry project templates", exact: true }).click(); await expect(dialog.getByText("No saved templates for this project.", { exact: true })).toBeVisible();
});
test("slow previous-project activity cannot overwrite a newer selection", async ({ page }) => {
  let previous: Route | undefined;
  await page.route("**/api/projects/p-alpha/runs", route => { previous = route; });
  await page.route("**/api/projects/p-beta/runs", route => route.fulfill({ contentType: "application/json", body: JSON.stringify({ runs: [run("p-beta")] }) }));
  await show(page, "dashboard"); await expect(page.getByText("Loading saved reports...", { exact: true })).toBeVisible(); await expect.poll(() => Boolean(previous)).toBe(true);
  await page.getByRole("combobox", { name: "Activity project", exact: true }).selectOption("p-beta"); await expect(page.locator('a[href^="/results/run-p-beta"]')).toHaveCount(1);
  await previous!.fulfill({ contentType: "application/json", body: JSON.stringify({ runs: [run("p-alpha")] }) }).catch(() => { /* Expected when the browser already aborted the old request. */ });
  await expect(page.locator('a[href^="/results/run-p-beta"]')).toHaveCount(1); await expect(page.locator('a[href^="/results/run-p-alpha"]')).toHaveCount(0);
});
test("activity failure and retry do not invent an empty snapshot", async ({ page }) => {
  let available = false;
  await page.route("**/api/projects/p-alpha/runs", route => route.fulfill({ status: available ? 200 : 500, contentType: "application/json", body: available ? '{"runs":[]}' : "{}" }));
  await show(page, "dashboard"); await expect(page.getByRole("region", { name: "Dashboard", exact: true }).getByRole("alert")).toContainText("Could not load saved reports"); await expect(page.getByText("No saved reports yet", { exact: true })).toHaveCount(0);
  available = true; await page.getByRole("button", { name: "Retry saved reports", exact: true }).click(); await expect(page.getByText("No saved reports yet", { exact: true })).toBeVisible();
});

test("editing a filtered project restores focus when the edited card leaves the results", async ({ page }) => {
  await page.route("**/api/projects/p-alpha", route => route.fulfill({ contentType: "application/json", body: JSON.stringify({ project: { id: "p-alpha", name: "Renamed outside current search", description: "" } }) }));
  await show(page, "projects");
  const search = page.getByRole("searchbox", { name: "Search projects", exact: true }); await search.fill("Revenue");
  await page.getByRole("button", { name: "Edit Revenue migration", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Edit project", exact: true });
  await dialog.getByLabel("Project name", { exact: true }).fill("Renamed outside current search");
  await dialog.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(dialog).toHaveCount(0); await expect(page.getByRole("heading", { name: "No matching projects", exact: true })).toBeVisible();
  await expect(search).toHaveValue("Revenue"); await expect(search).toBeFocused();
});

test("creation from the first-project empty state restores focus to the surviving header action", async ({ page }) => {
  await page.route("**/api/projects", route => route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ project: { id: "p-created", name: "First owned project", description: "" } }) }));
  await show(page, "projects", "light", []);
  await page.getByRole("button", { name: "Create your first project", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "New project", exact: true });
  await dialog.getByLabel("Project name", { exact: true }).fill("First owned project"); await dialog.getByRole("button", { name: "Create project", exact: true }).click();
  await expect(dialog).toHaveCount(0); await expect(page.getByRole("heading", { name: "First owned project", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "New project", exact: true })).toBeFocused();
});

test("System theme follows OS changes without closing project details or clearing search", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.route("**/api/projects/theme-project**", route => route.fulfill({ contentType: "application/json", body: JSON.stringify(route.request().url().endsWith("/templates") ? { templates: [] } : route.request().url().endsWith("/runs") ? { runs: [] } : { project: { id: "theme-project", name: "Customer migration", description: "Synthetic project" } }) }));
  await themeFixture(page, "projects", "dark");
  await page.getByRole("combobox", { name: "Color theme", exact: true }).selectOption("system");
  const search = page.getByRole("searchbox", { name: "Search projects", exact: true }); await search.fill("Customer");
  await page.getByRole("button", { name: "Details for Customer migration", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Project details", exact: true });
  await expect(dialog.getByRole("heading", { name: "Customer migration", exact: true })).toBeVisible();
  const background = await dialog.evaluate(node => getComputedStyle(node).backgroundColor);
  await page.emulateMedia({ colorScheme: "light" }); await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect.poll(() => dialog.evaluate(node => getComputedStyle(node).backgroundColor)).not.toBe(background);
  await expect(dialog).toBeVisible(); await page.keyboard.press("Escape"); await expect(search).toHaveValue("Customer");
});
