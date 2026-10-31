import { expect, test } from "@playwright/test";

/** These tests run in the PUBLIC Playwright project without a storage state. */
test.describe("Phase 8 final release — anonymous security boundaries", () => {
  test("private project, report, template and validation APIs require a session", async ({ request }) => {
    const checks = [
      request.get("/api/projects"),
      request.get("/api/projects/not-owned"),
      request.get("/api/reports/not-owned"),
      request.get("/api/projects/not-owned/templates"),
      request.post("/api/projects/not-owned/runs", {
        data: { status: "READY", totalRows: 0, validRows: 0, invalidRows: 0, issueCount: 0 },
      }),
      request.delete("/api/projects/not-owned/templates/not-owned"),
    ];
    const responses = await Promise.all(checks);
    for (const response of responses) {
      expect(response.status(), `Request to ${response.url()}`).toBe(401);
      const payload = await response.text();
      expect(payload).not.toContain("rawCsv");
      expect(payload).not.toContain("correctionHistory");
    }
  });

  test("private pages redirect anonymous users to login", async ({ page }) => {
    for (const route of ["/upload", "/projects", "/results", "/results/not-owned"]) {
      await page.goto(route);
      await expect(page).toHaveURL(/\/login(?:\?|$)/);
    }
  });

  test("security headers are applied to HTTP responses", async ({ request }) => {
    const response = await request.get("/login");
    expect(response.ok()).toBe(true);
    expect(response.headers()["x-content-type-options"]).toBe("nosniff");
    expect(response.headers()["x-frame-options"]).toBe("DENY");
    expect(response.headers()["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(response.headers()["permissions-policy"]).toContain("camera=()");
  });
});
