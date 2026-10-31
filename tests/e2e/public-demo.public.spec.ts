import { expect, test } from "@playwright/test";
import { downloadText } from "./helpers";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
const folder = resolve("playwright/.cache/rowzen-demo-oauth-20261027");
const pickerName = "Choose 1 or 2 CSV files (1 MB maximum each)";
for (const width of [320,375,390,768,1024,1440]) for (const theme of ["light","dark"] as const) {
  test(`anonymous custom CSV rules, findings, export and stale guards ${theme} ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 }); await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    const posts: string[] = [], failures: string[] = [];
    page.on("request", request => { if (request.method() === "POST") posts.push(request.url()); });
    page.on("pageerror", error => failures.push(error.message));
    await page.goto("/rehearsal");
    await page.getByLabel(pickerName, { exact: true }).setInputFiles({ name: "inventory.csv", mimeType: "text/csv", buffer: Buffer.from('SKU,note,qty\r\n001,"PRIVATE_CANARY\r\ncontinued",invalid\r\n002,ok,2') });
    const run = page.getByRole("button", { name: "Run validation", exact: true }); await expect(run).toBeVisible(); await run.click();
    await expect(page.getByText("No data checks configured", { exact: true })).toBeVisible();
    await page.getByRole("combobox", { name: "Type for inventory.csv / qty", exact: true }).selectOption("integer");
    await expect(page.getByRole("button", { name: "Download JSON report", exact: true })).toHaveCount(0); await run.click();
    const results = page.getByRole("region", { name: "Validation results", exact: true });
    await expect(results).toContainText("INVALID_TYPE"); await expect(results.getByRole("cell", { name: "2", exact: true })).toBeVisible();
    const content = await downloadText(page, "Download JSON report"), exported = JSON.parse(content);
    expect(exported.summary).toMatchObject({ totalRecords: 2, invalidRows: 1, validRows: 1 });
    expect(exported.issues[0]).toMatchObject({ rowNumber: 2, column: "qty" });
    expect(content).not.toContain("PRIVATE_CANARY"); expect(content).not.toContain("continued");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    mkdirSync(folder, { recursive: true }); await page.screenshot({ path: resolve(folder, `demo-${theme}-${width}.png`), fullPage: true });
    await page.getByRole("checkbox", { name: "inventory.csv / SKU primary", exact: true }).check();
    await expect(results).toHaveCount(0); await run.click(); await expect(results).toContainText("INVALID_TYPE");
    expect(posts).toEqual([]); expect(failures).toEqual([]);
    expect(await page.evaluate(() => Object.keys(localStorage).filter(key => key !== "datarehearsal-theme"))).toEqual([]);
    expect(await page.evaluate(() => Object.keys(sessionStorage))).toEqual([]);
    await page.reload(); await expect(page.getByRole("region", { name: "Demo checks", exact: true })).toHaveCount(0);
  });
}
test("demo rejects invalid files, preserves explicit sample rules and can recover with custom clean CSV", async ({ page }) => {
  await page.goto("/rehearsal");
  const picker = page.getByLabel(pickerName, { exact: true });
  for (const [name, csv, expected] of [["bad.csv","x,x\n1,2","duplicate column"],["empty.csv","","1 byte"],["quote.csv",'x,y\n1,"bad',"parse error"]] as const) {
    await picker.setInputFiles({ name, mimeType: "text/csv", buffer: Buffer.from(csv) }); await expect(page.locator("main").getByRole("alert")).toContainText(expected);
  }
  await picker.setInputFiles({ name: "encoding.csv", mimeType: "text/csv", buffer: Buffer.from([255]) }); await expect(page.locator("main").getByRole("alert")).toContainText("UTF-8");
  await picker.setInputFiles({ name: "large.csv", mimeType: "text/csv", buffer: Buffer.alloc(1048577) }); await expect(page.locator("main").getByRole("alert")).toContainText("1 MB");
  await picker.setInputFiles(["a","b","c"].map(name => ({ name: name + ".csv", mimeType: "text/csv", buffer: Buffer.from("x\n1") }))); await expect(page.locator("main").getByRole("alert")).toContainText("1 or 2");
  await page.getByRole("button", { name: "Load sample CSVs", exact: true }).click();
  await page.getByRole("button", { name: "Apply students/departments example rules", exact: true }).click(); await page.getByRole("button", { name: "Run validation", exact: true }).click();
  await expect(page.getByRole("region", { name: "Validation results", exact: true })).toContainText("FK_NOT_FOUND");
  await picker.setInputFiles({ name: "private.csv", mimeType: "text/csv", buffer: Buffer.from("description,active\nhello,true") });
  await page.getByRole("combobox", { name: "Type for private.csv / active", exact: true }).selectOption("boolean");
  await page.getByRole("button", { name: "Run validation", exact: true }).click(); await expect(page.getByText("Configured checks found no errors", { exact: true })).toBeVisible();
});
test("foreign-key checks require explicit compatible key configuration and disclose unevaluated rows", async ({ page }) => {
  await page.goto("/rehearsal");
  await page.getByLabel(pickerName, { exact: true }).setInputFiles([{ name: "child.csv", mimeType: "text/csv", buffer: Buffer.from("parent\n7") },{ name: "parent.csv", mimeType: "text/csv", buffer: Buffer.from("key\n1") }]);
  await expect(page.getByText("No data rules selected.", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Add relationship", exact: true }).click(); await page.getByRole("button", { name: "Run validation", exact: true }).click();
  await expect(page.getByText("Configuration error: review the selected checks", { exact: true })).toBeVisible(); await expect(page.getByText("Not evaluated", { exact: true }).first()).toBeVisible();
  await page.getByRole("checkbox", { name: "parent.csv / key primary", exact: true }).check(); await page.getByRole("button", { name: "Run validation", exact: true }).click();
  await expect(page.getByRole("region", { name: "Validation results", exact: true })).toContainText("FK_NOT_FOUND");
});
test("landing supports live demo, restrained entrance and reduced-motion reveal", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" }); await page.goto("/");
  expect(await page.locator(".rz-hero-copy").evaluate(node => getComputedStyle(node).animationName)).toBe("rowzen-enter");
  await page.getByRole("tablist", { name: "Product interfaces" }).scrollIntoViewIfNeeded(); await expect(page.locator(".rz-reveal-visible")).toHaveCount(1);
  await page.emulateMedia({ reducedMotion: "reduce" }); await page.reload();
  expect(await page.locator(".rz-hero-copy").evaluate(node => getComputedStyle(node).animationName)).toBe("none");
  await page.getByRole("tablist", { name: "Product interfaces" }).scrollIntoViewIfNeeded(); await expect(page.locator(".rz-reveal-visible")).toHaveCount(0);
  await page.getByRole("link", { name: "Try live demo", exact: true }).click(); await expect(page).toHaveURL(/\/rehearsal$/);
});
