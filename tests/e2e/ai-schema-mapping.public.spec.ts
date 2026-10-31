import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { build } from "esbuild";
import { expect, test, type Page, type Route } from "@playwright/test";
import { approvedLocalModels } from "../../src/lib/ai/providers/ollama";
import type { SchemaMappingResponse } from "../../src/lib/ai/schema-mapping";
import { contractSchemaCsv, schemaFixture, schemaWireAnswer, studentSchemaCsv, semanticProfileCsv, semanticProfileFixture } from "../fixtures/ai-schema-mapping";
import { workspaceControl, workspaceStep } from "./helpers/workspace-navigation";
import { applicationStyles } from "./helpers/application-styles";

let script: string;
test.beforeAll(async () => {
  script = (await build({ bundle: true, write: false, platform: "browser", format: "iife", minify: true,
    define: { "process.env.NODE_ENV": '"production"', "process.env": "{}" },
    stdin: { resolveDir: process.cwd(), loader: "tsx", contents: `
      import React from 'react'; import {createRoot} from 'react-dom/client';
      import UploadWorkspace from './src/components/upload/upload-workspace';
      createRoot(document.querySelector('#fixture')).render(<React.StrictMode><UploadWorkspace initialProjectId="schema-project"/></React.StrictMode>);
    ` } })).outputFiles[0].text;
});

async function show(page: Page, theme = "light", csv = "id,email,name\n1,PRIVATE_RAW_VALUE@example.test,Synthetic Person", filename = "contacts.csv", template = schemaFixture().template) {
  await page.route("**/api/projects", route => route.fulfill({ contentType: "application/json", body: JSON.stringify({ projects: [{ id: "schema-project", name: "Synthetic schema project" }] }) }));
  await page.route("**/api/projects/schema-project/templates", route => route.fulfill({ contentType: "application/json", body: JSON.stringify({ templates: [{ id: "approved-template", projectId: "schema-project", name: "Approved contacts schema", configuration: template }] }) }));
  const shell = await applicationStyles(page);
  await page.setContent(`<!doctype html><html lang="en" class="${shell.font}" data-theme="${theme}"><head>${shell.styles}</head><body><main style="padding:16px;max-width:1152px;margin:auto;min-width:0"><div id="fixture"></div></main></body></html>`);
  await page.addScriptTag({ content: script });
  await page.getByLabel("Upload CSV datasets", { exact: true }).setInputFiles({ name: filename, mimeType: "text/csv", buffer: Buffer.from(csv) });
  await workspaceStep(page, "Configure");
}
// Unconfigured rule selects use the disabled "Not configured" option;
// rejecting advice must preserve that unset rule rather than imply string validation.
const answer: SchemaMappingResponse = { schemaVersion: 1, suggestions: [
  { sourceId: "c1", targetId: "t1", type: "email", required: true, key: "unique", reason: "template_match" },
  { sourceId: "c2", targetId: "t3", type: "string", required: null, key: null, reason: "template_match" },
] };
async function modelRoutes(page: Page) {
  const calls: string[] = [];
  let mode: "success" | "unavailable" | "hold" | "invalid" = "success";
  let held: Route | null = null;
  let responseAnswer: typeof answer = answer;
  await page.route("http://127.0.0.1:11434/**", async route => {
    calls.push(route.request().postData() ?? "");
    const headers = { "Content-Type": "application/json", "Access-Control-Allow-Origin": new URL(page.url()).origin };
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: { ...headers, "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "content-type" } });
    if (mode === "unavailable") return route.abort("connectionrefused");
    if (route.request().url().endsWith("/api/tags")) return route.fulfill({ headers, body: JSON.stringify({ models: [{ name: "qwen2.5:0.5b", digest: approvedLocalModels["qwen2.5:0.5b"] }] }) });
    if (route.request().url().endsWith("/api/show")) return route.fulfill({ headers, body: '{"details":{"format":"gguf"}}' });
    if (mode === "hold") { held = route; return; }
    return route.fulfill({ headers, body: JSON.stringify({ model: "qwen2.5:0.5b", done: true, message: { role: "assistant", content: mode === "invalid" ? '{"schemaVersion":1,"suggestions":[{"sql":"DROP TABLE"}]}' : JSON.stringify(schemaWireAnswer(responseAnswer)) } }) });
  });
  return { calls, answer: (next: typeof answer) => { responseAnswer = next; }, mode: (next: typeof mode) => { mode = next; }, pending: () => held,
    finish: async () => { const late = held; held = null; await late?.fulfill({ contentType: "application/json", body: JSON.stringify({ model: "qwen2.5:0.5b", done: true, message: { role: "assistant", content: JSON.stringify(schemaWireAnswer(answer)) } }) }).catch(() => {}); } };
}

for (const width of [320, 1440]) {
  test(`No-op, empty and ambiguous responses preserve reports and corrections at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 }); const model = await modelRoutes(page); await show(page);
    const ai = page.getByRole("region", { name: "AI schema mapping" });
    await (await workspaceControl(page, page.getByRole("button", { name: "Run Validation", exact: true, includeHidden: true }))).click();
    await (await workspaceControl(page, page.getByRole("button", { name: "Edit contacts line 2 column name", exact: true, includeHidden: true }))).click();
    await page.getByRole("textbox", { name: "Proposed value for contacts line 2 column name", exact: true }).fill("PRIVATE_CORRECTED_NAME");
    await page.getByRole("button", { name: "Apply correction", exact: true }).click();
    const report = page.getByRole("region", { name: "Validation results", exact: true, includeHidden: true });
    const beforeReport = await report.textContent();
    const history = page.locator("summary").filter({ hasText: /^Correction activity history/ });
    const beforeHistory = await history.textContent();
    await workspaceStep(page, "Configure");
    for (const suggestions of [
      [{ sourceId: "c0", targetId: "t0", type: null, required: false, key: "primary", reason: "name_hint" }] as SchemaMappingResponse["suggestions"],
      [],
      [{ sourceId: "c1", targetId: "t1", type: "email", required: null, key: "unique", reason: "ambiguous" }] as SchemaMappingResponse["suggestions"],
    ]) {
      model.answer({ schemaVersion: 1, suggestions }); await request(page);
      await expect(ai.getByRole("status")).toHaveText("No safe schema changes recommended");
      await expect(ai.getByLabel(/Accept suggestion/)).toHaveCount(0);
      await expect(ai.getByRole("button", { name: "Apply selected suggestions", exact: true })).toBeDisabled();
      expect(await report.textContent()).toBe(beforeReport); expect(await history.textContent()).toBe(beforeHistory);
      await ai.getByRole("button", { name: "Reject suggestions", exact: true }).focus(); await page.keyboard.press("Enter");
      expect(await report.textContent()).toBe(beforeReport);
    }
    await workspaceStep(page, "Correct");
    await page.getByRole("button", { name: "Undo correction", exact: true }).click();
    await page.getByRole("button", { name: "Redo correction", exact: true }).click();
    await expect(page.getByRole("button", { name: "Edit contacts line 2 column name", exact: true }).locator("xpath=ancestor::td")).toContainText("PRIVATE_CORRECTED_NAME");
    expect(model.calls.join(" ")).not.toMatch(/PRIVATE_RAW_VALUE|PRIVATE_CORRECTED_NAME|Synthetic Person/);
  });
  test(`Semantic warnings and approved-template drift preserve safe mapping at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 }); const model = await modelRoutes(page);
    const template = semanticProfileFixture().configuration;
    template.datasets[0].headers[2] = "full_name"; template.mappings.students[2] = { source: "full_name", target: "full_name" };
    template.rules.students.types = { email: "email", enrolled_on: "date", full_name: "string" };
    await show(page, "light", semanticProfileCsv, "students.csv", template);
    const ai = page.getByRole("region", { name: "AI schema mapping" });
    const evidence = ai.getByRole("group", { name: "Local column evidence" });
    await expect(evidence.locator("summary").filter({ hasText: "email" })).toContainText("Invalid email: 1/2 populated");
    await expect(evidence.locator("summary").filter({ hasText: "enrolled_on" })).toContainText("Invalid date: 1/2 populated");
    await expect(evidence.locator("summary").filter({ hasText: "Missing: 1/3" })).toHaveCount(2);
    await expect(evidence.getByLabel("Evidence details for email", { exact: true })).toHaveAccessibleDescription(/Inferred: string.*Missing: 1\/3.*Invalid email: 1\/2 populated/);
    await selectTemplate(page);
    await expect(ai).toContainText("Added columns: name. Removed columns: full_name");
    await page.getByRole("button", { name: "Load mapping template", exact: true }).click();
    await expect(page.getByText("Dataset 'students' or its original header order does not match.", { exact: true })).toBeVisible();
    model.answer({ schemaVersion: 1, suggestions: [
      { sourceId: "c1", targetId: "t1", type: "email", required: null, key: null, reason: "template_match" },
      { sourceId: "c3", targetId: "t3", type: "date", required: null, key: null, reason: "template_match" },
    ] });
    await request(page); await expect(ai.getByRole("alert")).toContainText("unsupported by the local column evidence");
    await expect(ai.getByLabel(/Accept suggestion/)).toHaveCount(0);
    model.answer({ schemaVersion: 1, suggestions: [
      { sourceId: "c0", targetId: "t0", type: null, required: null, key: null, reason: "name_hint" },
      { sourceId: "c1", targetId: "t1", type: "string", required: null, key: null, reason: "name_hint" },
      { sourceId: "c2", targetId: "t5", type: "string", required: null, key: null, reason: "name_hint" },
    ] });
    await request(page); await expect(ai).toContainText("Unverified suggestions");
    await expect(ai.getByLabel("Accept suggestion for id", { exact: true })).toHaveCount(0);
    const email = ai.getByLabel("Accept suggestion for email", { exact: true }).locator("xpath=ancestor::li");
    await expect(email).not.toContainText("Missing values:");
    await email.getByRole("button", { name: "View evidence for email", exact: true }).focus(); await page.keyboard.press("Enter");
    await expect(evidence.getByLabel("Evidence details for email", { exact: true })).toBeFocused();
    await expect(evidence.getByText(/Missing values: 1 empty cell out of 3/).first()).toBeVisible();
    await expect(ai.getByLabel(/Accept suggestion/)).toHaveCount(2);
    await ai.getByLabel("Accept suggestion for name", { exact: true }).focus(); await page.keyboard.press("Space");
    page.once("dialog", dialog => dialog.dismiss()); await page.getByRole("button", { name: "Apply selected suggestions", exact: true }).click();
    await expect(page.getByLabel("Target for students.name", { exact: true })).toHaveValue("name");
    page.once("dialog", dialog => dialog.accept()); await page.getByRole("button", { name: "Apply selected suggestions", exact: true }).click();
    await expect(page.getByLabel("Target for students.name", { exact: true })).toHaveValue("full_name");
    await expect(page.getByLabel("Type of students.email", { exact: true })).toHaveValue("");
    await expect(page.getByLabel("Type of students.enrolled_on", { exact: true })).toHaveValue("");
    expect(model.calls.join(" ")).not.toMatch(/PRIVATE_|example\.test|2025-02-30|00123/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
  test(`False template evidence has a safe diagnosis and validation still works at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 }); const model = await modelRoutes(page); await show(page);
    const ai = page.getByRole("region", { name: "AI schema mapping" });
    model.answer({ schemaVersion: 1, suggestions: [{ sourceId: "c1", targetId: "t1", type: "email", required: null, key: null, reason: "template_match" }] });
    await request(page);
    await expect(ai.getByRole("alert")).toContainText("claimed a template match without a matching selected-template target");
    await expect(ai.getByRole("alert")).not.toContainText("PRIVATE");
    await expect(ai.getByLabel(/Accept suggestion/)).toHaveCount(0);
    await expect(page.getByLabel("Type of contacts.email", { exact: true })).toHaveValue("");
    await (await workspaceControl(page, page.getByRole("button", { name: "Run Validation", exact: true, includeHidden: true }))).click();
    await expect(page.getByRole("heading", { name: "Migration readiness: READY", exact: true })).toBeVisible();
    await workspaceStep(page, "Configure");
    model.answer({ schemaVersion: 1, suggestions: [{ sourceId: "c1", targetId: "t1", type: "email", required: null, key: null, reason: "name_hint" }] });
    await request(page); await expect(ai).toContainText("Unverified suggestions");
    await expect(page.getByLabel("Type of contacts.email", { exact: true })).toHaveValue("");
    expect(model.calls.join(" ")).not.toMatch(/PRIVATE_RAW_VALUE|Synthetic Person/);
  });
  test(`Reported CSV rejects semantic hallucinations and recovers at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 }); const model = await modelRoutes(page);
    await show(page, "light", studentSchemaCsv, "students.csv");
    const ai = page.getByRole("region", { name: "AI schema mapping" });
    await expect(ai).toContainText("id · Inferred: integer · Configured: Not set");
    await expect(ai).toContainText("name · Inferred: string · Configured: Not set");
    await expect(ai).toContainText("department_id · Inferred: integer · Configured: Not set");
    await expect(ai.getByText("2 rows share 1 repeated value; primary/unique-key suggestions are blocked.")).toHaveCount(2);
    await expect(ai).toContainText("do not establish a foreign key");
    model.answer({ schemaVersion: 1, suggestions: [
      { sourceId: "c0", targetId: "t0", type: "email", required: null, key: null, reason: "name_hint" },
      { sourceId: "c1", targetId: "t1", type: "integer", required: null, key: "primary", reason: "name_hint" },
      { sourceId: "c2", targetId: "t2", type: "number", required: null, key: "primary", reason: "name_hint" },
    ] });
    await request(page); await expect(ai.getByRole("alert")).toContainText("unsupported by the local column evidence");
    await expect(ai.getByLabel(/Accept suggestion/)).toHaveCount(0);
    await expect(page.getByLabel("Type of students.id", { exact: true })).toHaveValue("");
    await expect(page.getByLabel("Primary key for students", { exact: true })).toHaveValue("id");
    model.answer({ schemaVersion: 1, suggestions: [
      { sourceId: "c0", targetId: "t0", type: "integer", required: null, key: null, reason: "name_hint" },
      { sourceId: "c1", targetId: "t1", type: "string", required: null, key: null, reason: "name_hint" },
      { sourceId: "c2", targetId: "t2", type: "integer", required: null, key: null, reason: "name_hint" },
    ] });
    await request(page); await expect(ai).toContainText("Unverified suggestions");
    await expect(ai).not.toContainText("primary candidate");
    await ai.getByLabel("Accept suggestion for id", { exact: true }).focus(); await page.keyboard.press("Space");
    page.once("dialog", dialog => dialog.dismiss()); await page.getByRole("button", { name: "Apply selected suggestions", exact: true }).click();
    await expect(page.getByLabel("Type of students.id", { exact: true })).toHaveValue("");
    page.once("dialog", dialog => dialog.accept()); await page.getByRole("button", { name: "Apply selected suggestions", exact: true }).click();
    await expect(page.getByLabel("Type of students.id", { exact: true })).toHaveValue("integer");
    await (await workspaceControl(page, page.getByRole("button", { name: "Run Validation", exact: true, includeHidden: true }))).click();
    await expect(page.getByRole("heading", { name: "Migration readiness: BLOCKED", exact: true })).toBeVisible();
    expect(model.calls.join(" ")).not.toMatch(/Ali|Sara|Ahmed|Bilal/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
async function selectTemplate(page: Page) {
  await (await workspaceControl(page, page.getByLabel("Saved mapping template", { exact: true }))).selectOption("approved-template");
  await expect(page.getByRole("region", { name: "AI schema mapping" })).toContainText("Removed columns: full_name");
}
async function request(page: Page) {
  await page.getByLabel("Allow local schema metadata request").check();
  const button = page.getByRole("button", { name: /^(Suggest schema settings|Retry schema suggestions)$/ });
  await button.focus(); await page.keyboard.press("Enter");
}

for (const width of [320, 375, 390, 768, 1024, 1440]) for (const theme of ["light", "dark"]) {
  test(`Configure schema approval and rejection ${theme} ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 }); const model = await modelRoutes(page); await show(page, theme);
    const ai = page.getByRole("region", { name: "AI schema mapping" });
    await expect(ai).toContainText("No approved template selected"); expect(model.calls).toEqual([]);
    await selectTemplate(page);
    await page.getByRole("button", { name: "Load mapping template", exact: true }).click();
    await expect(page.getByText("Dataset 'contacts' or its original header order does not match.", { exact: true })).toBeVisible();
    await (await workspaceControl(page, page.getByRole("button", { name: "Run Validation", exact: true, includeHidden: true }))).click();
    await (await workspaceControl(page, page.getByRole("button", { name: "Edit contacts line 2 column email", exact: true, includeHidden: true }))).click();
    await page.getByRole("textbox", { name: "Proposed value for contacts line 2 column email", exact: true }).fill("PRIVATE_CORRECTED_VALUE@example.test");
    await page.getByRole("button", { name: "Apply correction", exact: true }).click();
    const report = page.getByRole("region", { name: "Validation results", exact: true, includeHidden: true });
    const beforeReport = await report.textContent();
    const history = page.locator("summary").filter({ hasText: /^Correction activity history/ });
    const beforeHistory = await history.textContent();
    await workspaceStep(page, "Configure");
    await request(page);
    await expect(ai).toContainText("Unverified suggestions"); await expect(ai).toContainText("Possible rename: full_name → name");
    const screenshotFolder = resolve("playwright/.cache/ai-schema-mapping"); mkdirSync(screenshotFolder, { recursive: true });
    // A full-page capture avoids the sticky workflow bar overlaying a tall mobile element crop.
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: resolve(screenshotFolder, `review-${theme}-${width}.png`), fullPage: true });
    await expect(page.getByLabel("Target for contacts.name", { exact: true })).toHaveValue("name");
    await expect(page.getByLabel("Type of contacts.email", { exact: true })).toHaveValue("");
    await page.getByRole("button", { name: "Reject suggestions", exact: true }).focus(); await page.keyboard.press("Enter");
    await expect(ai).toContainText("Suggestions dismissed"); expect(await report.textContent()).toBe(beforeReport); expect(await history.textContent()).toBe(beforeHistory);
    await expect(ai.getByRole("heading", { name: /Schema suggestions/ })).toBeFocused();
    await request(page); await expect(ai).toContainText("Unverified suggestions");
    await page.getByLabel("Accept suggestion for email", { exact: true }).focus(); await page.keyboard.press("Space");
    await page.getByLabel("Accept suggestion for name", { exact: true }).check();
    page.once("dialog", dialog => dialog.dismiss());
    await page.getByRole("button", { name: "Apply selected suggestions", exact: true }).click();
    await expect(page.getByLabel("Target for contacts.name", { exact: true })).toHaveValue("name"); expect(await report.textContent()).toBe(beforeReport);
    page.once("dialog", dialog => dialog.accept());
    await page.getByRole("button", { name: "Apply selected suggestions", exact: true }).focus(); await page.keyboard.press("Enter");
    await expect(page.getByLabel("Target for contacts.name", { exact: true })).toHaveValue("full_name");
    await expect(page.getByLabel("Type of contacts.email", { exact: true })).toHaveValue("email");
    await expect(page.getByLabel("Required contacts.email", { exact: true })).toBeChecked();
    await expect(page.getByLabel("Unique keys for contacts", { exact: true })).toHaveValue("email");
    await expect(report).toHaveCount(0); expect(await history.textContent()).toBe(beforeHistory);
    await workspaceStep(page, "Correct");
    const emailCell = page.getByRole("button", { name: "Edit contacts line 2 column email", exact: true }).locator("xpath=ancestor::td");
    await expect(emailCell).toContainText("PRIVATE_CORRECTED_VALUE");
    await page.getByRole("button", { name: "Undo correction", exact: true }).click();
    await expect(emailCell).not.toContainText("PRIVATE_CORRECTED_VALUE");
    await expect(emailCell).toContainText("PRIVATE_RAW_VALUE");
    await page.getByRole("button", { name: "Redo correction", exact: true }).click();
    await expect(emailCell).toContainText("PRIVATE_CORRECTED_VALUE");
    await workspaceStep(page, "Configure");
    expect(model.calls.join(" ")).not.toMatch(/PRIVATE_RAW_VALUE|PRIVATE_CORRECTED_VALUE|Synthetic Person|contacts|schema-project/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const folder = resolve("playwright/.cache/ai-schema-mapping"); mkdirSync(folder, { recursive: true });
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: resolve(folder, `configure-${theme}-${width}.png`), fullPage: true });
  });
}

// Explicit opt-in: unlike the cases above, no model route interception is installed.
if (process.env.DATAREHEARSAL_REAL_AI_BROWSER === "1") {
  test("LIVE mixed formats retain email/date and missing-value safeguards", async ({ page }) => {
    test.setTimeout(180_000); await page.setViewportSize({ width: 375, height: 1000 });
    const requests: string[] = [];
    page.on("request", request => { if (request.url().startsWith("http://127.0.0.1:11434/")) requests.push(request.postData() ?? ""); });
    await show(page, "dark", semanticProfileCsv, "students.csv"); await request(page);
    const ai = page.getByRole("region", { name: "AI schema mapping" });
    await expect(ai).toContainText(/Unverified suggestions|No safe schema changes recommended/, { timeout: 130_000 });
    await expect(ai.getByRole("alert")).toHaveCount(0);
    const email = ai.getByLabel("Accept suggestion for email", { exact: true }).locator("xpath=ancestor::li");
    const date = ai.getByLabel("Accept suggestion for enrolled_on", { exact: true }).locator("xpath=ancestor::li");
    if (await email.count()) await expect(email).not.toContainText("→ email");
    if (await date.count()) await expect(date).not.toContainText("→ date");
    await expect(ai).not.toContainText("primary candidate"); await expect(ai).not.toContainText("unique candidate");
    await expect(ai.getByRole("group", { name: "Local column evidence" }).locator("summary").filter({ hasText: "Missing: 1/3" })).toHaveCount(2);
    await expect(page.getByLabel("Type of students.email", { exact: true })).toHaveValue("");
    await expect(page.getByLabel("Type of students.enrolled_on", { exact: true })).toHaveValue("");
    const abstained = (await ai.textContent())!.includes("No safe schema changes recommended");
    console.log(JSON.stringify({ kind: "REAL_BROWSER_MIXED_SEMANTIC_PROFILE", modelOutcome: abstained ? "ABSTAINED_OR_UNCHANGED" : "SUPPORTED_CHANGES" }));
    expect(requests.length).toBeGreaterThanOrEqual(3); expect(requests.join(" ")).not.toMatch(/PRIVATE_|example\.test|2025-02-30|00123/);
  });
  test("LIVE eight-column contract displays supported suggestions with no invented template", async ({ page }) => {
    test.setTimeout(180_000); await page.setViewportSize({ width: 375, height: 1000 });
    const requests: string[] = [];
    page.on("request", request => { if (request.url().startsWith("http://127.0.0.1:11434/")) requests.push(request.postData() ?? ""); });
    await show(page, "light", contractSchemaCsv, "students.csv"); await request(page);
    const ai = page.getByRole("region", { name: "AI schema mapping" });
    await expect(ai).toContainText(/Unverified suggestions|No safe schema changes recommended/, { timeout: 130_000 });
    await expect(ai.getByRole("alert")).toHaveCount(0);
    const abstained = (await ai.textContent())!.includes("No safe schema changes recommended");
    console.log(JSON.stringify({ kind: "REAL_BROWSER_EIGHT_COLUMN_CONTRACT", modelOutcome: abstained ? "ABSTAINED_OR_UNCHANGED" : "SUPPORTED_CHANGES" }));
    expect(requests.length).toBeGreaterThanOrEqual(3); expect(requests.join(" ")).not.toContain("PRIVATE_");
    await expect(page.getByLabel("Type of students.student_no", { exact: true })).toHaveValue("");
    if (!abstained) {
      const email = ai.getByLabel("Accept suggestion for email_address", { exact: true });
      if (await email.count()) await expect(email.locator("xpath=ancestor::li")).toContainText("→ email");
      const identifier = ai.getByLabel("Accept suggestion for student_no", { exact: true });
      if (await identifier.count() && await identifier.isEnabled()) {
        await identifier.check();
        page.once("dialog", dialog => dialog.dismiss());
        await page.getByRole("button", { name: "Apply selected suggestions", exact: true }).click();
        await expect(page.getByLabel("Type of students.student_no", { exact: true })).toHaveValue("");
        page.once("dialog", dialog => dialog.accept());
        await page.getByRole("button", { name: "Apply selected suggestions", exact: true }).click();
        await expect(page.getByLabel("Type of students.student_no", { exact: true })).toHaveValue("integer");
      }
    }
  });
  test("LIVE local Ollama schema output is evidence-checked or abstained", async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 375, height: 1000 });
    const modelRequests: string[] = [];
    page.on("request", request => { if (request.url().startsWith("http://127.0.0.1:11434/")) modelRequests.push(request.postData() ?? ""); });
    await show(page); await selectTemplate(page); await request(page);
    const ai = page.getByRole("region", { name: "AI schema mapping" });
    await expect(ai).toContainText(/Unverified suggestions|No safe schema changes recommended/, { timeout: 130_000 });
    const abstained = (await ai.textContent())!.includes("No safe schema changes recommended");
    if (abstained) {
      for (const checkbox of await ai.getByLabel(/Accept suggestion/).all()) await expect(checkbox).toBeDisabled();
    } else {
      const email = ai.getByLabel("Accept suggestion for email", { exact: true }).locator("xpath=ancestor::li");
      if (await email.count()) await expect(email).toContainText(/→ email|Required:|unique key:/);
    }
    console.log(JSON.stringify({ kind: "REAL_BROWSER_SCHEMA_CHECK", modelOutcome: abstained ? "ABSTAINED_OR_UNCHANGED" : "SUPPORTED_CHANGES" }));
    expect(modelRequests.length).toBeGreaterThanOrEqual(3);
    expect(modelRequests.join(" ")).not.toMatch(/PRIVATE_RAW_VALUE|Synthetic Person|schema-project|contacts/);
    await page.getByRole("button", { name: "Reject suggestions", exact: true }).click();
    await expect(page.getByLabel("Target for contacts.email", { exact: true })).toHaveValue("email");
  });
  test("LIVE reported CSV keeps duplicate IDs and text columns safe", async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 375, height: 1000 });
    await show(page, "light", studentSchemaCsv, "students.csv"); await request(page);
    const ai = page.getByRole("region", { name: "AI schema mapping" });
    await expect(ai).toContainText(/Unverified suggestions|No safe schema changes recommended/, { timeout: 130_000 });
    await expect(ai).not.toContainText("primary candidate");
    await expect(ai).not.toContainText("unique candidate");
    await expect(ai).toContainText("name · Inferred: string");
    await expect(ai.getByText("2 rows share 1 repeated value; primary/unique-key suggestions are blocked.")).toHaveCount(2);
    const abstained = (await ai.textContent())!.includes("No safe schema changes recommended");
    console.log(JSON.stringify({ kind: "REAL_BROWSER_REPORTED_CSV_CHECK", modelOutcome: abstained ? "ABSTAINED_OR_UNCHANGED" : "SUPPORTED_CHANGES" }));
    await expect(page.getByLabel("Type of students.id", { exact: true })).toHaveValue("");
  });
}

for (const width of [320, 1440]) {
  test(`Unavailable, invalid, cancel and stale schema requests ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 }); const model = await modelRoutes(page); await show(page); await selectTemplate(page);
    const ai = page.getByRole("region", { name: "AI schema mapping" });
    model.mode("unavailable"); await request(page); await expect(ai.getByRole("alert")).toContainText("unavailable");
    await (await workspaceControl(page, page.getByRole("button", { name: "Run Validation", exact: true, includeHidden: true }))).click();
    await expect(page.getByRole("heading", { name: "Migration readiness: READY", exact: true })).toBeVisible();
    await workspaceStep(page, "Configure");
    model.mode("invalid"); await request(page); await expect(ai.getByRole("alert")).toContainText("invalid response");
    model.mode("hold"); await request(page); await expect.poll(() => Boolean(model.pending())).toBe(true);
    await page.getByRole("button", { name: "Cancel schema request", exact: true }).focus(); await page.keyboard.press("Enter");
    await expect(ai).toContainText("Request cancelled"); await expect(page.getByRole("button", { name: "Retry schema suggestions", exact: true })).toBeFocused(); await model.finish();
    await request(page); await expect.poll(() => Boolean(model.pending())).toBe(true);
    await page.getByLabel("Target for contacts.name", { exact: true }).fill("user_draft");
    await expect(ai).toContainText("Previous suggestions were discarded"); await model.finish();
    await expect(page.getByRole("button", { name: "Apply selected suggestions", exact: true })).toHaveCount(0);
    await expect(page.getByLabel("Target for contacts.name", { exact: true })).toHaveValue("user_draft");
    await page.getByRole("button", { name: "Cancel mapping for contacts", exact: true }).click();
    model.mode("success"); await request(page); await expect(ai).toContainText("Unverified suggestions");
  });
}
