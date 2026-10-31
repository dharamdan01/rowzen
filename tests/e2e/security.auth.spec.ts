import { expect, test } from "@playwright/test";
import { validateCsv } from "./helpers";

test.describe("Authenticated authorization and privacy boundaries", () => {
  test("owned project API works, nonexistent projects and reports return 404", async ({ request }) => {
    const owned = await request.get("/api/projects");
    expect(owned.status()).toBe(200);
    const unowned = await request.get("/api/projects/e2e-nonexistent-project/runs");
    expect(unowned.status()).toBe(404);
    const missingReport = await request.get("/api/reports/e2e-nonexistent-report");
    expect(missingReport.status()).toBe(404);
  });

  test("server rejects raw CSV fields before creating any validation run", async ({ request }) => {
    const response = await request.post("/api/projects/e2e-nonexistent-project/runs", {
      data: {
        status: "READY", totalRows: 0, validRows: 0, invalidRows: 0,
        issueCount: 0, rawCsv: "PRIVATE_ROW_VALUE_ALPHA",
      },
    });
    expect(response.status()).toBe(400);
  });

  test("browser sends five summary fields only; mocked POST cannot modify the database", async ({ page }) => {
    let payload: unknown = null;
    // Mock the project list and save endpoint; no test data is persisted.
    await page.route("**/api/projects", async route => {
      if (route.request().method() === "GET") {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
          projects: [{ id: "e2e-synthetic-project", name: "E2E synthetic" }],
        }) });
      } else await route.continue();
    });
    await page.route(/\/api\/projects\/[^/]+\/runs(?:\?.*)?$/, async route => {
      if (route.request().method() === "POST") {
        payload = route.request().postDataJSON();
        await route.fulfill({ status: 201, contentType: "application/json", body: '{"run":{"id":"e2e-mocked"}}' });
      } else await route.continue();
    });

    await validateCsv(page, ["departments.csv", "students.csv"]);
    await page.getByLabel("Save summary to project (optional)").selectOption("e2e-synthetic-project");
    await page.getByRole("button", { name: "Save validation summary" }).click();
    await expect(page.getByText("Summary saved. Raw CSV rows were not sent to the API.")).toBeVisible();
    expect(payload).toEqual({
      status: "BLOCKED", totalRows: 6, validRows: 4, invalidRows: 2, issueCount: 3,
    });
  });
});
