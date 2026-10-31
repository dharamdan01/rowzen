import { expect, test } from "@playwright/test";

test.describe("Public surface and access control", () => {
  test("unauthenticated /upload redirects to login", async ({ page }) => {
    await page.goto("/upload");
    await expect(page).toHaveURL(/\/login(?:\?|$)/);
  });

  test("unauthenticated /results redirects to login", async ({ page }) => {
    await page.goto("/results");
    await expect(page).toHaveURL(/\/login(?:\?|$)/);
  });

  test("unauthenticated /dashboard redirects to login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login(?:\?|$)/);
  });

  test("projects listing cannot be accessed anonymously", async ({ request }) => {
    const response = await request.get("/api/projects");
    expect(response.status()).toBe(401);
  });

  test("validation history cannot be read anonymously", async ({ request }) => {
    const response = await request.get("/api/projects/e2e-unowned-project/runs");
    expect(response.status()).toBe(401);
  });

  test("report detail cannot be accessed anonymously", async ({ request }) => {
    const response = await request.get("/api/reports/e2e-nonexistent-report");
    expect(response.status()).toBe(401);
  });

  test("an anonymous client cannot write a validation summary", async ({ request }) => {
    const response = await request.post("/api/projects/e2e-unowned-project/runs", {
      data: { status: "READY", totalRows: 0, validRows: 0, invalidRows: 0, issueCount: 0 },
    });
    expect(response.status()).toBe(401);
  });
});
