import { expect, test } from "@playwright/test";
import { metric, validateCsv } from "./helpers";
const files = ["departments.csv", "students.csv"] as const;
async function fix(page: import("@playwright/test").Page, row: number, column: string, value: string) {
  await page.getByRole("combobox", { name: "Correction dataset" }).selectOption("students");
  await page.getByRole("button", { name: `Edit students line ${row} column ${column}` }).click();
  await page.getByRole("textbox", { name: `Proposed value for students line ${row} column ${column}` }).fill(value);
  await page.getByRole("button", { name: "Apply correction" }).click();
}
test.describe("Phase 8 S5 approved automatic validation (browser memory)", () => {
  test("apply -> undo -> redo immediately refreshes issues without Run Validation", async ({ page }) => {
    await validateCsv(page, files);
    const reportPosts: string[] = [];
    page.on("request", (request) => {
      if (request.method() === "POST" && /\/api\/projects\/[^/]+\/runs/.test(request.url())) reportPosts.push(request.url());
    });
    await fix(page, 4, "department_id", "20");
    await expect(metric(page, "Total issues")).toHaveText("2");
    await expect(page.getByTestId("revalidation-status")).toContainText("after applying a correction");
    await page.getByRole("button", { name: "Undo correction" }).click();
    await expect(metric(page, "Total issues")).toHaveText("3");
    await page.getByRole("button", { name: "Redo correction" }).click();
    await expect(metric(page, "Total issues")).toHaveText("2");
    expect(reportPosts).toEqual([]); // No automatic raw CSV/report API POST.
  });
  test("second approved correction reaches READY automatically; restore returns BLOCKED", async ({ page }) => {
    await validateCsv(page, files);
    await fix(page, 4, "department_id", "20");
    await fix(page, 5, "id", "4");
    await expect(metric(page, "Total issues")).toHaveText("0");
    await expect(page.getByRole("heading", { name: "Migration readiness: READY" })).toBeVisible();
    page.once("dialog", async (dialog) => { await dialog.accept(); });
    await page.getByRole("button", { name: "Discard corrections" }).click();
    await expect(page.getByTestId("revalidation-status")).toContainText("restoring original values");
    await expect(metric(page, "Total issues")).toHaveText("3");
    await expect(page.getByText("0 currently changed cells", { exact: false })).toBeVisible();
  });
  test("configuration errors preserve Not evaluated counts after automatic validation", async ({ page }) => {
    await validateCsv(page, files);
    await page.getByLabel("Parent column for relationship 1").fill("missing_column");
    await fix(page, 4, "department_id", "20");
    await expect(metric(page, "Valid rows")).toHaveText("Not evaluated");
    await expect(metric(page, "Invalid rows")).toHaveText("Not evaluated");
    await expect(page.getByTestId("revalidation-status")).toContainText("CONFIG ERROR");
  });
});
