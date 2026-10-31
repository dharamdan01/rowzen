import { expect, test } from "@playwright/test";
import { samplePath, metric, expectReportUnavailable } from "./helpers";

async function createProject(page: import("@playwright/test").Page) {
  const response = await page.request.post("/api/projects", {
    data: { name: `S8 report workflow ${Date.now()} ${Math.floor(Math.random() * 100000)}` },
  });
  expect(response.status()).toBe(201);
  return (await response.json() as { project: { id: string } }).project.id;
}

test.describe("Phase 8 S8 correction-report-project workflow", () => {
  test("approved correction updates comparison and explicit summary save opens owned detail", async ({ page }) => {
    const projectId = await createProject(page);
    try {
      await page.goto(`/upload?projectId=${encodeURIComponent(projectId)}`);
      await expect(page.getByRole("combobox", { name: "Template project" })).toHaveValue(projectId);
      await page.locator("#csv-files").setInputFiles([samplePath("students.csv"), samplePath("departments.csv")]);
      await page.getByRole("button", { name: "Run Validation" }).click();
      await page.getByRole("combobox", { name: "Correction dataset" }).selectOption("students");
      await page.getByRole("button", { name: "Edit students line 4 column department_id" }).click();
      await page.getByRole("textbox", { name: "Proposed value for students line 4 column department_id" }).fill("20");
      await page.getByRole("button", { name: "Apply correction" }).click();
      await expect(metric(page, "Total issues")).toHaveText("2");
      await expect(page.getByRole("region", { name: "Original and corrected summary" })).toContainText("BLOCKED");
      await expect(page.getByRole("region", { name: "Original and corrected summary" })).toContainText("2");
      await expect(page.locator("#save-project")).toHaveValue(projectId);
      const savePost = page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname === `/api/projects/${projectId}/runs`);
      await page.getByRole("button", { name: "Save validation summary" }).click();
      const response = await savePost;
      expect(response.status()).toBe(201);
      const payload = response.request().postDataJSON() as Record<string, unknown>;
      expect(Object.keys(payload).sort()).toEqual(["invalidRows", "issueCount", "status", "totalRows", "validRows"]);
      await page.getByRole("link", { name: "View saved summary" }).click();
      await expect(page.getByRole("heading", { name: "Saved validation summary" })).toBeVisible();
      await expect(page.getByRole("region", { name: "Saved report metadata" })).toContainText("Total issues");
      await expect(page.getByRole("region", { name: "Saved report metadata" })).toContainText("2");
      await page.getByRole("link", { name: "Open project in upload workspace" }).click();
      await expect(page.getByRole("combobox", { name: "Template project" })).toHaveValue(projectId);
    } finally {
      const deleted = await page.request.delete(`/api/projects/${projectId}`);
      expect(deleted.ok()).toBe(true);
    }
  });
  test("non-owned report detail does not leak a summary", async ({ page }) => {
    await expectReportUnavailable(page, "not-an-owned-validation-run");
  });
  test("forged project query does not select an unowned project", async ({ page }) => {
    await page.goto("/upload?projectId=not-an-owned-project");
    await expect(page.getByRole("combobox", { name: "Template project" })).toHaveValue("");
  });
});
