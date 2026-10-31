import { build } from "esbuild";
import { expect, test, type Page } from "@playwright/test";
import { refinementScreenshot } from "./helpers/refinement-screenshot";

let script: string;
test.beforeAll(async () => {
  const result = await build({ bundle: true, write: false, platform: "browser", format: "iife", minify: true,
    define: { "process.env.NODE_ENV": '"production"', "process.env": "{}" },
    stdin: { resolveDir: process.cwd(), loader: "tsx", contents: `
      import React from "react";
      import { createRoot } from "react-dom/client";
      import ProjectsView from "./src/components/projects/projects-view";
      import DashboardOverview from "./src/components/projects/dashboard-overview";
      import HistoryResults from "./src/components/reports/history-results";
      const projects = window.emptyFixture ? [] : [{ id: "synthetic-project", name: "Migration rehearsal with a long project name", description: "Synthetic project description" }];
      const history = { items: [{ id: "synthetic-report", projectName: projects[0]?.name ?? "Sample", status: "CONFIG_ERROR", totalRows: 12000, validRows: null, invalidRows: null, issueCount: 2, createdAt: new Date("2026-10-23T05:00:00Z") }], total: 12, page: 1, pageSize: 10, totalPages: 2 };
      createRoot(document.querySelector("#fixture")).render(window.pageFixture === "projects" ? <ProjectsView projects={projects} /> : window.pageFixture === "dashboard" ? <DashboardOverview projects={projects} /> : <HistoryResults filters={{ search: "", status: "ALL", order: "newest", page: 1, pageSize: 10 }} history={history} />);
    ` } });
  script = result.outputFiles[0].text;
});
async function show(page: Page, kind: string, empty = false) {
  if (kind === "dashboard") await page.route("**/api/projects/synthetic-project/runs", route => route.fulfill({ contentType: "application/json", body: JSON.stringify({ runs: [] }) }));
  await page.goto("/");
  const shell = await page.evaluate(() => ({ styles: Array.from(document.head.querySelectorAll('link[rel="stylesheet"],style')).map(n => n.outerHTML).join(""), font: document.documentElement.className }));
  await page.setContent(`<!doctype html><html lang="en" class="${shell.font}"><head>${shell.styles}</head><body><main style="padding:16px;max-width:1152px;margin:auto;min-width:0"><div id="fixture"></div></main></body></html>`);
  await page.evaluate(data => Object.assign(window, { pageFixture: data.kind, emptyFixture: data.empty }), { kind, empty });
  await page.addScriptTag({ content: script });
  await expect(page.locator("h1,h2").first()).toBeVisible();
}
for (const width of [320, 375, 390, 768, 1024, 1440]) {
  for (const kind of ["projects", "dashboard", "history"]) {
    test(`${kind} fits ${width}px`, async ({ page }, info) => {
      await page.setViewportSize({ width, height: 1000 });
      await show(page, kind);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.getByRole("link").first().focus();
      await expect(page.getByRole("link").first()).toBeFocused();
      if (kind === "history") {
        await expect(page.getByLabel("Sort by date")).toHaveValue("newest");
        const summary = page.getByRole("link", { name: /^View summary for/ });
        await expect(summary).toHaveAttribute("href", "/results/synthetic-report");
        const unknownCount = page.getByRole("cell", { name: "Not evaluated", exact: true }).first();
        const wordBounds = await unknownCount.evaluate(cell => {
          const word = document.createRange(); word.setStart(cell.firstChild!, 4); word.setEnd(cell.firstChild!, 13);
          const bounds = cell.getBoundingClientRect();
          return [...word.getClientRects()].map(rect => ({ left: rect.left - bounds.left, right: rect.right - bounds.left, available: bounds.width }));
        });
        expect(wordBounds).toHaveLength(1);
        expect(wordBounds[0].left).toBeGreaterThanOrEqual(0);
        expect(wordBounds[0].right).toBeLessThanOrEqual(wordBounds[0].available);
        const region = page.getByRole("region", { name: "Saved validation reports", exact: true });
        if (process.env.PHASE9_SCREENSHOT_STAGE !== "before") {
          await expect(page.getByText("Scroll horizontally to see all columns.", { exact: false })).toBeVisible();
          await region.focus(); await expect(region).toBeFocused();
          const measurements = await region.evaluate(node => ({ available: node.clientWidth, needed: node.scrollWidth }));
          if (width >= 1024) expect(measurements.needed).toBeLessThanOrEqual(measurements.available + 1);
          else if (width < 768) {
            expect(measurements.needed).toBeGreaterThan(measurements.available);
            await region.press("ArrowRight");
            await expect.poll(() => region.evaluate(node => node.scrollLeft)).toBeGreaterThan(0);
          }
          await summary.focus();
          const linkBox = (await summary.boundingBox())!; const regionBox = (await region.boundingBox())!;
          expect(linkBox.x + linkBox.width).toBeLessThanOrEqual(regionBox.x + regionBox.width + 1);
          expect(linkBox.x).toBeGreaterThanOrEqual(regionBox.x - 1);
        }
        await expect(page.getByRole("link", { name: "Next", exact: true })).toHaveAttribute("href", /page=2/);
      }
      await page.screenshot({ path: refinementScreenshot(info, `${kind}.png`), fullPage: true });
    });
  }
}
for (const kind of ["projects", "dashboard"]) {
  test(`${kind} empty state at 320px`, async ({ page }, info) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await show(page, kind, true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: refinementScreenshot(info, `${kind}-empty.png`), fullPage: true });
  });
}

for (const width of [320, 375, 390, 768, 1024, 1440]) {
  test(`project create and edit controls at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 1000 });
    const requests: { method: string; body: unknown }[] = [];
    // Isolated UI contract fixture: no real session, database writes or auth bypass.
    await page.route("**/api/projects", async route => {
      requests.push({ method: route.request().method(), body: route.request().postDataJSON() });
      await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ project: { id: "created-fixture", ...route.request().postDataJSON() } }) });
    });
    await page.route("**/api/projects/created-fixture", async route => {
      requests.push({ method: route.request().method(), body: route.request().postDataJSON() });
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ project: { id: "created-fixture", ...route.request().postDataJSON() } }) });
    });
    await show(page, "projects", true);
    const trigger = page.getByRole("button", { name: "New project", exact: true });
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "New project", exact: true });
    await expect(dialog.getByLabel("Project name")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(dialog.getByLabel("Description (optional)")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(dialog.getByRole("button", { name: "Cancel", exact: true })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(dialog.getByRole("button", { name: "Create project", exact: true })).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(dialog.getByRole("button", { name: "Cancel", exact: true })).toBeFocused();
    await dialog.getByLabel("Project name").fill("Created project");
    await dialog.getByLabel("Description (optional)").fill("Fixture description");
    await page.screenshot({ path: refinementScreenshot(info, "project-editor.png"), fullPage: true });
    await dialog.getByRole("button", { name: "Create project", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await expect(page.getByRole("heading", { name: "Created project", exact: true })).toBeVisible();
    const edit = page.getByRole("button", { name: "Edit Created project", exact: true });
    await edit.click();
    await expect(page.getByRole("dialog").getByLabel("Project name")).toHaveValue("Created project");
    await page.getByRole("dialog").getByLabel("Project name").fill("Renamed project");
    await page.screenshot({ path: refinementScreenshot(info, "edit-project.png"), fullPage: true });
    await page.getByRole("button", { name: "Save changes", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(requests).toEqual([
      { method: "POST", body: { name: "Created project", description: "Fixture description" } },
      { method: "PATCH", body: { name: "Renamed project", description: "Fixture description" } },
    ]);
    await expect(page.getByRole("heading", { name: "Renamed project", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Edit Renamed project", exact: true }).click();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Edit Renamed project", exact: true })).toBeFocused();
  });
}
for (const status of [401, 404, 500]) {
  test(`project edit handles ${status} without changing the card`, async ({ page }) => {
    await page.route("**/api/projects/synthetic-project", route => route.fulfill({ status, contentType: "application/json", body: JSON.stringify({ error: "Unable to save project" }) }));
    await show(page, "projects");
    await page.getByRole("button", { name: /^Edit Migration/ }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Project name").fill("Unsaved rename");
    await dialog.getByRole("button", { name: "Save changes" }).click();
    await expect(dialog.getByRole("alert")).toContainText(status === 401 ? "Sign in again" : status === 404 ? "no longer have access" : "Unable to save project");
    await expect(page.getByRole("heading", { name: "Migration rehearsal with a long project name", exact: true })).toBeVisible();
    await expect(dialog.getByLabel("Project name")).toHaveValue("Unsaved rename");
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(dialog).toHaveCount(0);
  });
}


for (const width of [320, 375, 768, 1024, 1440]) {
  test(`project deletion confirms, cancels and restores focus at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 1000 });
    let requests = 0;
    await page.route("**/api/projects/synthetic-project", async route => {
      expect(route.request().method()).toBe("DELETE");
      requests++;
      await route.fulfill({ contentType: "application/json", body: '{"message":"Project deleted successfully"}' });
    });
    await show(page, "projects");
    const trigger = page.getByRole("button", { name: /^Delete Migration/ });
    await trigger.focus(); await trigger.press("Enter");
    let dialog = page.getByRole("dialog", { name: "Delete project?", exact: true });
    await expect(dialog.getByRole("button", { name: "Cancel", exact: true })).toBeFocused();
    await expect(dialog).toContainText("saved validation summaries and mapping templates");
    await page.screenshot({ path: refinementScreenshot(info, "delete-project.png"), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0); await expect(trigger).toBeFocused(); expect(requests).toBe(0);
    await trigger.click();
    dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(dialog).toHaveCount(0); expect(requests).toBe(0);
    await trigger.click();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Delete project", exact: true })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "No projects yet" })).toBeVisible();
    await expect(page.getByRole("button", { name: "New project", exact: true })).toBeFocused();
    await expect(page.getByRole("status")).toHaveText("Project deleted."); expect(requests).toBe(1);
  });
}
for (const status of [401, 404, 500]) {
  test(`project deletion retains the card on ${status} and can retry`, async ({ page }) => {
    let requests = 0;
    await page.route("**/api/projects/synthetic-project", async route => {
      requests++;
      await route.fulfill({ status: requests === 1 ? status : 200, contentType: "application/json", body: "{}" });
    });
    await show(page, "projects");
    await page.getByRole("button", { name: /^Delete Migration/ }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Delete project", exact: true }).click();
    await expect(dialog.getByRole("alert")).toContainText(status === 401 ? "Sign in again" : status === 404 ? "no longer have access" : "Try again");
    await expect(page.getByRole("heading", { name: "Migration rehearsal with a long project name", exact: true })).toBeVisible();
    await dialog.getByRole("button", { name: "Delete project", exact: true }).click();
    await expect(dialog).toHaveCount(0); expect(requests).toBe(2);
  });
}
test("project deletion blocks duplicate submission and dismissal until settled", async ({ page }) => {
  let release!: () => void; let requests = 0;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/projects/synthetic-project", async route => {
    requests++; await pending; await route.abort("failed");
  });
  await show(page, "projects");
  await page.getByRole("button", { name: /^Delete Migration/ }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Delete project", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "Cancel", exact: true })).toBeDisabled();
  await page.keyboard.press("Escape"); await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("status")).toHaveText("Deleting project..."); expect(requests).toBe(1);
  release(); await expect(dialog.getByRole("alert")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Cancel", exact: true })).toBeEnabled();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Migration rehearsal with a long project name", exact: true })).toBeVisible();
});
