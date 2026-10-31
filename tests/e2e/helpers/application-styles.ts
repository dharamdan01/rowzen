import { expect, type Page } from "@playwright/test";

/** Isolated component fixtures need the real app CSS, not idle background traffic. */
export async function applicationStyles(page: Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Catch data issues before import.", exact: true })).toBeVisible();
  // ThemeSelector enables itself after hydration; replacing the DOM before then
  // lets the landing React root overwrite the isolated fixture during recovery.
  await expect(page.getByRole("combobox", { name: "Color theme", exact: true })).toBeEnabled();
  await expect.poll(() => page.evaluate(() => {
    const links = [...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')];
    return links.length > 0 && links.every(link => link.sheet !== null);
  })).toBe(true);
  return page.evaluate(() => ({
    styles: [...document.head.querySelectorAll('link[rel="stylesheet"],style')].map(node => node.outerHTML).join(""),
    font: document.documentElement.className,
  }));
}
