import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { themeTokens } from "../../src/lib/theme/tokens";

const screenshots = resolve("playwright/.cache/rowzen-foundation-20261027");
for (const width of [320, 1440]) for (const theme of ["light", "dark"] as const) {
  test(`Rowzen identity, pre-paint tokens and hydration ${theme} ${width}px`, async ({ page }) => {
    const hydration: string[] = [];
    page.on("console", message => { if (message.type() === "error" && /hydrat|did not match/i.test(message.text())) hydration.push(message.text()); });
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ colorScheme: theme });
    await page.addInitScript(() => {
      const observer = new MutationObserver(() => {
        if (!document.body) return;
        Object.assign(window, { rowzenFirstPaint: { theme: document.documentElement.dataset.theme,
          background: getComputedStyle(document.documentElement).getPropertyValue("--background").trim() } });
        observer.disconnect();
      });
      observer.observe(document, { childList: true, subtree: true });
    });
    for (const [route, title, name] of [["/", "CSV validation | Rowzen", "landing"], ["/login", "Sign in | Rowzen", "login"], ["/rehearsal", "CSV demo | Rowzen", "demo"]]) {
      await page.goto(route);
      await expect(page).toHaveTitle(title);
      await expect(page.getByRole("link", { name: "Rowzen", exact: true }).first()).toHaveAttribute("href", "/");
      await expect(page.getByRole("link", { name: "Rowzen", exact: true }).first().locator("svg")).toHaveAttribute("aria-hidden", "true");
      await expect(page.locator("#theme-tokens")).toHaveCount(1);
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      expect(await page.evaluate(() => (window as unknown as { rowzenFirstPaint: unknown }).rowzenFirstPaint))
        .toEqual({ theme, background: themeTokens[theme].background });
      expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--primary").trim())).toBe(themeTokens[theme].primary);
      expect(await page.locator("body").innerText()).not.toMatch(/DataRehearsal|Data Rehearsal/);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await expect(page.locator('meta[name="application-name"]')).toHaveAttribute("content", "Rowzen");
      await expect(page.locator('link[rel="icon"][type="image/svg+xml"]')).toHaveAttribute("href", /^\/icon\.svg/);
      mkdirSync(screenshots, { recursive: true });
      await page.screenshot({ path: resolve(screenshots, `${name}-${theme}-${width}.png`) });
    }
    expect(hydration).toEqual([]);
    expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([]);
  });
}

test("standalone Rowzen SVG and legacy favicon route contain only local image content", async ({ request, page }) => {
  const svg = await request.get("/icon.svg"), ico = await request.get("/favicon.ico");
  expect(svg.ok()).toBe(true); expect(svg.headers()["content-type"]).toContain("image/svg+xml");
  const source = await svg.text();
  expect(source).toContain("<title>Rowzen</title>");
  expect(source).not.toMatch(/<script|<foreignObject|<image|\son\w+=|\shref=|url\(/i);
  await page.goto("/login");
  expect(await page.evaluate(source => {
    const parsed = new DOMParser().parseFromString(source, "image/svg+xml");
    return { valid: !parsed.querySelector("parsererror"), label: parsed.documentElement.getAttribute("aria-label") };
  }, source)).toEqual({ valid: true, label: "Rowzen" });
  expect(ico.ok()).toBe(true);
  const bytes = await ico.body();
  expect([...bytes.subarray(0, 8)]).toEqual([0, 0, 1, 0, 1, 0, 32, 32]);
  expect(bytes.readUInt16LE(12)).toBe(32);
  expect(bytes.subarray(22, 30).toString("hex")).toBe("89504e470d0a1a0a");
});
