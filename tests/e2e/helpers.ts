import path from "node:path";
import { readFile } from "node:fs/promises";
import { expect, type Locator, type Page } from "@playwright/test";
import { workspaceControl, workspaceStep } from "./helpers/workspace-navigation";

/** Only synthetic fixtures from the project are used. No production CSV is read. */
export function samplePath(filename: string): string {
  return path.resolve(process.cwd(), "samples", filename);
}

export async function openAuthenticatedUpload(page: Page): Promise<void> {
  await page.goto("/upload");
  await expect(page.getByRole("heading", { name: "CSV workspace" })).toBeVisible();
}

export async function validateCsv(page: Page, filenames: readonly string[]): Promise<void> {
  await openAuthenticatedUpload(page);
  await page.locator("#csv-files").setInputFiles(filenames.map(samplePath));
  await workspaceStep(page, "Validate");
  await page.getByRole("button", { name: "Run Validation" }).click();
  await expect(page.getByTestId("report-analytics-dashboard")).toBeVisible();
}

export function metric(page: Page, label: string): Locator {
  return page.locator('section[aria-labelledby="report-summary-title"] dl > div')
    .filter({ has: page.locator("dt", { hasText: new RegExp(`^${label}$`) }) })
    .locator("dd");
}

export async function downloadText(page: Page, buttonName: string): Promise<string> {
  const panel = page.locator('[data-workspace-step]:visible');
  const previous = await panel.count() ? await panel.getAttribute("data-workspace-step") : null;
  const button = await workspaceControl(page, page.getByRole("button", { name: buttonName, exact: true, includeHidden: true }));
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    button.click(),
  ]);
  const filePath = await download.path();
  if (!filePath) throw new Error(`Missing Playwright download path for ${download.suggestedFilename()}`);
  const content = await readFile(filePath, "utf8");
  if (previous) await workspaceStep(page, previous[0].toUpperCase() + previous.slice(1));
  return content;
}

/** A streamed notFound() can keep HTTP 200; verify denial separately from transport status. */
export async function expectReportUnavailable(page: Page, reportId: string): Promise<string> {
  const api = await page.request.get(`/api/reports/${encodeURIComponent(reportId)}`);
  expect(api.status()).toBe(404);
  expect(await api.json()).toEqual({ error: "Resource not found" });

  const response = await page.goto(`/results/${encodeURIComponent(reportId)}`);
  expect([200, 404]).toContain(response?.status());
  await expect(page.getByRole("heading", { name: "Page not found", exact: true })).toBeVisible();
  await expect(page.locator('meta[name="robots"][content*="noindex"]').first()).toBeAttached();
  await expect(page.getByRole("heading", { name: "Saved validation summary", includeHidden: true })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Saved report metadata", includeHidden: true })).toHaveCount(0);
  const html = await response!.text();
  expect(html).not.toContain("Saved report metadata");
  return html;
}
