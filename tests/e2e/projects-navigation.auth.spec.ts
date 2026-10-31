import { expect, test } from "@playwright/test";

/** Requires a legitimate PLAYWRIGHT_AUTH_STATE. Creates only owned synthetic metadata and cleans it up. */
test("real authorized project list, details and project-scoped report navigation", async ({ page, request }) => {
  const name = "Rowzen navigation verification " + Date.now();
  const created = await request.post("/api/projects", { data: { name, description: "Synthetic metadata for authorized UI verification" } });
  expect(created.status()).toBe(201);
  const { project } = await created.json() as { project: { id: string } };
  try {
    const response = await request.get("/api/projects"); expect(response.status()).toBe(200);
    const list = await response.json() as { projects: { id: string }[] }; expect(list.projects.some(item => item.id === project.id)).toBe(true);
    const owned = await request.get("/api/projects/" + project.id); expect(owned.status()).toBe(200);
    const saved = await request.post("/api/projects/" + project.id + "/runs", { data: { status: "READY", totalRows: 0, validRows: 0, invalidRows: 0, issueCount: 0 } });
    expect(saved.status()).toBe(201); const { run } = await saved.json() as { run: { id: string } };
    await page.goto("/projects");
    await page.getByRole("searchbox", { name: "Search projects", exact: true }).fill(name);
    await page.getByRole("button", { name: "Details for " + name, exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Project details", exact: true });
    await expect(dialog.getByRole("heading", { name, exact: true })).toBeVisible();
    await expect(dialog.getByRole("link", { name: "Saved reports", exact: true })).toHaveAttribute("href", "/results?projectId=" + project.id);
    const summary = dialog.locator('a[href^="/results/' + run.id + '"]'); await expect(summary).toBeVisible();
    await summary.click(); await expect(page).toHaveURL(new RegExp("/results/" + run.id + "\\?returnTo="));
  } finally {
    const removed = await request.delete("/api/projects/" + project.id);
    expect(removed.ok(), "Only the owned synthetic verification project should be deleted").toBe(true);
  }
});
