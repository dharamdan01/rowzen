import { refinementScreenshot } from "./helpers/refinement-screenshot";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, type Page } from "@playwright/test";
import FilePicker from "../../src/components/upload/file-picker";
import { CsvPreview, DatasetList, UploadFeedback } from "../../src/components/upload/upload-presentation";
import PageHeader from "../../src/components/layout/page-header";
import { Card } from "../../src/components/ui/primitives";
import { parseCsvText } from "../../src/lib/csv/parser";

const dataset = parseCsvText('id,full_name,department_id,email,notes\n1,Synthetic Student,10,example@example.test,"First line\nSecond line"\n2,Another Student,20,another@example.test,Review', "regional student import with a long dataset name.csv");
type State = "selected" | "empty" | "error" | "loading";

// Presentation/native-control checks only. This fixture does not authenticate,
// invoke workspace state transitions, or replace the genuine-session E2E suite.
async function showUpload(page: Page, state: State) {
  await page.goto("/");
  const shell = await page.evaluate(() => ({
    styles: Array.from(document.head.querySelectorAll('link[rel="stylesheet"], style')).map((node) => node.outerHTML).join(""),
    fontClass: document.documentElement.className,
  }));
  const markup = renderToStaticMarkup(h("main", { style: { padding: 16, maxWidth: 1120, margin: "0 auto" } },
    h(PageHeader, { title: "CSV workspace", description: "Parse and validate in your browser. No original CSV is uploaded to the server." }),
    h("div", { style: { marginBlock: 24 } }, h(FilePicker, { onChoose: () => {}, disabled: state === "loading" })),
    h(UploadFeedback, { busy: state === "loading", error: state === "error" ? "records.csv: duplicate column headers" : "" }),
    h(DatasetList, { datasets: state === "selected" ? [dataset] : [] }),
    state === "selected" && h(Card, { id: `dataset-${encodeURIComponent(dataset.name)}`, tabIndex: -1, "aria-label": `${dataset.filename} configuration`, style: { marginTop: 24 } },
      h("h2", { style: { overflowWrap: "anywhere", marginBottom: 16 } }, dataset.filename), h(CsvPreview, { dataset }))));
  await page.setContent(`<!doctype html><html lang="en" class="${shell.fontClass}"><head>${shell.styles}</head><body>${markup}</body></html>`);
  await page.evaluate(() => document.fonts.ready);
}

for (const width of [320, 375, 390, 768, 1024, 1440]) {
  test(`upload selection and original preview fit ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    await showUpload(page, "selected");
    const picker = page.getByRole("region", { name: "CSV file selection" });
    await expect(picker).toBeVisible();
    const input = page.getByLabel("Upload CSV datasets", { exact: true });
    await input.focus();
    await expect(input).toBeFocused();
    await expect(input).toHaveCSS("outline-style", "solid");
    await expect(input).toHaveAttribute("accept", ".csv,text/csv");
    await expect(input).toHaveAttribute("aria-describedby", "csv-help");
    const button = await input.evaluate((node) => {
      const styles = getComputedStyle(node, "::file-selector-button");
      return { height: parseFloat(styles.height), background: styles.backgroundColor, foreground: styles.color };
    });
    expect(button.height).toBeGreaterThanOrEqual(44);
    expect(button.background).toBe("rgb(81, 69, 205)");
    expect(button.foreground).toBe("rgb(255, 255, 255)");
    const list = page.getByRole("region", { name: "Selected datasets" });
    await expect(list).toContainText("1 dataset parsed");
    await list.getByRole("link").click();
    const configuration = page.getByRole("region", { name: `${dataset.filename} configuration`, exact: true });
    await expect(configuration).toBeFocused();
    const preview = page.getByRole("region", { name: `Preview of ${dataset.filename}` });
    await preview.focus();
    await expect(preview).toBeFocused();
    await expect(preview).toHaveCSS("overflow-x", "auto");
    await expect(preview.getByRole("columnheader", { name: "CSV line" })).toBeVisible();
    await expect(preview.locator("tbody tr")).toHaveCount(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: refinementScreenshot(testInfo, "upload.png"), fullPage: true });
  });
}

for (const state of ["empty", "error", "loading"] as const) {
  test(`upload ${state} feedback remains accessible`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await showUpload(page, state);
    const input = page.getByLabel("Upload CSV datasets", { exact: true });
    if (state === "loading") {
      await expect(input).toBeDisabled();
      await expect(page.getByRole("status")).toHaveText("Reading CSV files...");
      await expect(page.getByRole("region", { name: "CSV file selection" })).toHaveAttribute("aria-busy", "true");
    } else {
      await expect(input).toBeEnabled();
      const feedback = page.getByRole("main").getByRole("alert");
      if (state === "error") await expect(feedback).toContainText("records.csv: duplicate column headers");
      else await expect(feedback).toHaveCount(0);
    }
    await expect(page.getByRole("region", { name: "Selected datasets" })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: refinementScreenshot(testInfo, `upload-${state}.png`), fullPage: true });
  });
}
