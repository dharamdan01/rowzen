import { refinementScreenshot } from "./helpers/refinement-screenshot";
import { build } from "esbuild";
import { expect, test, type Page } from "@playwright/test";
import { parseCsvText } from "../../src/lib/csv/parser";
import { runPreflight } from "../../src/lib/rehearsal/preflight";

type Mode = "chain" | "cycle" | "self" | "long" | "stale";
function fixture(mode: Mode) {
  const names = mode === "cycle" ? ["a", "b", "c", "independent"] : mode === "self" ? ["employees"] : mode === "long" ? ["organization_with_a_very_long_dataset_identifier", "child_with_a_very_long_dataset_identifier"] : ["organizations", "departments", "students"];
  const pairs = mode === "cycle" ? [["a", "b"], ["b", "a"], ["b", "c"]] : mode === "self" ? [["employees", "employees"]] : mode === "long" ? [[names[0], names[1]]] : [["organizations", "departments"], ["departments", "students"]];
  const datasets = names.map(name => parseCsvText("id,ref\n1,1", `${name}.csv`));
  const relationships = pairs.map(([parentDataset, childDataset]) => ({ parentDataset, childDataset, parentColumn: "id", childColumn: "ref" }));
  const rules = Object.fromEntries(datasets.map(dataset => [dataset.name, { primaryKey: "id", required: [], types: {} }]));
  const report = runPreflight({ datasets, rules, relationships });
  return { report, relationships: mode === "stale" ? [{ parentDataset: "students", parentColumn: "id", childDataset: "departments", childColumn: "ref" }] : relationships };
}
let clientScript: string;
test.beforeAll(async () => {
  // Actual diagram with canonical preflight data. No new route, login bypass,
  // persistence, network mutation, installed dependency, or graph-engine mock.
  const bundle = await build({ bundle: true, write: false, platform: "browser", format: "iife", minify: true,
    define: { "process.env.NODE_ENV": '"production"' },
    stdin: { resolveDir: process.cwd(), loader: "tsx", contents: `
      import React from "react";
      import { createRoot } from "react-dom/client";
      import DependencyGraphSection from "./src/components/validation/dependency-graph-section";
      createRoot(document.querySelector("#graph-fixture")).render(<DependencyGraphSection {...window.graphInput} />);
    ` } });
  clientScript = bundle.outputFiles[0].text;
});
async function show(page: Page, mode: Mode = "chain") {
  await page.goto("/");
  const shell = await page.evaluate(() => ({ styles: Array.from(document.head.querySelectorAll('link[rel="stylesheet"], style')).map(node => node.outerHTML).join(""), font: document.documentElement.className }));
  await page.setContent(`<!doctype html><html lang="en" class="${shell.font}"><head>${shell.styles}</head><body><main style="padding:16px;max-width:1152px;margin:auto;min-width:0"><section class="min-w-0 rounded-xl border border-border bg-surface p-4"><div id="graph-fixture" class="min-w-0"></div></section></main></body></html>`);
  const props = fixture(mode);
  await page.evaluate(data => { Object.assign(window, { graphInput: data }); }, props);
  await page.addScriptTag({ content: clientScript });
  await expect(page.getByRole("heading", { name: "Dataset dependencies", exact: true })).toBeVisible();
  await expect.poll(() => diagram(page).evaluate(node => { const box = node.getBoundingClientRect(); return [...node.querySelectorAll("[data-dataset-node] rect")].every(rect => { const r = rect.getBoundingClientRect(); return r.x >= box.x - 1 && r.right <= box.right + 1 && r.y >= box.y - 1 && r.bottom <= box.bottom + 1; }); })).toBe(true);
  return JSON.stringify(props);
}
const diagram = (page: Page) => page.getByRole("group", { name: "Interactive dataset dependency diagram", exact: true });

for (const width of [320, 375, 390, 768, 1024, 1440]) {
  test(`zoom, pan and dataset highlighting remain usable at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    const before = await show(page);
    const svg = diagram(page);
    await expect(page.getByRole("list", { name: "Parent-first dataset order" }).locator("li").first()).toContainText("organizations");
    await expect(svg.locator("[data-dataset-node]")).toHaveCount(3);
    await expect(svg.locator("[data-edge-kind]")).toHaveCount(2);
    const panButtons = page.getByRole("group", { name: "Pan dependency diagram", exact: true }).getByRole("button");
    const panBounds = await Promise.all((await panButtons.all()).map(button => button.boundingBox()));
    expect(new Set(panBounds.map(box => Math.round(box!.y))).size).toBe(1);
    for (const box of panBounds) { expect(box!.width).toBeGreaterThanOrEqual(44); expect(box!.height).toBeGreaterThanOrEqual(44); }
    const paint = await svg.locator("[data-dataset-node] rect").first().evaluate(node => ({ fill: getComputedStyle(node).fill, label: getComputedStyle(node.nextElementSibling!).fill, edge: getComputedStyle(document.querySelector("[data-edge-kind]")!).stroke }));
    expect(paint.fill).toBe("rgb(241, 239, 255)");
    expect(paint.label).toBe("rgb(17, 24, 39)");
    expect(paint.edge).toBe("rgb(81, 69, 205)");
    // Reset intentionally remains 100%; the initial responsive camera fits all nodes.
    await page.getByRole("button", { name: "Reset view", exact: true }).click();
    const originalView = await svg.getAttribute("viewBox");
    await page.getByRole("button", { name: "Zoom in dependency diagram", exact: true }).click();
    await expect(page.getByRole("status", { name: "Diagram zoom", exact: true })).toHaveText("125%");
    await page.getByRole("button", { name: "Zoom out dependency diagram", exact: true }).click();
    await expect(page.getByRole("status", { name: "Diagram zoom", exact: true })).toHaveText("100%");
    await page.getByRole("button", { name: "Reset view", exact: true }).click();
    await expect(svg).toHaveAttribute("viewBox", originalView!);
    await page.getByRole("button", { name: "Pan diagram right", exact: true }).click();
    expect(await svg.getAttribute("viewBox")).not.toBe(originalView);
    await svg.focus();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Home");
    await expect(svg).toHaveAttribute("viewBox", originalView!);
    const box = (await svg.boundingBox())!;
    await page.mouse.move(box.x + box.width - 8, box.y + box.height - 8);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width - 40, box.y + box.height - 30, { steps: 4 });
    await page.mouse.up();
    expect(await svg.getAttribute("viewBox")).not.toBe(originalView);
    await page.getByRole("button", { name: "Fit diagram", exact: true }).click();
    const node = page.getByRole("button", { name: "students: Order 3", exact: true });
    await node.focus();
    await page.keyboard.press("Enter");
    await expect(node).toHaveAttribute("aria-pressed", "true");
    await expect(node).toHaveCSS("outline-style", "solid");
    await expect(page.getByText("Highlighted dataset: students", { exact: true })).toBeVisible();
    await expect(page.getByText(/1 connected relationship/)).toBeVisible();
    await page.getByRole("button", { name: "Show all relationships", exact: true }).click();
    await expect(node).toHaveAttribute("aria-pressed", "false");
    await page.locator("summary").filter({ hasText: /^Relationships as text/ }).click();
    await expect(page.getByRole("list", { name: "Parent to child dependencies" }).locator("li")).toHaveCount(2);
    await page.keyboard.press("Tab");
    await svg.focus();
    await expect(svg).toHaveCSS("outline-style", "solid");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await page.evaluate(() => JSON.stringify((window as unknown as { graphInput: unknown }).graphInput))).toBe(before);
    expect(errors).toEqual([]);
    await page.screenshot({ path: refinementScreenshot(testInfo, "dependency-graph.png"), fullPage: true });
  });
}

test("cycles, downstream blockage and the partial import order stay distinct", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await show(page, "cycle");
  await expect(page.locator("#graph-fixture").getByRole("alert")).toContainText("Dependency cycle groups");
  await expect(page.getByRole("button", { name: "a: Cycle group 1", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "c: Blocked by cycle", exact: true })).toBeVisible();
  await expect(diagram(page).locator('[data-edge-kind="cycle"]')).toHaveCount(2);
  await expect(diagram(page).locator('[data-edge-kind="blocked"]')).toHaveCount(1);
  await expect(page.getByRole("list", { name: "Parent-first dataset order" }).locator("li")).toHaveCount(1);
  await expect(page.getByRole("list", { name: "Parent-first dataset order" })).toContainText("independent");
  await page.screenshot({ path: testInfo.outputPath("cycles.png"), fullPage: true });
});

test("self references draw a loop and stale configuration has no invented edges or order", async ({ page }) => {
  await show(page, "self");
  await expect(diagram(page).locator('[data-edge-kind="cycle"]')).toHaveCount(1);
  await expect(page.getByText("Import order unavailable", { exact: true })).toBeVisible();
  await show(page, "stale");
  await expect(diagram(page).locator("[data-edge-kind]")).toHaveCount(0);
  await expect(page.getByRole("list", { name: "Parent-first dataset order" })).toHaveCount(0);
  await expect(page.getByText(/relationships have changed since this report/)).toBeVisible();
});

test("long dataset names retain full text alternatives and resizing restores a readable viewport", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await show(page, "long");
  const name = "organization_with_a_very_long_dataset_identifier";
  await expect(page.getByRole("button", { name: `${name}: Order 1`, exact: true })).toHaveCount(1);
  await page.getByRole("button", { name: "Pan diagram right", exact: true }).click();
  await page.setViewportSize({ width: 320, height: 1000 });
  await expect(page.getByRole("status", { name: "Diagram zoom", exact: true })).toHaveText("100%");
  await expect.poll(() => diagram(page).evaluate(node => { const box = node.getBoundingClientRect(); return [...node.querySelectorAll("[data-dataset-node] rect")].every(rect => { const r = rect.getBoundingClientRect(); return r.x >= box.x - 1 && r.right <= box.right + 1 && r.y >= box.y - 1 && r.bottom <= box.bottom + 1; }); })).toBe(true);
  await page.locator("summary").filter({ hasText: /^Relationships as text/ }).click();
  await expect(page.getByRole("list", { name: "Parent to child dependencies" })).toContainText(name);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});


test("the actual workspace graph section is visible by default and can still be collapsed", async ({ page }) => {
  await show(page);
  const section = page.locator("#graph-fixture > details");
  await expect(section).toHaveAttribute("open", "");
  await expect(diagram(page)).toBeVisible();
  const toggle = section.locator(":scope > summary");
  await toggle.click();
  await expect(diagram(page)).toBeHidden();
  await toggle.focus();
  await toggle.press("Enter");
  await expect(diagram(page)).toBeVisible();
  await expect(page.getByRole("button", { name: "organizations: Order 1", exact: true })).toBeVisible();
});

test("diagram remains readable when a cached stylesheet lacks new semantic tokens", async ({ page }) => {
  await show(page);
  await page.addStyleTag({ content: ":root { --info: initial; --info-surface: initial; --danger: initial; --danger-surface: initial; --warning: initial; --warning-surface: initial; }" });
  await expect(diagram(page).locator("[data-dataset-node] rect").first()).toHaveCSS("fill", "rgb(241, 239, 255)");
  await expect(diagram(page).locator("[data-dataset-node] text").first()).toHaveCSS("fill", "rgb(17, 24, 39)");
  await expect(diagram(page).locator("[data-edge-kind]").first()).toHaveCSS("stroke", "rgb(81, 69, 205)");
});
