import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const folder = resolve("playwright/.cache/phase9-theme");
function shot(name: string) { mkdirSync(folder, { recursive: true }); return resolve(folder, name); }
test("theme selection waits for hydration and persists before immediate navigation", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("datarehearsal-theme", "dark"));
  let release!: () => void;
  const scriptsReady = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/_next/static/**/*.js*", async route => {
    await scriptsReady;
    await route.continue();
  });
  try {
    await page.goto("/login", { waitUntil: "commit" });
    const selector = page.getByRole("combobox", { name: "Color theme", exact: true });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(selector).toBeVisible();
    await expect(selector).toBeDisabled();
    await selector.focus();
    await expect(selector).not.toBeFocused();
    release();
    await expect(selector).toBeEnabled();
    await selector.focus();
    await expect(selector).toBeFocused();
    await selector.selectOption("light");
    await expect(selector).toBeFocused();
    await expect(page.locator("html")).toHaveAttribute("data-theme-preference", "light");
    expect(await page.evaluate(() => localStorage.getItem("datarehearsal-theme"))).toBe("light");
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  } finally {
    release();
  }
});

test("theme preference persists, tracks System changes and initializes before body", async ({ page }) => {
  const hydration: string[] = [];
  page.on("console", message => { if (message.type() === "error" && /hydrat|did not match/i.test(message.text())) hydration.push(message.text()); });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.addInitScript(() => {
    const observer = new MutationObserver(() => {
      if (document.body) { Object.assign(window, { initialBodyTheme: document.documentElement.dataset.theme }); observer.disconnect(); }
    });
    observer.observe(document, { childList: true, subtree: true });
  });
  await page.goto("/login");
  const theme = page.getByRole("combobox", { name: "Color theme", exact: true });
  await expect(theme).toHaveValue("system"); await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(await page.evaluate(() => (window as unknown as { initialBodyTheme: string }).initialBodyTheme)).toBe("dark");
  await theme.selectOption("light"); await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload(); await expect(theme).toHaveValue("light");
  expect(await page.evaluate(() => (window as unknown as { initialBodyTheme: string }).initialBodyTheme)).toBe("light");
  expect(await page.evaluate(() => localStorage.getItem("datarehearsal-theme"))).toBe("light");
  await theme.focus(); await theme.press("End"); await theme.press("Enter");
  await expect(theme).toHaveValue("system"); await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.emulateMedia({ colorScheme: "light" }); await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await theme.selectOption("dark"); await page.emulateMedia({ colorScheme: "light" }); await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("link", { name: "Rowzen", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Color theme", exact: true })).toHaveValue("dark"); expect(hydration).toEqual([]);
});
test("theme storage failure keeps the selector usable without persisting workspace data", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, "localStorage", { get() { throw new Error("Unavailable"); } }));
  await page.goto("/login"); await page.getByRole("combobox", { name: "Color theme", exact: true }).selectOption("dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("combobox", { name: "Color theme", exact: true }).selectOption("light"); await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});
test("theme preference synchronizes across tabs", async ({ page, context }) => {
  await page.goto("/login"); const second = await context.newPage(); await second.goto("/");
  await page.getByRole("combobox", { name: "Color theme", exact: true }).selectOption("dark");
  await expect(second.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(second.getByRole("combobox", { name: "Color theme", exact: true })).toHaveValue("dark"); await second.close();
});
for (const width of [320,375,390,768,1024,1440]) for (const theme of ["light","dark"] as const) {
  test(`public pages ${theme} at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 }); await page.emulateMedia({ colorScheme: theme });
    for (const [route,name] of [["/","landing"],["/login","login"],["/rehearsal","demo"]]) {
      await page.goto(route);
      const selector = page.getByRole("combobox", { name: "Color theme", exact: true }); await expect(selector).toBeVisible(); await selector.selectOption(theme);
      await expect(page.locator("html")).toHaveAttribute("data-theme",theme); await selector.focus(); await expect(selector).toBeFocused();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: shot(`${name}-${theme}-${width}.png`), fullPage:true });
    }
  });
}
