import { expect, test } from "@playwright/test";

test.describe("Authenticated PostgreSQL summary history", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/results");
    await expect(page.getByRole("heading", { name: "Validation Results" })).toBeVisible();
  });

  test("search uses server URL parameters and displays matching empty state", async ({ page }) => {
    await page.getByLabel("Project name").fill("E2E_PROJECT_NAME_THAT_DOES_NOT_EXIST_2026");
    await page.getByRole("button", { name: "Apply filters" }).click();
    await expect(page).toHaveURL(/q=E2E_PROJECT_NAME_THAT_DOES_NOT_EXIST_2026/);
    await expect(page.getByRole("heading", { name: "No matching validation results" })).toBeVisible();
    await page.getByRole("link", { name: "Clear search and filters" }).click();
    await expect(page).toHaveURL(/\/results$/);
  });

  test("status filter preserves actual database history or correct empty state", async ({ page }) => {
    await page.getByLabel("Readiness status").selectOption("CONFIG_ERROR");
    await page.getByRole("button", { name: "Apply filters" }).click();
    await expect(page).toHaveURL(/status=CONFIG_ERROR/);
    const rows = page.getByRole('region', { name: 'Saved validation reports' }).locator('tbody tr');
    const count = await rows.count();
    if (count > 0) {
      for (let i = 0; i < count; i++) {
        await expect(rows.nth(i)).toContainText("CONFIG ERROR");
        await expect(rows.nth(i)).toContainText("Not evaluated");
      }
    } else {
      await expect(page.getByRole("heading", { name: "No matching validation results" })).toBeVisible();
    }
  });

  test("sort order and page size are preserved as server parameters", async ({ page }) => {
    await page.getByLabel("Sort by date").selectOption("oldest");
    await page.getByLabel("Rows per page").selectOption("25");
    await page.getByRole("button", { name: "Apply filters" }).click();
    await expect(page).toHaveURL(/order=oldest/);
    await expect(page).toHaveURL(/pageSize=25/);
    await expect(page.getByLabel("Sort by date")).toHaveValue("oldest");
  });

  test("mobile history remains accessible and responsive", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByLabel("Project name")).toBeVisible();
    await expect(page.getByLabel("Readiness status")).toBeVisible();
    await page.getByLabel("Readiness status").focus();
    await expect(page.getByLabel("Readiness status")).toBeFocused();
  });
});
