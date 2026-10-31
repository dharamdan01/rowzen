import { mkdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { correctionPack } from "../fixtures/correction-csv-pack";
import { packFile } from "../fixtures/workspace-csv-pack";
import { themeFixture } from "./helpers/theme-fixture";
import { workspaceStep } from "./helpers/workspace-navigation";
import { parseCsvText } from "../../src/lib/csv/parser";

const folder = resolve("playwright/.cache/rowzen-corrections-20261027");
async function show(page: Page, theme: "light" | "dark" = "light") {
  const pack = correctionPack(), writes: string[] = [];
  page.on("request", request => {if (request.postData()) writes.push(request.postData()!);});
  await page.route("**/api/projects**", route => route.fulfill({contentType: "application/json", body: JSON.stringify(route.request().url().includes("/templates") ? {templates: [{id: "correction-template", projectId: "theme-project", name: "Approved correction pack", configuration: pack.template}]} : {projects: [{id: "theme-project", name: "Synthetic correction project"}]})}));
  await page.route("http://127.0.0.1:11434/**", route => route.abort("connectionrefused"));
  await themeFixture(page, "workspace", theme);
  await page.locator("#csv-files").setInputFiles([packFile("05_ai_repair/boolean_review.csv"), packFile("06_export/escaping_unicode.csv")]);
  await workspaceStep(page, "Configure"); await page.getByText("Project and mapping templates", {exact: true}).click();
  await page.getByLabel("Saved mapping template", {exact: true}).selectOption("correction-template");
  page.once("dialog", dialog => dialog.accept()); await page.getByRole("button", {name: "Load mapping template", exact: true}).click();
  await expect(page.getByRole("region", {name: "Mapping and validation templates"})).toContainText("Template applied");
  await workspaceStep(page, "Validate"); await page.getByRole("button", {name: "Run Validation", exact: true}).click();
  await expect(page.getByRole("heading", {name: "Migration readiness: BLOCKED", exact: true})).toBeVisible();
  return {...pack, writes};
}
async function shot(page: Page, name: string) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.evaluate(() => scrollTo(0, 0)); mkdirSync(folder, {recursive: true});
  await page.screenshot({path: resolve(folder, `${name}.png`), fullPage: true});
}
function whatIfRow(page: Page, label: string) {return page.getByTestId("what-if-preview").getByRole("row", {name: new RegExp(`^${label} `)}).locator("td");}
for (const width of [320, 375, 390, 768, 1024, 1440]) for (const theme of ["light", "dark"] as const) {
  test(`pack single-cell approval, What-if, history, multiline and export ${theme} ${width}px`, async ({page}) => {
    test.setTimeout(90000); await page.setViewportSize({width, height: 1000});
    const failures: string[] = []; page.on("pageerror", error => failures.push(error.message));
    const {boolean, text, writes} = await show(page, theme);
    await page.getByRole("combobox", {name: "Review section", exact: true}).selectOption("issues");
    await page.getByRole("button", {name: `Locate ${boolean.name} CSV line ${boolean.rowNumbers[2]} column is_active`, exact: true}).click();
    const activeDraft = page.getByRole("textbox", {name: `Proposed value for ${boolean.name} line ${boolean.rowNumbers[2]} column active`, exact: true});
    await expect(activeDraft).toBeFocused(); await expect(activeDraft).toHaveValue("yes");
    await activeDraft.fill("true"); const draftNode = await activeDraft.elementHandle();
    await workspaceStep(page, "Review"); await workspaceStep(page, "Correct");
    await expect(activeDraft).toHaveValue("true"); expect(await activeDraft.evaluate((el, node) => el === node, draftNode)).toBe(true);
    await page.getByRole("button", {name: "Preview impact", exact: true}).click();
    await expect(whatIfRow(page, "Total issues")).toHaveText(["2", "1"]);
    await expect(page.getByText(/currently changed cell/)).toContainText("0 currently changed cells");
    await expect(page.getByText("Correction activity history (0)", {exact: true})).toBeVisible();
    await shot(page, `positive-preview-${theme}-${width}`);
    await page.getByRole("button", {name: "Cancel edit", exact: true}).click();
    const editFlag = page.getByRole("button", {name: `Edit ${boolean.name} line ${boolean.rowNumbers[2]} column active`, exact: true});
    await expect(editFlag).toBeFocused(); await expect(editFlag.locator("xpath=ancestor::td")).toContainText("yes");
    await editFlag.click(); await activeDraft.fill("true"); await page.getByRole("button", {name: "Preview impact", exact: true}).click();
    await page.getByRole("button", {name: "Apply correction", exact: true}).focus(); await page.keyboard.press("Enter");
    await expect(editFlag).toBeFocused(); await expect(editFlag.locator("xpath=ancestor::td")).toContainText("Original: yes");
    await expect(page.getByText(/currently changed cell/)).toContainText("1 currently changed cell");
    await page.getByRole("button", {name: "Undo correction", exact: true}).click(); await expect(editFlag.locator("xpath=ancestor::td")).toContainText("yes");
    await page.getByRole("button", {name: "Redo correction", exact: true}).click(); await expect(editFlag.locator("xpath=ancestor::td")).toContainText("true");
    await page.getByRole("combobox", {name: "Correction dataset", exact: true}).selectOption(text.name);
    const line = text.rowNumbers[1], editText = page.getByRole("button", {name: `Edit ${text.name} line ${line} column description`, exact: true});
    await editText.click(); const textDraft = page.getByRole("textbox", {name: `Proposed value for ${text.name} line ${line} column description`, exact: true});
    await textDraft.fill(""); await page.getByRole("button", {name: "Preview impact", exact: true}).click();
    await expect(whatIfRow(page, "Total issues")).toHaveText(["1", "2"]);
    await expect(page.getByTestId("what-if-preview")).toContainText("newly introduced findings: 1");
    await expect(page.getByText(/currently changed cell/)).toContainText("1 currently changed cell");
    await page.getByRole("button", {name: "Cancel edit", exact: true}).click(); await expect(editText).toBeFocused();
    await expect(editText.locator("xpath=ancestor::td")).toContainText("second line; unicode");
    await editText.click(); await textDraft.fill("Approved first line\nApproved second line");
    await page.getByRole("button", {name: "Preview impact", exact: true}).click(); await expect(whatIfRow(page, "Total issues")).toHaveText(["1", "1"]);
    await page.getByRole("button", {name: "Apply correction", exact: true}).click();
    await expect(page.getByText(/currently changed cell/)).toContainText("2 currently changed cells");
    await page.getByText("Correction activity history (4)", {exact: true}).click();
    const timeline = page.getByRole("list", {name: "Correction activity timeline", exact: true}); await timeline.focus(); await expect(timeline).toBeFocused();
    expect((await timeline.boundingBox())!.height).toBeLessThanOrEqual(513);
    await expect(timeline).toContainText("Approved first line");
    await shot(page, `applied-history-${theme}-${width}`);
    await workspaceStep(page, "Export"); await page.getByRole("combobox", {name: "Corrected CSV dataset", exact: true}).selectOption(text.name);
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", {name: "Download corrected CSV", exact: true}).click()]);
    const parsed = parseCsvText(await readFile((await download.path())!, "utf8"), download.suggestedFilename());
    expect(parsed.rows[1].description).toBe("Approved first line\nApproved second line"); expect(parsed.rows[1].postal_code).toBe("00002");
    expect(parsed.rows[2].description).toBe("'=2+2"); expect(parsed.headers).toEqual(text.headers);
    expect(parsed.rows[3].description).toBe(text.rows[3].description);
    await workspaceStep(page, "Upload"); await page.getByRole("combobox", {name: "Preview dataset", exact: true}).selectOption(text.name);
    const original = page.getByRole("region", {name: `Preview of ${text.filename}`, exact: true});
    await expect(original).toContainText("second line; unicode"); await expect(original).toContainText("00002"); await expect(original).not.toContainText("Approved first line");
    await workspaceStep(page, "Correct"); await expect(page.getByText("Correction activity history (4)", {exact: true})).toBeVisible();
    expect(writes).toEqual([]); expect(failures).toEqual([]);
    expect(await page.evaluate(() => Object.keys(localStorage).filter(key => key !== "datarehearsal-theme"))).toEqual([]);
  });
}

test("manual draft, editor node and preview survive System changes and step navigation", async ({page}) => {
  await page.setViewportSize({width: 390, height: 1000}); await page.emulateMedia({colorScheme: "dark"});
  const {boolean} = await show(page, "dark"); await workspaceStep(page, "Correct");
  await page.getByRole("button", {name: `Edit ${boolean.name} line 4 column active`, exact: true}).click();
  const draft = page.getByRole("textbox", {name: `Proposed value for ${boolean.name} line 4 column active`, exact: true});
  await draft.fill("true"); const node = await draft.elementHandle();
  await page.getByRole("button", {name: "Preview impact", exact: true}).click();
  await page.getByRole("combobox", {name: "Color theme", exact: true}).selectOption("system"); await page.emulateMedia({colorScheme: "light"});
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light"); await workspaceStep(page, "Review"); await workspaceStep(page, "Correct");
  await expect(draft).toHaveValue("true"); expect(await draft.evaluate((el, previous) => el === previous, node)).toBe(true);
  await expect(page.getByTestId("what-if-preview")).toBeVisible(); await expect(page.getByText(/currently changed cell/)).toContainText("0 currently changed cells");
  await page.getByRole("button", {name: "Cancel edit", exact: true}).click(); await expect(page.getByText("Correction activity history (0)", {exact: true})).toBeVisible();
});
