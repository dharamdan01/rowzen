import { expect, test } from "@playwright/test";
import { samplePath } from "./helpers";

async function createProject(page: import("@playwright/test").Page) {
  const response = await page.request.post("/api/projects", {
    data: { name: `Template E2E ${Date.now()} ${Math.floor(Math.random() * 100000)}` },
  });
  expect(response.status()).toBe(201);
  const json = await response.json() as { project: { id: string } };
  return json.project.id;
}

test.describe("Phase 8 S7 authenticated mapping template workflows", () => {
  test("saves and restores mapping rules without changing CSV or correction state", async ({ page }) => {
    const projectId = await createProject(page);
    try {
      await page.goto("/upload");
      await page.locator("#csv-files").setInputFiles([samplePath("students.csv"), samplePath("departments.csv")]);
      await page.getByRole("combobox", { name: "Template project" }).selectOption(projectId);
      await page.getByRole("textbox", { name: "New template name" }).fill("Student mapping E2E");
     
      const saveResponsePromise = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname ===
            `/api/projects/${projectId}/templates` &&
          response.request().method() === "POST"
      );
      await page
        .getByRole("button", { name: "Save mapping template" })
        .click();

      const saveResponse = await saveResponsePromise;
      const responseBody = await saveResponse.text();

      const templateStatus = page.locator(
        '[aria-label="Mapping and validation templates"] [role="status"]'
      );

      const statusMessages = await templateStatus.allTextContents();

      expect(
        saveResponse.status(),
        `Template POST failed. HTTP ${saveResponse.status()}. Response: ${responseBody}. UI: ${statusMessages.join(" | ")}`
      ).toBe(201);

      await expect(templateStatus).toContainText(
        "Template saved. No CSV rows or correction history were sent."
      );

      const required = page.getByRole("textbox", { name: "Required target columns (comma-separated) for students" });
      await required.fill("id");
      await expect(required).toHaveValue("id");
      await page.getByRole("combobox", { name: "Saved mapping template" }).selectOption({ label: "Student mapping E2E" });
      page.once("dialog", (dialog) => void dialog.accept());
      await page.getByRole("button", { name: "Load mapping template" }).click();
      await expect(required).toHaveValue("name, department_id");
      await page.getByRole("button", { name: "Run Validation" }).click();
      await expect(page.getByTestId("report-analytics-dashboard")).toBeVisible();
    } finally {
      const deleted = await page.request.delete(`/api/projects/${projectId}`);
      expect(deleted.ok()).toBe(true);
    }
  });

  test("prevents foreign project template access and rejects raw dataset rows", async ({ page }) => {
    const projectId = await createProject(page);
    try {
      const other = "not-an-owned-project";
      const list = await page.request.get(`/api/projects/${other}/templates`);
      expect(list.status()).toBe(404);
      const foreign = await page.request.delete(`/api/projects/${other}/templates/not-real`);
      expect(foreign.status()).toBe(404);
      const posted = await page.request.post(`/api/projects/${projectId}/templates`, {
        data: { name: "Rejected raw data", configuration: { version: 1, datasets: [{ name: "students", headers: ["id"], rows: [{ id: "private" }] }], mappings: { students: [{ source: "id", target: "id" }] }, rules: { students: { primaryKey: "id", required: [], types: {} } }, relationships: [], compositeRelationships: [], primaryOverrides: {}, uniqueSpecs: {} } },
      });
      expect(posted.status()).toBe(400);
    } finally {
      const deleted = await page.request.delete(`/api/projects/${projectId}`);
      expect(deleted.ok()).toBe(true);
    }
  });
});
