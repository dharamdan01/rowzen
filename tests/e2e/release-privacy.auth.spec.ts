import { expect, test } from "@playwright/test";
import { metric, samplePath, validateCsv } from "./helpers";

test.describe("Phase 8 final release — privacy and keyboard usability", () => {
  test("keyboard activates inline editor; cancelled draft does not change verified results", async ({ page }) => {
    await validateCsv(page, ["departments.csv", "students.csv"]);
    await page.getByRole("combobox", { name: "Correction dataset" }).selectOption("students");
    const edit = page.getByRole("button", { name: "Edit students line 4 column department_id" });
    await edit.focus();
    await expect(edit).toBeFocused();
    await page.keyboard.press("Enter");
    const draft = page.getByRole("textbox", { name: "Proposed value for students line 4 column department_id" });
    await expect(draft).toBeVisible();
    await draft.fill("20");
    await expect(metric(page, "Total issues")).toHaveText("3");
    await page.getByRole("button", { name: "Cancel edit" }).click();
    await expect(page.getByText("0 currently changed cells", { exact: false })).toBeVisible();
    await expect(metric(page, "Total issues")).toHaveText("3");
    await expect(page.getByRole("heading", { name: "Correction activity history" })).toBeVisible();
  });

  test("preview, approved corrections and corrected CSV download do not POST raw records", async ({ page }) => {
    const writes: string[] = [];
    page.on("request", (request) => {
      const path = new URL(request.url()).pathname;
      if (request.method() === "POST" && /^\/api\/projects\/[^/]+\/(runs|templates)(\/|$)/.test(path)) {
        writes.push(path);
      }
    });
    await validateCsv(page, ["departments.csv", "students.csv"]);
    await page.getByRole("combobox", { name: "Correction dataset" }).selectOption("students");
    await page.getByRole("button", { name: "Edit students line 4 column department_id" }).click();
    await page.getByRole("textbox", { name: "Proposed value for students line 4 column department_id" }).fill("20");
    await page.getByRole("button", { name: "Preview impact" }).click();
    await page.getByRole("button", { name: "Apply correction" }).click();
    await expect(metric(page, "Total issues")).toHaveText("2");
    await page.getByRole("combobox", { name: "Corrected CSV dataset" }).selectOption("students");
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Download corrected CSV" }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.csv$/i);
    expect(writes, "Only explicit Save Summary/Template actions may POST").toEqual([]);
    await expect(page.getByText("Approved corrections can be downloaded", { exact: false })).toBeVisible();
  });
});
