import { expect, test } from "@playwright/test";
import { metric, samplePath, validateCsv } from "./helpers";

const datasets = ["departments.csv", "students.csv"] as const;

test.describe("Phase 8 correction workspace — user approved edits only", () => {
  test("draft/cancel never modifies CSV or the previously verified report", async ({ page }) => {
    await validateCsv(page, datasets);
    await page.getByRole("combobox", { name: "Correction dataset" }).selectOption("students");
    await page.getByRole("button", { name: "Edit students line 4 column department_id" }).click();
    const draft = page.getByRole("textbox", { name: "Proposed value for students line 4 column department_id" });
    await expect(draft).toHaveValue("99");
    await draft.fill("20");
    await expect(metric(page, "Blocking errors")).toHaveText("3");
    await page.getByRole("button", { name: "Cancel edit" }).click();
    await expect(page.getByText("0 currently changed cells")).toBeVisible();
    await expect(metric(page, "Blocking errors")).toHaveText("3");
  });

  test("approved edits automatically revalidate; undo and redo produce real results", async ({ page }) => {
    await validateCsv(page, datasets);
    await page.getByRole("combobox", { name: "Correction dataset" }).selectOption("students");
    await page.getByRole("button", { name: "Edit students line 4 column department_id" }).click();
    await page.getByRole("textbox", { name: "Proposed value for students line 4 column department_id" }).fill("20");
    await page.getByRole("button", { name: "Apply correction" }).click();
    await expect(page.getByTestId("report-analytics-dashboard")).toBeVisible();
    await expect(page.getByTestId("revalidation-status")).toContainText("after applying a correction");
    await expect(metric(page, "Total issues")).toHaveText("2");
    await expect(page.getByText("1 currently changed cell", { exact: false })).toBeVisible();
    await page.getByRole("button", { name: "Undo correction" }).click();
    await expect(page.getByTestId("revalidation-status")).toContainText("after undo");
    await expect(metric(page, "Total issues")).toHaveText("3");
    await page.getByRole("button", { name: "Redo correction" }).click();
    await expect(page.getByTestId("revalidation-status")).toContainText("after redo");
    await expect(metric(page, "Total issues")).toHaveText("2");
  });

  test("refuses to replace corrected files without explicit confirmation", async ({ page }) => {
    await validateCsv(page, datasets);
    await page.getByRole("combobox", { name: "Correction dataset" }).selectOption("students");
    await page.getByRole("button", { name: "Edit students line 4 column department_id" }).click();
    await page.getByRole("textbox", { name: "Proposed value for students line 4 column department_id" }).fill("20");
    await page.getByRole("button", { name: "Apply correction" }).click();
    page.once("dialog", async (dialog) => {
      expect(dialog.message()).toContain("discard local corrections");
      await dialog.dismiss();
    });
    await page.locator("#csv-files").setInputFiles([samplePath("phase7-pagination.csv")]);
    await expect(page.getByText("1 currently changed cell", { exact: false })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Correction dataset" })).toHaveValue("students");
  });
});
