import { expect, type Locator, type Page } from "@playwright/test";

export async function workspaceStep(page: Page, step: string) {
  const nav = page.getByRole("navigation", { name: "CSV workflow steps" });
  if (!await nav.count()) return; // Standalone component fixtures have no workspace shell.
  if (await page.locator(`[data-workspace-step="${step.toLowerCase()}"]:visible`).count()) return;
  const select = nav.getByRole("combobox", { name: "Workspace step" });
  if (await select.isVisible()) await select.selectOption(step.toLowerCase());
  else await nav.getByRole("button", { name: step, exact: true }).click();
  await expect(page.locator(`[data-workspace-step="${step.toLowerCase()}"]`)).toBeVisible();
}

/** Reveal a real control using the same navigation available to users. */
export async function workspaceControl(page: Page, control: Locator): Promise<Locator> {
  if (!await control.count()) return control;
  const context = await control.first().evaluate(node => ({
    step: node.closest<HTMLElement>("[data-workspace-step]")?.dataset.workspaceStep,
    dataset: node.closest<HTMLElement>("[data-workspace-dataset]")?.dataset.workspaceDataset,
    view: node.closest<HTMLElement>("[data-review-view]")?.dataset.reviewView,
    account: Boolean(node.closest("[data-account-panel]")),
  }));
  if (context.step) await workspaceStep(page, context.step[0].toUpperCase() + context.step.slice(1));
  if (context.dataset) await page.getByRole("combobox", { name: "Configure dataset", exact: true }).selectOption(context.dataset);
  if (context.view) await page.getByRole("combobox", { name: "Review section", exact: true }).selectOption(context.view);
  if (context.account && !await control.first().isVisible()) await page.getByRole("button", { name: "Account", exact: true }).click();
  // Native details are operated through their summary, never by removing hidden attributes.
  for (const detail of await control.first().locator("xpath=ancestor::details").all()) {
    if (await detail.locator(":scope > summary").evaluate((summary, target) => summary.contains(target as Node), await control.first().elementHandle())) continue;
    if (!await detail.getAttribute("open").then(value => value !== null)) await detail.locator(":scope > summary").click();
  }
  return control.filter({ visible: true });
}
