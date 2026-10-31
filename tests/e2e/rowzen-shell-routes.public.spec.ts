import { expect, test } from "@playwright/test";
import { themeFixture } from "./helpers/theme-fixture";

test("mobile drawer follows real protected destinations and closes without leaking a scroll lock", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 1000 });
  for (const destination of ["Dashboard", "Projects", "CSV Workspace", "Results"]) {
    // Synthetic shell only; the destination is handled by the actual server's anonymous guard.
    await themeFixture(page, "dashboard", "light");
    await page.getByRole("button", { name: "Navigation", exact: true }).click();
    await page.getByRole("dialog", { name: "Workspace navigation", exact: true }).getByRole("link", { name: destination, exact: true }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "Sign in to Rowzen", exact: true })).toBeVisible();
    await expect(page.getByRole("dialog", { name: "Workspace navigation", exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => document.body.style.overflow)).toBe("");
  }
});
