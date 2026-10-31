import { expect, test } from "@playwright/test";
import { metric, validateCsv } from "./helpers";

const files = ["departments.csv", "students.csv"] as const;

async function editDepartment(page: import("@playwright/test").Page) {
  await page.getByRole("combobox", { name: "Correction dataset" }).selectOption("students");
  await page.getByRole("button", { name: "Edit students line 4 column department_id" }).click();
  await page.getByRole("textbox", { name: "Proposed value for students line 4 column department_id" }).fill("20");
  await page.getByRole("button", { name: "Apply correction" }).click();
}

test.describe("Phase 8 S3 local correction activity and restore original", () => {
  test("records only real Apply/Undo/Redo with affected CSV line and device time", async ({ page }) => {
    await validateCsv(page, files);
    const timeline = page.getByRole("list", { name: "Correction activity timeline" });
    await expect(page.getByText("No correction actions recorded for this filter.")).toBeVisible();
    await editDepartment(page);
    await expect(timeline.getByRole("listitem")).toHaveCount(1);
    await expect(timeline).toContainText("CSV line 4 · column department_id");
    await expect(timeline).toContainText("Applied");
    await expect(timeline.locator("time[datetime]")).toHaveCount(1);
    await page.getByRole("button", { name: "Undo correction" }).click();
    await expect(timeline.getByRole("listitem")).toHaveCount(2);
    await expect(timeline.getByRole("listitem").first()).toContainText("Undone");
    await page.getByRole("button", { name: "Redo correction" }).click();
    await expect(timeline.getByRole("listitem")).toHaveCount(3);
    await expect(timeline.getByRole("listitem").first()).toContainText("Redone");
  });

  test("restore original requires confirmation, clears values and private history", async ({ page }) => {
    await validateCsv(page, files);
    await editDepartment(page);
    await expect(page.getByText("1 currently changed cell", { exact: false })).toBeVisible();
    page.once("dialog", async (dialog) => { expect(dialog.type()).toBe("confirm"); await dialog.dismiss(); });
    await page.getByRole("button", { name: "Discard corrections" }).click();
    await expect(page.getByText("1 currently changed cell", { exact: false })).toBeVisible();
    page.once("dialog", async (dialog) => { expect(dialog.type()).toBe("confirm"); await dialog.accept(); });
    await page.getByRole("button", { name: "Discard corrections" }).click();
    await expect(page.getByText("0 currently changed cells", { exact: false })).toBeVisible();
    await expect(page.getByText("No correction actions recorded for this filter.")).toBeVisible();
    await page.getByRole("button", { name: "Run Validation" }).click();
    await expect(page.getByTestId("report-analytics-dashboard")).toBeVisible();
    await expect(metric(page, "Blocking errors")).toHaveText("3");
  });
});
