import { workspaceControl, workspaceStep } from "./helpers/workspace-navigation";
import { expect, test } from "@playwright/test";
import { downloadText, metric, validateCsv } from "./helpers";

const both = ["students.csv", "departments.csv"] as const;
async function applyFk(page: import("@playwright/test").Page) {
  await (await workspaceControl(page, page.getByRole("combobox", { includeHidden: true,  name: "Correction dataset" }))).selectOption("students");
  await (await workspaceControl(page, page.getByRole("button", { includeHidden: true,  name: "Edit students line 4 column department_id" }))).click();
  await (await workspaceControl(page, page.getByRole("textbox", { includeHidden: true,  name: "Proposed value for students line 4 column department_id" }))).fill("20");
  await (await workspaceControl(page, page.getByRole("button", { includeHidden: true,  name: "Apply correction" }))).click();
}

test.describe("Phase 8 S6 authenticated corrected CSV exports stay local", () => {
  test("download stays disabled before approval, then contains corrected data and source header order", async ({ page }) => {
    await validateCsv(page, both);
    await workspaceStep(page, "Export");
    await expect(page.getByRole("button", { name: "Download corrected CSV" })).toBeDisabled();
    await applyFk(page);
    await expect(metric(page, "Total issues")).toHaveText("2");
    await (await workspaceControl(page, page.getByRole("combobox", { includeHidden: true,  name: "Corrected CSV dataset" }))).selectOption("students");
    const posts: string[] = [];
    page.on("request", (request) => {
      if (request.method() === "POST") posts.push(request.url());
    });
    const csv = await downloadText(page, "Download corrected CSV");
    expect(csv).toContain('\uFEFF"id","name","department_id"');
    expect(csv).toContain('"3","Ahmed","20"');
    expect(csv).not.toContain('"3","Ahmed","99"');
    expect(posts).toEqual([]);
  });
  test("download of unedited parent dataset is allowed after child correction; undo disables export", async ({ page }) => {
    await validateCsv(page, both);
    await applyFk(page);
    await (await workspaceControl(page, page.getByRole("combobox", { includeHidden: true,  name: "Corrected CSV dataset" }))).selectOption("departments");
    const csv = await downloadText(page, "Download corrected CSV");
    expect(csv).toContain('"10","Software Engineering"');
    expect(csv).toContain('"20","Computer Science"');
    await (await workspaceControl(page, page.getByRole("button", { includeHidden: true,  name: "Undo correction" }))).click();
    await workspaceStep(page, "Export");
    await expect(page.getByRole("button", { name: "Download corrected CSV" })).toBeDisabled();
    await (await workspaceControl(page, page.getByRole("button", { includeHidden: true,  name: "Redo correction" }))).click();
    await workspaceStep(page, "Export");
    await expect(page.getByRole("button", { name: "Download corrected CSV" })).toBeEnabled();
  });
  test("formula-like corrected values are apostrophe-protected without saving any report", async ({ page }) => {
    await validateCsv(page, both);
    await (await workspaceControl(page, page.getByRole("combobox", { includeHidden: true,  name: "Correction dataset" }))).selectOption("students");
    await (await workspaceControl(page, page.getByRole("button", { includeHidden: true,  name: "Edit students line 4 column name" }))).click();
    await (await workspaceControl(page, page.getByRole("textbox", { includeHidden: true,  name: "Proposed value for students line 4 column name" }))).fill("=1+1");
    await (await workspaceControl(page, page.getByRole("button", { includeHidden: true,  name: "Apply correction" }))).click();
    const content = await downloadText(page, "Download corrected CSV");
    expect(content).toContain('"\'=1+1"');
    expect(content).not.toContain('"=1+1"');
    await workspaceControl(page,page.getByRole("button",{name:"Download corrected CSV",includeHidden:true}));
    await expect(page.getByText(/formula-like values protected/)).toBeVisible();
  });
});
