import { expect, test } from "@playwright/test";
import { metric, validateCsv } from "./helpers";

const files = ["departments.csv", "students.csv"] as const;

async function openEdit(page: import("@playwright/test").Page) {
  await page.getByRole("combobox", { name: "Correction dataset" }).selectOption("students");
  await page.getByRole("button", { name: "Edit students line 4 column department_id" }).click();
  await page.getByRole("textbox", { name: "Proposed value for students line 4 column department_id" }).fill("20");
}

test.describe("Phase 8 S4 deterministic what-if impact (does not apply edits)", () => {
  test("preview shows 3→2 issues while current report and correction history stay unchanged", async ({ page }) => {
    await validateCsv(page, files);
    await openEdit(page);
    await page.getByRole("button", { name: "Preview impact" }).click();
    const preview = page.getByTestId("what-if-preview");
    await expect(preview).toBeVisible();
    const issues = preview.getByRole("row", { name: /Total issues/ });
    await expect(issues.locator("td").nth(0)).toHaveText("3");
    await expect(issues.locator("td").nth(1)).toHaveText("2");
    await expect(metric(page, "Total issues")).toHaveText("3");
    await expect(page.getByText("0 currently changed cells", { exact: false })).toBeVisible();
    await expect(page.getByText("No correction actions recorded for this filter.")).toBeVisible();
    await page.getByRole("button", { name: "Cancel edit" }).click();
    await expect(preview).toHaveCount(0);
    await expect(metric(page, "Total issues")).toHaveText("3");
  });

  test("editing the proposed text invalidates preview; explicit apply then revalidate matches prediction", async ({ page }) => {
    await validateCsv(page, files);
    await openEdit(page);
    await page.getByRole("button", { name: "Preview impact" }).click();
    const preview = page.getByTestId("what-if-preview");
    await expect(preview).toBeVisible();
    const draft = page.getByRole("textbox", { name: "Proposed value for students line 4 column department_id" });
    await draft.fill("999");
    await expect(preview).toHaveCount(0);
    await draft.fill("20");
    await page.getByRole("button", { name: "Preview impact" }).click();
    await expect(preview).toBeVisible();
    await page.getByRole("button", { name: "Apply correction" }).click();
    await expect(preview).toHaveCount(0);
    await expect(page.getByTestId("report-analytics-dashboard")).toBeVisible();
    await expect(page.getByTestId("revalidation-status")).toContainText("after applying a correction");
    await expect(page.getByText("1 currently changed cell", { exact: false })).toBeVisible();
    await expect(metric(page, "Total issues")).toHaveText("2");
  });
});
