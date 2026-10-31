import { expect, test } from "@playwright/test";
import { themeFixture } from "./helpers/theme-fixture";

// Hydrated real presentation components with synthetic metadata, never an auth bypass.
for (const width of [320, 375, 390, 768, 1024, 1440]) {
  test(`application shell remains usable at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await themeFixture(page, "summary", "light");
    const breadcrumbs = page.getByRole("navigation", { name: "Breadcrumb", exact: true }).filter({ visible: true });
    await expect(breadcrumbs.getByRole("link", { name: "Results", exact: true })).toHaveAttribute("href", "/results");
    await expect(breadcrumbs.locator('[aria-current="page"]')).toHaveText("Saved summary");
    if (width < 1024) {
      await expect(page.getByRole("navigation", { name: "Dashboard navigation", exact: true })).toBeHidden();
      const menu = page.getByRole("button", { name: "Navigation", exact: true });
      await expect(page.getByRole("navigation", { name: "Mobile dashboard navigation" })).toBeHidden();
      await menu.focus();
      await page.keyboard.press("Enter");
      const mobile = page.getByRole("navigation", { name: "Mobile dashboard navigation" });
      await expect(mobile).toBeVisible();
      await expect(mobile.getByRole("link")).toHaveCount(4);
      await expect(mobile.getByRole("link", { name: "Results", exact: true })).toHaveAttribute("aria-current", "page");
      await expect(page.getByRole("button", { name: "Close navigation", exact: true })).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(mobile.getByRole("link", { name: "Dashboard", exact: true })).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(mobile).toBeHidden();
      await expect(menu).toBeFocused();
    } else {
      const sidebar = page.getByRole("navigation", { name: "Dashboard navigation", exact: true });
      await expect(sidebar).toBeVisible();
      await expect(sidebar.getByRole("link")).toHaveCount(4);
      await expect(sidebar.getByRole("link", { name: "Results", exact: true })).toHaveAttribute("aria-current", "page");
      await expect(page.getByRole("button", { name: "Navigation", exact: true })).toBeHidden();
    }
    await page.getByRole("link", { name: "Skip to content" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("#dashboard-content")).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("shell.png"), fullPage: true });
  });
}
