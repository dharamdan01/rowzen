import { expect, test } from "@playwright/test";

test("mobile shell closes on Escape and route selection with a real session", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard$/);
  const summary = page.getByRole("button", { name: "Navigation", exact: true });
  const navigation = page.getByRole("navigation", { name: "Mobile dashboard navigation" });
  await summary.focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  await expect(navigation.getByRole("link", { name: "Dashboard", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(navigation).toBeHidden();
  await expect(summary).toBeFocused();
  await page.keyboard.press("Enter");
  await navigation.getByRole("link", { name: "Projects", exact: true }).click();
  await expect(page).toHaveURL(/\/projects$/);
  await expect(navigation).toBeHidden();
  await page.getByRole("button", { name: "Account", exact: true }).click();
  await expect(page.getByRole("button", { name: "Sign Out", exact: true })).toBeVisible();
});
