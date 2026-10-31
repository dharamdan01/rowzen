import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { themeFixture } from "./helpers/theme-fixture";
import { workspaceStep } from "./helpers/workspace-navigation";

const folder = resolve("playwright/.cache/rowzen-primitives-shell-20261027");
test.beforeAll(() => { mkdirSync(folder, { recursive: true }); });
for (const width of [320, 375, 390, 768, 1024, 1440]) for (const theme of ["light", "dark"] as const) {
  test(`drawer, account disclosure and project dialog keyboard ${theme} ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 }); await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    await themeFixture(page, "projects", theme);
    await expect(page.getByRole("heading", { name: "Projects", exact: true })).toBeVisible();
    const account = page.getByRole("button", { name: "Account", exact: true });
    await expect(page.getByRole("button", { name: "Sign Out", exact: true })).toBeHidden();
    await account.focus(); await account.press("Enter");
    const signOut = page.getByRole("button", { name: "Sign Out", exact: true });
    await signOut.focus(); await signOut.press("Escape");
    await expect(signOut).toBeHidden(); await expect(account).toBeFocused();
    await account.press("Space"); await expect(signOut).toBeVisible();
    await page.getByRole("heading", { name: "Projects", exact: true }).click(); await expect(signOut).toBeHidden();
    if (width < 1024) {
      const trigger = page.getByRole("button", { name: "Navigation", exact: true });
      const before = await page.evaluate(() => ({ y: scrollY, overflow: document.body.style.overflow }));
      await trigger.focus(); await trigger.press("Enter");
      const drawer = page.getByRole("dialog", { name: "Workspace navigation", exact: true });
      await expect(drawer).toBeVisible(); await expect(trigger).toHaveAttribute("aria-expanded", "true");
      const close = drawer.getByRole("button", { name: "Close navigation", exact: true });
      await expect(close).toBeFocused();
      await close.press("Shift+Tab"); await expect(drawer.getByRole("link", { name: "Results", exact: true })).toBeFocused();
      await page.keyboard.press("Tab"); await expect(close).toBeFocused();
      await expect(page.locator("body")).toHaveCSS("overflow", "hidden");
      mkdirSync(folder, { recursive: true }); await page.screenshot({ path: resolve(folder, `drawer-${theme}-${width}.png`) });
      await page.keyboard.press("Escape"); await expect(drawer).not.toBeVisible(); await expect(trigger).toBeFocused();
      await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe(before.overflow);
      expect(await page.evaluate(() => ({ y: scrollY, overflow: document.body.style.overflow }))).toEqual(before);
      await trigger.click(); await drawer.getByRole("button", { name: "Close navigation", exact: true }).click(); await expect(trigger).toBeFocused();
    }
    const newProject = page.getByRole("button", { name: "New project", exact: true });
    await newProject.focus(); await newProject.press("Enter");
    const dialog = page.getByRole("dialog", { name: "New project", exact: true });
    const name = dialog.getByLabel("Project name", { exact: true });
    await expect(name).toBeFocused(); await name.press("Shift+Tab");
    await expect(dialog.getByRole("button", { name: "Create project", exact: true })).toBeFocused();
    await page.keyboard.press("Tab"); await expect(name).toBeFocused();
    await name.fill("Unsaved project"); await dialog.getByLabel("Description (optional)").fill("Keyboard-only local draft");
    await expect(name).toHaveValue("Unsaved project");
    await page.screenshot({ path: resolve(folder, `dialog-${theme}-${width}.png`) });
    await page.keyboard.press("Escape"); await expect(dialog).toHaveCount(0); await expect(newProject).toBeFocused();
    await expect(page.getByRole("heading", { name: "Customer migration", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const projectLink = page.getByRole("link", { name: "Open Customer migration in workspace", exact: true });
    await expect(projectLink).toHaveAttribute("href", "/upload?projectId=theme-project");
    await expect(page.getByRole("link", { name: "Find saved reports for Customer migration", exact: true })).toHaveAttribute("href", "/results?projectId=theme-project");
  });
}

test("resizing an open drawer restores the desktop focus target and scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await themeFixture(page, "projects", "dark");
  await page.getByRole("button", { name: "Navigation", exact: true }).click();
  await page.setViewportSize({ width: 1024, height: 844 });
  await expect(page.getByRole("dialog", { name: "Workspace navigation" })).not.toBeVisible();
  await expect(page.getByRole("navigation", { name: "Dashboard navigation", exact: true }).getByRole("link", { name: "Projects", exact: true })).toBeFocused();
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe("");
});

test("cancelled project departure preserves CSV and mapping drafts under the drawer", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 1000 });
  await page.route("**/api/projects**", route => route.fulfill({ contentType: "application/json", body: JSON.stringify(route.request().url().includes("/templates") ? { templates: [] } : { projects: [{ id: "theme-project", name: "Customer migration" }] }) }));
  await themeFixture(page, "workspace", "light");
  await page.getByLabel("Upload CSV datasets", { exact: true }).setInputFiles({ name: "people.csv", mimeType: "text/csv", buffer: Buffer.from("id,name\n001,Original") });
  await workspaceStep(page, "Configure"); const draft = page.getByLabel("Target for people.name", { exact: true }); await draft.fill("display_name");
  await page.getByRole("button", { name: "Navigation", exact: true }).click();
  page.once("dialog", dialog => dialog.dismiss());
  await page.getByRole("navigation", { name: "Mobile dashboard navigation" }).getByRole("link", { name: "Projects", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Workspace navigation" })).toBeVisible();
  await page.keyboard.press("Escape"); await expect(draft).toHaveValue("display_name");
  await expect(page.getByRole("region", { name: "Preview of people.csv", exact: true, includeHidden: true })).toContainText("Original");
});

test("account error survives dismissal and retry retains the existing sign-out redirect", async ({ page }) => {
  await themeFixture(page, "dashboard", "light");
  let requests = 0;
  await page.route("**/api/auth/sign-out", route => { requests++; return route.fulfill({ status: requests === 1 ? 400 : 200, contentType: "application/json", body: requests === 1 ? '{"message":"Synthetic rejection"}' : '{"success":true}' }); });
  const account = page.getByRole("button", { name: "Account", exact: true }); await account.click();
  await page.getByRole("button", { name: "Sign Out", exact: true }).click();
  await expect(page.getByRole("group", { name: "Account", exact: true }).getByRole("alert")).toHaveText("Could not sign out. Try again.");
  await page.keyboard.press("Escape"); await expect(account).toBeFocused(); await account.press("Enter");
  await expect(page.getByRole("alert")).toHaveText("Could not sign out. Try again.");
  await page.getByRole("button", { name: "Sign Out", exact: true }).click(); await expect(page).toHaveURL(/\/login$/); expect(requests).toBe(2);
});

test("sign-out blocks duplicate requests while pending and recovers from a network failure", async ({ page }) => {
  await themeFixture(page, "dashboard", "light");
  let requests = 0;
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/auth/sign-out", async route => {
    requests++;
    if (requests === 1) {
      await pending;
      await route.abort("failed");
    } else await route.fulfill({ contentType: "application/json", body: '{"success":true}' });
  });
  try {
    await page.getByRole("button", { name: "Account", exact: true }).click();
    const signOut = page.getByRole("button", { name: "Sign Out", exact: true });
    await signOut.evaluate(button => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click(); });
    const busy = page.getByRole("button", { name: "Signing out...", exact: true });
    await expect(busy).toBeDisabled();
    await expect(busy).toHaveAttribute("aria-busy", "true");
    await expect.poll(() => requests).toBe(1);
    release();
    await expect(page.getByRole("alert")).toContainText("Could not sign out.");
    await expect(signOut).toBeEnabled();
    await signOut.click();
    await expect(page).toHaveURL(/\/login$/);
    expect(requests).toBe(2);
  } finally { release(); }
});

test("cancelling sign-out preserves workspace drafts without sending a request", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 1000 });
  await page.route("**/api/projects**", route => route.fulfill({ contentType: "application/json", body: JSON.stringify(route.request().url().includes("/templates") ? { templates: [] } : { projects: [{ id: "theme-project", name: "Customer migration" }] }) }));
  let requests = 0;
  await page.route("**/api/auth/sign-out", route => {
    requests++;
    return route.fulfill({ status: 400, contentType: "application/json", body: "{}" });
  });
  await themeFixture(page, "workspace", "light");
  await page.getByLabel("Upload CSV datasets", { exact: true }).setInputFiles({ name: "people.csv", mimeType: "text/csv", buffer: Buffer.from("id,name\n1,Original") });
  await workspaceStep(page, "Configure");
  const draft = page.getByLabel("Target for people.name", { exact: true });
  await draft.fill("retained_name");
  await page.getByRole("button", { name: "Account", exact: true }).click();
  let confirmations = 0;
  page.once("dialog", async dialog => { confirmations++; await dialog.dismiss(); });
  await page.getByRole("button", { name: "Sign Out", exact: true }).click();
  expect(confirmations).toBe(1);
  expect(requests).toBe(0);
  await expect(draft).toHaveValue("retained_name");
  await expect(page.getByRole("region", { name: "Preview of people.csv", exact: true, includeHidden: true })).toContainText("Original");
});
