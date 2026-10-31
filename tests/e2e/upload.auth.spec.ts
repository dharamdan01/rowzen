import { expect, test } from "@playwright/test";
import { downloadText, metric, openAuthenticatedUpload, samplePath, validateCsv } from "./helpers";

const fixtureFiles = ["departments.csv", "students.csv"] as const;

test.describe("Real Phase 6 + Phase 7 browser integration", () => {
  test("analytics show real 6/4/2 rows and three error issues", async ({ page }) => {
    await validateCsv(page, fixtureFiles);
    await expect(page.getByRole("heading", { name: "Migration readiness: BLOCKED" })).toBeVisible();
    await expect(metric(page, "Datasets")).toHaveText("2");
    await expect(metric(page, "Total records")).toHaveText("6");
    await expect(metric(page, "Valid rows")).toHaveText("4");
    await expect(metric(page, "Invalid rows")).toHaveText("2");
    await expect(metric(page, "Blocking errors")).toHaveText("3");
    await expect(metric(page, "Warnings")).toHaveText("0");
    await expect(metric(page, "Total issues")).toHaveText("3");
  });

  test("issue explorer applies a code filter and resets it", async ({ page }) => {
    await validateCsv(page, fixtureFiles);
    await page
  .getByRole("combobox", { name: /^Error code\b/i })
  .selectOption("FK_NOT_FOUND");
    await expect(page.getByText(/Showing 1–1 of 1 matching issues/)).toBeVisible();
    await page.getByRole("button", { name: "Reset filters" }).click();
    await expect(page.getByText(/Showing 1–3 of 3 matching issues/)).toBeVisible();
  });

  test("dependency view preserves parent-first order", async ({ page }) => {
    await validateCsv(page, fixtureFiles);
    const order = page.getByRole("list", { name: "Parent-first dataset order" });
    await expect(order.locator("li").nth(0)).toContainText("departments");
    await expect(order.locator("li").nth(1)).toContainText("students");
    await expect(page.getByTestId("readiness-insights")).toBeVisible();
  });

  test("CONFIG_ERROR does not fabricate valid or invalid counts", async ({ page }) => {
    await validateCsv(page, fixtureFiles);
    await page.getByLabel("Parent column for relationship 1").fill("does_not_exist");
    // Changing configuration invalidates old results before the next run.
    await expect(page.getByTestId("report-analytics-dashboard")).toHaveCount(0);
    await page.getByRole("button", { name: "Run Validation" }).click();
    await expect(page.getByRole("heading", { name: "Migration readiness: CONFIG ERROR" })).toBeVisible();
    await expect(metric(page, "Valid rows")).toHaveText("Not evaluated");
    await expect(metric(page, "Invalid rows")).toHaveText("Not evaluated");
    await expect(page.locator('section[aria-labelledby="dependency-heading"]')).toContainText("Import order unavailable");
  });

  test("three privacy-safe exports remain local and omit raw CSV cell values", async ({ page }) => {
    await validateCsv(page, fixtureFiles);
    const posts: string[] = [];
    page.on("request", (request) => {
      if (request.method() === "POST") posts.push(request.url());
    });
    const exports = [
      "Download privacy-safe JSON", "Download issues CSV", "Download dataset CSV",
    ];
    for (const name of exports) {
      const content = await downloadText(page, name);
      expect(content.length).toBeGreaterThan(20);
      for (const privateValue of ["Ali", "Sara", "Ahmed", "Bilal", "Software Engineering", "Computer Science"]) {
        expect(content).not.toContain(privateValue);
      }
    }
    expect(posts).toEqual([]);
  });

  test("privacy-safe JSON content is deterministic across repeated downloads", async ({ page }) => {
    await validateCsv(page, fixtureFiles);
    const first = await downloadText(page, "Download privacy-safe JSON");
    const second = await downloadText(page, "Download privacy-safe JSON");
    expect(second).toBe(first);
    const parsed: unknown = JSON.parse(first);
    expect(parsed).toBeTruthy();
  });


test("pagination navigates issue pages without changing issue counts", async ({ page }) => {
  await validateCsv(page, ["phase7-pagination.csv"]);
  await expect(metric(page, "Total issues")).toHaveText("12");
  await expect(
    page.getByText("Page 1 of 2", { exact: true })
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Next", exact: true })
    .click();
  await expect(
    page.getByText("Page 2 of 2", { exact: true })
  ).toBeVisible();
  await expect(metric(page, "Total issues")).toHaveText("12");
});


  test("mobile width keeps upload controls and reports usable", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await validateCsv(page, fixtureFiles);
    await expect(page.getByRole("button", { name: "Download issues CSV" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Issue explorer" })).toBeVisible();
    await expect(metric(page, "Total records")).toHaveText("6");
  });

  test("dangerous CSV column labels are quoted/escaped in spreadsheet export", async ({ page }) => {
    await openAuthenticatedUpload(page);
    await page.locator("#csv-files").setInputFiles([samplePath("=FORMULA.csv")]);
    await page.getByLabel("Required =formula.=1+1").check();
    await page.getByRole("button", { name: "Run Validation" }).click();
    await expect(page.getByTestId("report-analytics-dashboard")).toBeVisible();
    const text = await downloadText(page, "Download issues CSV");
    expect(text).toContain("'=1+1");
    expect(text).not.toContain("PRIVATE_ROW_VALUE_ALPHA");
  });
});
