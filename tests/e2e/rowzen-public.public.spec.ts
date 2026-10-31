import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Route } from "@playwright/test";

const evidence = resolve("playwright/.cache/rowzen-public-20261027");
for (const width of [320, 375, 390, 768, 1024, 1440]) for (const theme of ["light", "dark"] as const) {
  test(`Rowzen login layout, focus and session loading ${theme} ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error" && /hydrat|did not match/i.test(message.text())) errors.push(message.text()); });
    let session: Route | undefined;
    await page.route("**/api/auth/get-session*", route => { session = route; });
    await page.goto("/login?next=%2Fresults%3Fpage%3D2");
    await expect(page.getByText("Checking your session...", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue with Google", exact: true })).toHaveCount(0);
    await expect.poll(() => Boolean(session)).toBe(true);
    mkdirSync(evidence, { recursive: true });
    if (width === 320) await page.screenshot({ path: resolve(evidence, `login-loading-${theme}-${width}.png`) });
    await session!.fulfill({ contentType: "application/json", body: "null" });
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sign in to Rowzen");
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Skip to sign in", exact: true })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("main")).toBeFocused();
    const github = page.getByRole("button", { name: "Continue with GitHub", exact: true });
    const google = page.getByRole("button", { name: "Continue with Google", exact: true });
    await github.focus(); await page.keyboard.press("Tab"); await expect(google).toBeFocused();
    await page.keyboard.press("Shift+Tab"); await expect(github).toBeFocused();
    expect(await github.evaluate(button => getComputedStyle(button).outlineStyle)).not.toBe("none");
    for (const button of [github, google]) expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await expect(page.getByRole("link", { name: "Back to Rowzen", exact: true })).toHaveAttribute("href", "/");
    const context = page.getByRole("heading", { name: /A little clarity/ });
    if (width >= 1024) await expect(context).toBeVisible(); else await expect(context).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: resolve(evidence, `login-${theme}-${width}.png`), fullPage: true });
    expect(errors).toEqual([]);
  });
}

test("public metadata, honest capabilities and all local link targets remain valid", async ({ page, request }) => {
  const writes: string[] = [], external: string[] = [];
  page.on("request", req => {
    if (!["GET", "HEAD"].includes(req.method())) writes.push(req.method());
    if (new URL(req.url()).origin !== new URL(page.url()).origin && page.url() !== "about:blank") external.push(new URL(req.url()).origin);
  });
  await page.route("**/api/auth/get-session*", route => route.fulfill({ contentType: "application/json", body: "null" }));
  for (const path of ["/", "/login"]) {
    await page.goto(path);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /preflight/i);
    await expect(page.locator("h1")).toHaveCount(1);
    const links = await page.locator("a").evaluateAll(nodes => nodes.map(node => node.getAttribute("href")!));
    for (const href of new Set(links)) {
      expect(href).not.toBe("#");
      if (href.startsWith("#")) expect(await page.locator(`[id="${href.slice(1)}"]`).count()).toBe(1);
      else { expect(href.startsWith("/")).toBe(true); expect((await request.get(href)).ok()).toBe(true); }
    }
  }
  await page.goto("/");
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", /Rowzen/);
  await expect(page.locator('meta[property="og:description"]')).toHaveAttribute("content", /does not execute database imports/);
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary");
  for (const text of ["Demo capture · sample CSV data", "AI advice never replaces validation", "Database record exports require your explicit consent.", "Passing configured checks does not guarantee database compatibility"]) await expect(page.getByText(text, { exact: false })).toBeVisible();
  await page.getByRole("link", { name: "Try the CSV demo", exact: true }).click();
  await expect(page).toHaveURL(/\/rehearsal$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect(writes).toEqual([]); expect(external).toEqual([]);
});

test("login System follows OS changes without losing cancellation feedback", async ({ page }) => {
  await page.route("**/api/auth/get-session*", route => route.fulfill({ contentType: "application/json", body: "null" }));
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/login?provider=google&error=access_denied&next=%2Fprojects");
  const selector = page.getByRole("combobox", { name: "Color theme", exact: true });
  await selector.selectOption("system");
  await expect(page.locator("main").getByRole("alert")).toContainText("Google sign-in was cancelled or declined");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator("main").getByRole("alert")).toContainText("Google sign-in was cancelled or declined");
  await page.reload(); await expect(selector).toHaveValue("system");
  await expect(page.locator("main").getByRole("alert")).toContainText("Google sign-in was cancelled or declined");
});
