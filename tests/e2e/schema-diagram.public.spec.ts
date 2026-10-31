import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { build } from "esbuild";
import { expect, test, type Page, type Route } from "@playwright/test";
import { workspaceControl, workspaceStep } from "./helpers/workspace-navigation";
import { downloadText } from "./helpers";
import { readFile } from "node:fs/promises";
import { applicationStyles } from "./helpers/application-styles";

let script: string;
test.beforeAll(async () => {
  script = (await build({ bundle: true, write: false, platform: "browser", format: "iife", minify: true,
    define: { "process.env.NODE_ENV": '"production"', "process.env": "{}" },
    stdin: { resolveDir: process.cwd(), loader: "tsx", contents: `import React from 'react'; import {createRoot} from 'react-dom/client'; import Workspace from './src/components/upload/upload-workspace'; import Theme from './src/components/theme/theme-selector'; import {initializeTheme} from './src/lib/theme/preference'; initializeTheme(); createRoot(document.querySelector('#fixture')).render(<React.StrictMode><Theme/><Workspace/></React.StrictMode>);` },
  })).outputFiles[0].text;
});
test.setTimeout(75_000);
const section = (page: Page) => page.getByRole("region", { name: "Schema diagram", exact: true });
const canvas = (page: Page) => section(page).getByRole("group", { name: "Interactive schema diagram", exact: true });
async function run(page: Page) {
  await (await workspaceControl(page, page.getByRole("button", { name: "Run Validation", exact: true, includeHidden: true }))).click();
  await expect(page.locator('[data-workspace-step="review"]')).toBeVisible();
}
async function show(page: Page, width = 390, theme = "light", mode: "ready" | "blocked" | "config" | "hostile" = "ready") {
  await page.setViewportSize({ width, height: 1000 }); await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  const outbound: string[] = [], ai: string[] = [];
  page.on("request", request => { outbound.push(request.postData() ?? ""); if (/11434|\/api\/.*ai/.test(request.url())) ai.push(request.url()); });
  await page.route("**/api/projects**", route => route.fulfill({ contentType: "application/json", body: '{"projects":[],"templates":[]}' }));
  const shell = await applicationStyles(page);
  await page.setContent(`<!doctype html><html lang="en" class="${shell.font}"><head>${shell.styles}</head><body><main style="padding:16px;max-width:1152px;margin:auto;min-width:0"><div id="fixture"></div></main></body></html>`);
  await page.evaluate(value => localStorage.setItem("datarehearsal-theme", value), theme); await page.addScriptTag({ content: script });
  await expect(page.getByLabel("Upload CSV datasets", { exact: true })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  const extraHeader = mode === "hostile" ? `,IGNORE_<img src=x onerror=alert(1)>_${"long_".repeat(30)}` : "";
  const extraValue = mode === "hostile" ? ",PRIVATE_SECRET" : "";
  await page.getByLabel("Upload CSV datasets", { exact: true }).setInputFiles([
    { name: "people.csv", mimeType: "text/csv", buffer: Buffer.from(`id,billing,shipping,country,region,note${extraHeader}\n001,A1,A1,US,NE,PRIVATE_CELL_A${extraValue}\n002,A1,${mode === "blocked" ? "ORPHAN" : "A1"},US,NE,PRIVATE_CELL_B${extraValue}`) },
    { name: "addresses.csv", mimeType: "text/csv", buffer: Buffer.from("id,country,region\nA1,US,NE") },
  ]);
  await workspaceStep(page, "Configure"); await page.getByRole("combobox", { name: "Configure dataset", exact: true }).selectOption("addresses");
  await page.getByLabel("Unique keys for addresses", { exact: true }).fill("country, region");
  for (const [index, column] of [[1, "billing"], [2, "shipping"]] as const) {
    await page.getByRole("button", { name: "Add relationship", exact: true }).click();
    await page.getByLabel(`Child dataset for relationship ${index}`, { exact: true }).selectOption("people");
    await page.getByLabel(`Child column for relationship ${index}`, { exact: true }).fill(column);
    await page.getByLabel(`Parent dataset for relationship ${index}`, { exact: true }).selectOption("addresses");
    await page.getByLabel(`Parent column for relationship ${index}`, { exact: true }).fill(mode === "config" && index === 2 ? "missing_parent" : "id");
  }
  await page.getByRole("button", { name: "Add composite relationship", exact: true }).click();
  await page.getByLabel("Composite child dataset 1", { exact: true }).selectOption("people");
  await page.getByLabel("Composite parent dataset 1", { exact: true }).selectOption("addresses");
  await page.getByLabel("Composite child columns 1", { exact: true }).fill("region, country");
  await page.getByLabel("Composite parent columns 1", { exact: true }).fill("region, country");
  await run(page);
  return { outbound, ai };
}
async function generate(page: Page) {
  const button = page.getByRole("button", { name: "Generate schema diagram", exact: true });
  await button.focus(); await page.keyboard.press("Enter");
  await expect(page.getByRole("combobox", { name: "Review section", exact: true })).toHaveValue("schema");
  const heading = section(page).getByRole("heading", { name: "Schema diagram", exact: true });
  await expect(heading).toBeFocused(); await expect(canvas(page)).toBeVisible();
  expect(await heading.evaluate(node => { const box = node.getBoundingClientRect(), hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2); return hit === node || node.contains(hit); })).toBe(true);
  await expect.poll(() => canvas(page).locator("svg").getAttribute("viewBox")).not.toBeNull();
}

for (const width of [320, 375, 390, 768, 1024, 1440]) for (const theme of ["light", "dark"]) {
  test(`schema keyboard, exact relationships and retained viewport ${width}px ${theme}`, async ({ page }) => {
    const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
    const network = await show(page, width, theme); await generate(page);
    const svg = canvas(page).locator("svg");
    await expect(svg.locator('g[id^="er-0-table-"]').filter({ has: page.locator(":scope > rect") })).toHaveCount(2);
    await expect(svg.locator("path[marker-end]")).toHaveCount(4);
    await expect(svg.locator('g[id="er-0-table-0"] > rect').first()).toHaveCSS("fill", theme === "light" ? "rgb(255, 255, 255)" : "rgb(23, 26, 34)");
    await expect(section(page)).not.toContainText("PRIVATE_CELL");
    await section(page).getByRole("button", { name: "Reset schema view", exact: true }).click();
    await expect(section(page).getByRole("status", { name: "Schema diagram zoom" })).toHaveText("100%");
    await page.keyboard.press("Tab"); await canvas(page).focus(); await expect(canvas(page)).toHaveCSS("outline-style", "solid");
    if (width === 390 && theme === "light") {
      const start = await svg.getAttribute("viewBox"), box = (await canvas(page).boundingBox())!;
      await page.mouse.move(box.x + 8, box.y + 8); await page.mouse.down(); await page.mouse.move(box.x + 40, box.y + 28, { steps: 3 }); await page.mouse.up();
      expect(await svg.getAttribute("viewBox")).not.toBe(start); await canvas(page).focus(); await page.keyboard.press("Home");
    }
    const initial = await svg.getAttribute("viewBox"); await page.keyboard.press("ArrowRight"); expect(await svg.getAttribute("viewBox")).not.toBe(initial);
    await page.keyboard.press("+"); await expect(section(page).getByRole("status", { name: "Schema diagram zoom" })).toHaveText("125%");
    const retained = await svg.getAttribute("viewBox");
    await page.getByRole("combobox", { name: "Review section", exact: true }).selectOption("summary");
    await page.getByRole("combobox", { name: "Review section", exact: true }).selectOption("schema");
    await expect(svg).toHaveAttribute("viewBox", retained!);
    await workspaceStep(page, "Correct"); await workspaceStep(page, "Review"); await expect(svg).toHaveAttribute("viewBox", retained!);
    await page.getByRole("combobox", { name: "Color theme", exact: true }).selectOption(theme === "light" ? "dark" : "light");
    await expect(svg).toHaveAttribute("viewBox", retained!);
    await section(page).getByRole("combobox", { name: "Inspect schema entity", exact: true }).selectOption({ label: "people" });
    await expect(section(page).getByRole("status").filter({ hasText: "Entity people:" })).toContainText("6 columns");
    const relationships = section(page).getByRole("combobox", { name: "Inspect schema relationship", exact: true });
    const composite = await relationships.locator("option").evaluateAll(options => (options as HTMLOptionElement[]).find(option => option.textContent?.includes('["region","country"]'))!.value);
    await relationships.selectOption(composite); await expect(section(page).getByRole("status").filter({ hasText: "Pair 1:" })).toContainText("people.region → addresses.region");
    await expect(section(page).getByRole("status").filter({ hasText: "Pair 1:" })).toContainText("people.country → addresses.country");
    await section(page).getByRole("button", { name: "Schema tables", exact: true }).click();
    await section(page).getByRole("combobox", { name: "Schema table dataset", exact: true }).selectOption({ label: "people" });
    await expect(section(page).getByRole("table", { name: /people: all 6/ })).toContainText("shipping");
    await section(page).locator("summary").filter({ hasText: /^Foreign-key pairs/ }).click();
    await expect(section(page).getByRole("table", { name: /Complete foreign keys/ }).locator("tbody tr")).toHaveCount(4);
    await section(page).getByRole("button", { name: "Diagram", exact: true }).click(); await section(page).getByRole("button", { name: "Fit schema diagram", exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(network.ai).toEqual([]); expect(network.outbound.join(" ")).not.toMatch(/PRIVATE_CELL|PRIVATE_SECRET/); expect(errors).toEqual([]);
    if (width === 320 || width === 1440) {
      const folder = resolve("playwright/.cache/schema-diagram-ui"); mkdirSync(folder, { recursive: true });
      await section(page).screenshot({ path: resolve(folder, `schema-${width}-${theme === "light" ? "dark" : "light"}.png`) });
    }
  });
}
for (const width of [320, 1440]) test(`System appearance changes preserve camera at ${width}px`, async ({ page }) => {
  await show(page, width, "system"); await generate(page);
  const svg = canvas(page).locator("svg"); await section(page).getByRole("button", { name: "Pan schema right", exact: true }).click(); const before = await svg.getAttribute("viewBox");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark"); await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light"); await expect(svg).toHaveAttribute("viewBox", before!);
  await expect(svg.locator('g[id="er-0-table-0"] > rect').first()).toHaveCSS("fill", "rgb(255, 255, 255)");
});
test("pending mapping drafts suspend the diagram; Cancel restores camera and Apply requires regeneration", async ({ page }) => {
  await show(page); await generate(page); await section(page).getByRole("button", { name: "Pan schema right", exact: true }).click();
  const before = await canvas(page).locator("svg").getAttribute("viewBox");
  await workspaceStep(page, "Configure"); await page.getByRole("combobox", { name: "Configure dataset", exact: true }).selectOption("people");
  await page.getByLabel("Target for people.note", { exact: true }).fill("remarks"); await workspaceStep(page, "Review");
  await expect(page.getByRole("button", { name: "Generate schema diagram", exact: true })).toBeDisabled(); await expect(section(page)).toContainText("Apply or cancel"); await expect(canvas(page)).toBeHidden();
  await workspaceStep(page, "Configure"); await page.getByRole("button", { name: "Cancel mapping for people", exact: true }).click(); await workspaceStep(page, "Review");
  await expect(canvas(page)).toBeVisible(); await expect(canvas(page).locator("svg")).toHaveAttribute("viewBox", before!);
  await workspaceStep(page, "Configure"); await page.getByLabel("Target for people.note", { exact: true }).fill("remarks"); await page.getByRole("button", { name: "Apply mapping for people", exact: true }).click();
  await run(page); await page.getByRole("combobox", { name: "Review section", exact: true }).selectOption("schema"); await expect(section(page)).toContainText("configuration changed"); await expect(canvas(page)).toBeHidden();
  await generate(page); await expect(canvas(page).locator("svg")).toContainText("remarks");
});
test("manual corrections, Undo/Redo and original/history survive schema generation and navigation", async ({ page }) => {
  await show(page); await workspaceStep(page, "Correct");
  await page.getByRole("button", { name: "Edit people line 2 column note", exact: true }).click();
  await page.getByRole("textbox", { name: "Proposed value for people line 2 column note", exact: true }).fill("PRIVATE_APPROVED"); await page.getByRole("button", { name: "Apply correction", exact: true }).click();
  await workspaceStep(page, "Review"); const before = await downloadText(page, "Download JSON report"); await generate(page);
  await section(page).getByRole("button", { name: "Pan schema right", exact: true }).click(); const camera = await canvas(page).locator("svg").getAttribute("viewBox");
  expect(await downloadText(page, "Download JSON report")).toBe(before);
  await workspaceStep(page, "Correct"); await expect(page.getByText("Correction activity history (1)", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Undo correction", exact: true }).click(); await workspaceStep(page, "Review");
  await expect(canvas(page).locator("svg")).toHaveAttribute("viewBox", camera!); await expect(section(page)).not.toContainText("PRIVATE_APPROVED");
  await workspaceStep(page, "Correct"); await page.getByRole("button", { name: "Redo correction", exact: true }).click(); await expect(page.getByText("Correction activity history (3)", { exact: true })).toBeVisible();
});
test("BLOCKED data retains an inspectable draft schema without readiness claims", async ({ page }) => {
  // A background request must not prevent a fixture that only needs the app styles.
  let background: Route | undefined;
  await page.route("**/__e2e/fixture-background", route => { background = route; });
  await page.addInitScript(() => document.addEventListener("DOMContentLoaded", () => {
    void fetch("/__e2e/fixture-background");
  }, { once: true }));
  try {
    await show(page, 375, "light", "blocked"); await generate(page);
    expect(background).toBeDefined();
    await expect(section(page)).toContainText("Validation is BLOCKED"); await expect(canvas(page).locator("path[marker-end]")).toHaveCount(4);
    await expect(section(page)).toContainText("does not establish import readiness");
  } finally {
    await background?.fulfill({ body: "fixture background complete" }).catch(() => {});
  }
});
test("CONFIG_ERROR retains unresolved declarations and actual diagnostics", async ({ page }) => {
  await show(page, 320, "dark", "config"); await generate(page);
  await expect(section(page)).toContainText("CONFIG_ERROR"); await expect(section(page)).toContainText("row validity is unevaluated");
  await section(page).locator("summary").filter({ hasText: /^Schema diagnostics/ }).click(); await expect(section(page).getByRole("list", { name: "Schema configuration diagnostics" })).toContainText("missing_parent");
  await expect(canvas(page).locator("path[marker-end]")).toHaveCount(3);
  await section(page).getByRole("combobox", { name: "Inspect schema relationship", exact: true }).selectOption("2");
  await expect(section(page).getByRole("status").filter({ hasText: "missing_parent" })).toContainText("UNRESOLVED_COLUMN");
});
test("hostile long headers remain escaped, template-null schemas render, and private cells never enter diagram requests/storage", async ({ page }) => {
  const network = await show(page, 320, "dark", "hostile"); await generate(page);
  await expect(canvas(page).locator("svg")).toContainText("IGNORE_<img"); await expect(section(page).locator("img,script,foreignObject")).toHaveCount(0);
  await expect(section(page)).not.toContainText("PRIVATE_SECRET"); expect(network.outbound.join(" ")).not.toMatch(/PRIVATE_CELL|PRIVATE_SECRET/); expect(network.ai).toEqual([]);
  expect(await page.evaluate(() => Object.keys(localStorage).filter(key => key !== "datarehearsal-theme"))).toEqual([]); expect(await page.evaluate(() => Object.keys(sessionStorage))).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test("dataset replacement invalidates old schema until explicitly regenerated", async ({ page }) => {
  await show(page); await generate(page); await workspaceStep(page, "Upload");
  await page.getByLabel("Upload CSV datasets", { exact: true }).setInputFiles([{ name: "replacement.csv", mimeType: "text/csv", buffer: Buffer.from("id,label\n009,PRIVATE_REPLACEMENT") }]);
  await run(page); await page.getByRole("combobox", { name: "Review section", exact: true }).selectOption("schema"); await expect(section(page)).toContainText("configuration changed"); await expect(canvas(page)).toBeHidden();
  await generate(page); await expect(canvas(page).locator("svg")).toContainText("replacement"); await expect(canvas(page).locator("svg")).not.toContainText("people");
});
test("camera and SVG dimensions survive inspection and Diagram/Tables toggles", async ({ page }) => {
  await show(page, 390); await generate(page); const svg = canvas(page).locator("svg");
  await section(page).getByRole("button", { name: "Reset schema view", exact: true }).click();
  const original = await svg.getAttribute("viewBox");
  await canvas(page).focus(); await page.keyboard.press("Control+ArrowRight"); await expect(svg).toHaveAttribute("viewBox", original!);
  await section(page).getByRole("button", { name: "Schema tables", exact: true }).click(); await section(page).getByRole("button", { name: "Diagram", exact: true }).click();
  await expect(svg).toHaveAttribute("viewBox", original!);
  await section(page).getByRole("combobox", { name: "Inspect schema entity", exact: true }).selectOption({ label: "people" });
  expect((await section(page).getByRole("status", { name: "Schema inspection details" }).boundingBox())!.height).toBeLessThanOrEqual(193);
  const inspected = await svg.getAttribute("viewBox"); await section(page).getByRole("button", { name: "Clear schema inspection", exact: true }).click();
  await expect(svg).toHaveAttribute("viewBox", inspected!);
  const box = (await canvas(page).boundingBox())!, image = (await svg.boundingBox())!;
  expect(Math.abs(image.width - box.width)).toBeLessThanOrEqual(3); expect(Math.abs(image.height - box.height)).toBeLessThanOrEqual(3);
});
test("large schema tables remain complete inside keyboard-scrollable bounded regions", async ({ page }) => {
  await show(page, 320); await workspaceStep(page, "Upload");
  const columns = ["id", ...Array.from({ length: 119 }, (_, index) => `configured_column_${index + 1}`)];
  await page.getByLabel("Upload CSV datasets", { exact: true }).setInputFiles([{ name: "large.csv", mimeType: "text/csv", buffer: Buffer.from(`${columns.join(",")}\n${columns.map((_, index) => index ? "PRIVATE_LARGE_VALUE" : "001").join(",")}`) }]);
  await run(page); await generate(page); await section(page).getByRole("button", { name: "Schema tables", exact: true }).click();
  const list = section(page).getByRole("region", { name: "Schema column list", exact: true });
  await expect(list.locator("tbody tr")).toHaveCount(120); await expect(list).toContainText("configured_column_119");
  expect((await list.boundingBox())!.height).toBeLessThanOrEqual(385);
  await list.focus(); await page.keyboard.press("PageDown"); await expect.poll(() => list.evaluate(node => node.scrollTop)).toBeGreaterThan(0);
  await expect(section(page)).not.toContainText("PRIVATE_LARGE_VALUE"); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

async function exportedSvg(page: Page) {
  const [download] = await Promise.all([page.waitForEvent("download"), section(page).getByRole("button", { name: "Download schema SVG", exact: true }).click()]);
  const path = await download.path(); expect(path).not.toBeNull();
  return { filename: download.suggestedFilename(), content: await readFile(path!, "utf8") };
}
async function inspectExport(page: Page, content: string) {
  return page.evaluate(svg => {
    const document = new DOMParser().parseFromString(svg, "image/svg+xml"), root = document.documentElement;
    return { errors: document.querySelectorAll("parsererror").length, width: root.getAttribute("width"), height: root.getAttribute("height"), viewBox: root.getAttribute("viewBox"),
      tables: [...document.querySelectorAll("g[id]")].filter(node => /^er-0-table-\d+$/.test(node.id)).length,
      columns: [...document.querySelectorAll("g[id]")].filter(node => /-column-\d+$/.test(node.id)).length,
      pairs: document.querySelectorAll("path[marker-end]").length, title: document.querySelector("title")?.textContent,
      background: document.querySelector("svg > rect")?.getAttribute("fill"),
      unsafe: document.querySelectorAll("script,image,foreignObject,a,use,animate").length + [...document.querySelectorAll("*")].flatMap(node => [...node.attributes]).filter(attribute => /^on/i.test(attribute.name) || /href$/i.test(attribute.name)).length };
  }, content);
}
for (const theme of ["light", "dark"]) test(`export: complete standalone ${theme} SVG ignores camera and works offline`, async ({ page }) => {
  const network = await show(page, 390, theme); await generate(page);
  const reportBefore = await downloadText(page, "Download JSON report"), first = await exportedSvg(page);
  expect(first.filename).toBe("datarehearsal-schema.svg"); const inspected = await inspectExport(page, first.content);
  expect(inspected).toMatchObject({ errors: 0, tables: 2, columns: 9, pairs: 4, unsafe: 0, background: theme === "dark" ? "#0b0d12" : "#fafafb" });
  expect(inspected.viewBox).toBe(`0 0 ${inspected.width} ${inspected.height}`);
  await section(page).getByRole("button", { name: "Reset schema view", exact: true }).click(); await section(page).getByRole("button", { name: "Pan schema right", exact: true }).click();
  await section(page).getByRole("button", { name: "Zoom in schema diagram", exact: true }).click(); const camera = await canvas(page).locator("svg").getAttribute("viewBox");
  await page.context().setOffline(true); const second = await exportedSvg(page); expect(second.content).toBe(first.content);
  await expect(canvas(page).locator("svg")).toHaveAttribute("viewBox", camera!);
  await page.context().setOffline(false); expect(await downloadText(page, "Download JSON report")).toBe(reportBefore);
  expect(second.content).not.toMatch(/PRIVATE_CELL|configurationKey|correctionHistory|rowNumber/); expect(network.ai).toEqual([]);
});
test("export: marked CONFIG_ERROR draft discloses missing endpoints without losing declarations", async ({ page }) => {
  await show(page, 320, "dark", "config"); await generate(page); const file = await exportedSvg(page), inspected = await inspectExport(page, file.content);
  expect(file.filename).toBe("datarehearsal-schema-draft.svg"); expect(inspected).toMatchObject({ errors: 0, tables: 2, columns: 9, pairs: 3, unsafe: 0 });
  expect(inspected.title).toContain("DRAFT"); expect(file.content).toContain("missing_parent"); expect(file.content).toContain("UNRESOLVED_COLUMN"); expect(file.content).toContain("CONFIG_ERROR");
  expect(file.content.match(/id="er-0-fk-\d+"/g)).toHaveLength(3);
});
test("export: System theme uses the resolved appearance at each download", async ({ page }) => {
  await show(page, 375, "system"); await generate(page);
  expect((await inspectExport(page, (await exportedSvg(page)).content)).background).toBe("#0b0d12");
  await page.emulateMedia({ colorScheme: "light" }); await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  expect((await inspectExport(page, (await exportedSvg(page)).content)).background).toBe("#fafafb");
});
test("export: malicious labels stay inert in actual downloaded SVG", async ({ page }) => {
  const network = await show(page, 320, "light", "hostile"); await generate(page); const file = await exportedSvg(page), inspected = await inspectExport(page, file.content);
  expect(inspected).toMatchObject({ errors: 0, unsafe: 0, columns: 10 }); expect(file.content).toContain("IGNORE_&lt;img"); expect(file.content).not.toContain("PRIVATE_SECRET"); expect(network.ai).toEqual([]);
});
test("export: drafts and applied configuration changes revoke downloads until current generation", async ({ page }) => {
  await show(page); await generate(page); await exportedSvg(page);
  await workspaceStep(page, "Configure"); await page.getByRole("combobox", { name: "Configure dataset", exact: true }).selectOption("people"); await page.getByLabel("Target for people.note", { exact: true }).fill("memo");
  await workspaceStep(page, "Review"); await expect(section(page).getByRole("button", { name: "Download schema SVG", exact: true })).toHaveCount(0);
  await workspaceStep(page, "Configure"); await page.getByRole("button", { name: "Apply mapping for people", exact: true }).click(); await run(page);
  await page.getByRole("combobox", { name: "Review section", exact: true }).selectOption("schema"); await expect(section(page).getByRole("button", { name: "Download schema SVG", exact: true })).toHaveCount(0);
  await generate(page); expect((await exportedSvg(page)).content).toContain("memo");
});
test("export: download failures are private, retryable and preserve state; Blob URLs are cleaned up", async ({ page }) => {
  await show(page); await generate(page); const before = await downloadText(page, "Download JSON report"), camera = await canvas(page).locator("svg").getAttribute("viewBox");
  await page.evaluate(() => { const original = URL.createObjectURL; Object.assign(window, { __restoreSvgUrl: () => { URL.createObjectURL = original; } }); URL.createObjectURL = () => { throw new Error("PRIVATE_FAILURE_PAYLOAD"); }; });
  await section(page).getByRole("button", { name: "Download schema SVG", exact: true }).click(); await expect(section(page).getByRole("alert")).toContainText("Unable to start the SVG download"); await expect(section(page)).not.toContainText("PRIVATE_FAILURE_PAYLOAD");
  await expect(canvas(page).locator("svg")).toHaveAttribute("viewBox", camera!);
  await page.evaluate(() => { (window as unknown as { __restoreSvgUrl: () => void }).__restoreSvgUrl(); const create = URL.createObjectURL, revoke = URL.revokeObjectURL;
    const calls = { created: [] as string[], revoked: [] as string[] }; Object.assign(window, { __svgUrlCalls: calls });
    URL.createObjectURL = value => { const url = create.call(URL, value); calls.created.push(url); return url; }; URL.revokeObjectURL = url => { calls.revoked.push(url); revoke.call(URL, url); }; });
  await exportedSvg(page); await expect.poll(() => page.evaluate(() => { const calls = (window as unknown as { __svgUrlCalls: { created: string[]; revoked: string[] } }).__svgUrlCalls; return calls.created.length > 0 && calls.created.every(url => calls.revoked.includes(url)); })).toBe(true);
  expect(await downloadText(page, "Download JSON report")).toBe(before);
});
test("verification: schema generation and complete SVG download work fully offline without Ollama", async ({ page }) => {
  await page.route("http://127.0.0.1:11434/**", route => route.abort("connectionrefused"));
  await page.route("http://localhost:11434/**", route => route.abort("connectionrefused"));
  const network = await show(page, 320, "dark"), reportBefore = await downloadText(page, "Download JSON report");
  await page.context().setOffline(true); await generate(page);
  const file = await exportedSvg(page), inspected = await inspectExport(page, file.content);
  expect(inspected).toMatchObject({ errors: 0, tables: 2, columns: 9, pairs: 4, unsafe: 0, background: "#0b0d12" });
  expect(network.ai).toEqual([]); expect(file.content).not.toMatch(/PRIVATE_CELL|correctionHistory/);
  expect(await downloadText(page, "Download JSON report")).toBe(reportBefore);
});
