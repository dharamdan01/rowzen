import { expect, test, request as apiRequest } from "@playwright/test";
import { expectReportUnavailable } from "./helpers";

const secondState = process.env.PLAYWRIGHT_SECONDARY_AUTH_STATE?.trim();

/** Real, independent account required. Never bypass Better Auth or fabricate a session. */
test.describe("Phase 8 final release — real two-account ownership", () => {
  test.skip(!secondState, "Needs PLAYWRIGHT_SECONDARY_AUTH_STATE from a different account");

  test("another authenticated account cannot read, change, delete or list account A's resources", async ({ page, browser }) => {
    const owner = page.request;
    const projectName = `Release isolation ${Date.now()}`;
    const projectResponse = await owner.post("/api/projects", {
      data: { name: projectName },
    });
    expect(projectResponse.status()).toBe(201);
    const projectId = ((await projectResponse.json()) as { project: { id: string } }).project.id;
    try {
      const summaryResponse = await owner.post(`/api/projects/${projectId}/runs`, {
        data: { status: "READY", totalRows: 0, validRows: 0, invalidRows: 0, issueCount: 0 },
      });
      expect(summaryResponse.status()).toBe(201);
      const payload = (await summaryResponse.json()) as { run: { id: string } };
      const reportId = payload.run.id;
      const ownedReport = await owner.get(`/api/reports/${reportId}`);
      expect(ownedReport.status()).toBe(200);
      expect((await ownedReport.json()).report.id).toBe(reportId);
      await page.goto(`/results/${reportId}`);
      await expect(page.getByRole("heading", { name: "Saved validation summary" })).toBeVisible();
      await expect(page.getByText(`Project: ${projectName}`, { exact: true })).toBeVisible();
      const other = await apiRequest.newContext({
        baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000",
        storageState: secondState!,
      });
      try {
        const list = await other.get("/api/projects");
        expect(list.status()).toBe(200);
        const visible = (await list.json()) as { projects: { id: string }[] };
        expect(visible.projects.some((project) => project.id === projectId), "Second account must be distinct").toBe(false);
        for (const response of [
          await other.get(`/api/projects/${projectId}`),
          await other.get(`/api/projects/${projectId}/templates`),
          await other.get(`/api/projects/${projectId}/runs`),
          await other.get(`/api/reports/${reportId}`),
          await other.patch(`/api/projects/${projectId}`, { data: { name: "Should not update" } }),
          await other.delete(`/api/projects/${projectId}/templates/not-owned`),
          await other.delete(`/api/projects/${projectId}`),
        ]) {
          expect(response.status(), `Request to ${response.url()}`).toBe(404);
        }
        const otherBrowser = await browser.newContext({
          baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000",
          storageState: secondState!,
        });
        try {
          const otherPage = await otherBrowser.newPage();
          const html = await expectReportUnavailable(otherPage, reportId);
          expect(html).not.toContain(projectName);
          await expect(otherPage.getByText(`Project: ${projectName}`, { exact: true })).toHaveCount(0);
        } finally { await otherBrowser.close(); }
      } finally { await other.dispose(); }
    } finally {
      const removed = await owner.delete(`/api/projects/${projectId}`);
      expect(removed.ok(), "Owner should retain deletion permission").toBe(true);
    }
  });
});
