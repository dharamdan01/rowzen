import { build } from "esbuild";
import { expect, test, type Page, type Route } from "@playwright/test";
import { approvedLocalModels } from "../../src/lib/ai/providers/ollama";
import { schemaAnswer, schemaWireAnswer } from "../fixtures/ai-schema-mapping";
import { groundedKeyResponse } from "../fixtures/ai-root-cause";

let script: string;
test.beforeAll(async () => {
  script = (await build({ bundle: true, write: false, platform: "browser", format: "iife", minify: true,
    define: { "process.env.NODE_ENV": '"production"', "process.env": "{}" },
    stdin: { resolveDir: process.cwd(), loader: "tsx", contents: `
      import React,{useState} from 'react';import{createRoot}from'react-dom/client';
      import Mapping from './src/components/ai/schema-mapping-assistant';
      import Analyzer from './src/components/ai/root-cause-analyzer';
      import Repair from './src/components/ai/smart-repair-planner';
      import{schemaFixture}from'./tests/fixtures/ai-schema-mapping';
      import{rootCauseFixture}from'./tests/fixtures/ai-root-cause';
      import{normalizationFixture}from'./tests/fixtures/repair-candidates';
      function Fixture(){
        const[mapping]=useState(schemaFixture);const[root,setRoot]=useState(()=>rootCauseFixture(window.potential?'potential':'key'));
        const[revision,setRevision]=useState({});const[action,setAction]=useState('None');
        const[repair]=useState(()=>{const fixture=normalizationFixture('yes');return{...fixture.getSnapshot(),revision:{},getVersion:fixture.owner.getVersion};});
        return <><div className="mb-4 flex flex-wrap gap-2"><button onClick={()=>{setRevision({});setRoot(rootCauseFixture(window.potential?'potential':'key'));}}>Change fixture revision</button><output aria-label="Fixture navigation">{action}</output></div>
          {window.kind==='mapping'?<Mapping configuration={mapping.configuration} datasetName="contacts" dataset={mapping.dataset} template={mapping.template} revision={revision} onApprove={()=>setAction('Approved mapping')}/>
          :window.kind==='repair'?<Repair source={repair} dataset="records" scopeKey="fixture" active manualEditing={false} onApprove={()=>setAction('Approved repair')} onLocate={()=>setAction('Locate finding')}/>
          :<Analyzer report={root.verified.report} evidence={root.evidence} revision={revision} onClearFocus={()=>{}} onViewIssues={ids=>setAction('Issues: '+ids.length)} onLocate={()=>setAction('Locate finding')} canLocate={()=>true} onViewDependencies={()=>setAction('Dependency graph')}/>}</>;
      }createRoot(document.querySelector('#fixture')).render(<React.StrictMode><Fixture/></React.StrictMode>);
    ` },
  })).outputFiles[0].text;
});

async function mount(page: Page, kind: "mapping" | "analysis" | "repair", width = 375, theme = "light", potential = false) {
  await page.setViewportSize({ width, height: 1000 });
  await page.emulateMedia({ colorScheme: theme as "light" | "dark", reducedMotion: "reduce" });
  await page.goto("/");
  const shell = await page.evaluate(() => ({ styles: [...document.head.querySelectorAll('link[rel="stylesheet"],style')].map(node => node.outerHTML).join(""), font: document.documentElement.className }));
  await page.setContent(`<!doctype html><html lang="en" class="${shell.font}" data-theme="${theme}"><head>${shell.styles}</head><body><main style="padding:16px;max-width:1080px;margin:auto;min-width:0"><div id="fixture"></div></main></body></html>`);
  await page.evaluate(values => Object.assign(window, values), { kind, potential });
  await page.addScriptTag({ content: script });
}

async function transport(page: Page, kind: "mapping" | "analysis" | "repair", potential = false) {
  let mode: "ok" | "hold" | "unavailable" | "empty" = "ok", held: Route | undefined;
  const bodies: string[] = [];
  let repairResponse: unknown;
  const response = () => kind === "repair" ? repairResponse : kind === "mapping" ? schemaWireAnswer(schemaAnswer) : mode === "empty" ? { schemaVersion: 1, abstained: true, explanations: [] } : { ...groundedKeyResponse, explanations: groundedKeyResponse.explanations.map(item => ({ ...item, includePotentialImpact: potential })) };
  const reply = () => JSON.stringify({ model: "qwen2.5:0.5b", done: true, done_reason: "stop", message: { role: "assistant", content: JSON.stringify(response()) } });
  await page.route("http://127.0.0.1:11434/**", async route => {
    const path = new URL(route.request().url()).pathname;
    const headers = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" };
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    if (mode === "unavailable") return route.abort("connectionrefused");
    if (path === "/api/tags") return route.fulfill({ headers, body: JSON.stringify({ models: [{ name: "qwen2.5:0.5b", digest: approvedLocalModels["qwen2.5:0.5b"] }] }) });
    if (path === "/api/show") return route.fulfill({ headers, body: '{"details":{"format":"gguf"}}' });
    bodies.push(route.request().postData()!);
    if (kind === "repair") {
      const wire = JSON.parse(JSON.parse(route.request().postData()!).messages[1].content);
      const envelope = { schemaVersion: 1, requestId: wire.requestId, target: wire.target };
      repairResponse = wire.allowedStrategies.length ? { ...envelope, outcome: "ACTIONABLE_CANDIDATE", strategyId: wire.allowedStrategies[0] } : { ...envelope, outcome: "REQUIRES_USER_INPUT", input: wire.inputRequests[0] };
    }
    if (mode === "hold") { held = route; return; }
    return route.fulfill({ headers, body: reply() });
  });
  return { bodies, mode(next: typeof mode) { mode = next; }, held: () => Boolean(held), async finish() { const route = held; held = undefined; await route?.fulfill({ contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: reply() }).catch(() => {}); } };
}

for (const kind of ["mapping", "analysis", "repair"] as const) for (const width of [320, 375, 768, 1024, 1440]) for (const theme of ["light", "dark"]) {
  test(`${kind} loading and review ${theme} ${width}px`, async ({ page }, testInfo) => {
    const model = await transport(page, kind); await mount(page, kind, width, theme);
    const panel = page.getByRole("region", { name: kind === "mapping" ? "AI schema mapping" : kind === "analysis" ? "Explain issues with AI" : "AI repair planner", exact: true });
    if (kind === "repair") { await panel.getByRole("button", { name: "Suggest fixes with AI", exact: true }).click(); await panel.getByLabel("Source boolean convention", { exact: true }).selectOption("YES_NO"); }
    const consent = panel.getByLabel(kind === "mapping" ? "Allow local schema metadata request" : kind === "analysis" ? "Allow local issue analysis" : "Allow local repair strategy request", { exact: true });
    const action = panel.getByRole("button", { name: kind === "mapping" ? "Suggest schema settings" : kind === "analysis" ? "Explain Issues with AI" : "Suggest fix", exact: true });
    await expect(action).toBeDisabled(); expect(model.bodies).toEqual([]);
    const processing = panel.locator("summary").filter({ hasText: "Processing details" });
    const connection = panel.getByText(/Requests go to Ollama on this device/);
    await expect(connection).toBeHidden();
    await processing.focus(); await processing.press("Enter");
    await expect(connection).toBeVisible(); await expect(connection).toContainText("no cloud fallback");
    await processing.press("Enter"); await expect(connection).toBeHidden();
    await consent.check(); model.mode("hold"); await action.click(); await expect.poll(model.held).toBe(true);
    const loading = panel.getByRole("button", { name: kind === "mapping" ? "Analyzing mappings…" : kind === "analysis" ? "Analyzing issues…" : "Finding repair options…", exact: true });
    await expect(loading).toBeDisabled(); await expect(loading).toHaveAttribute("aria-busy", "true");
    await expect(loading.locator("svg")).toHaveCSS("animation-name", "none");
    expect(model.bodies).toHaveLength(1);
    await panel.screenshot({ path: testInfo.outputPath(`${kind}-loading-${theme}-${width}.png`) });
    model.mode("ok"); await model.finish();
    if (kind === "mapping") {
      const select = panel.getByLabel("Accept suggestion for email", { exact: true }); await expect(select).toBeVisible();
      await expect(panel.getByRole("button", { name: "Apply selected suggestions", exact: true })).toBeDisabled();
      await select.check();
      await expect(panel.getByRole("button", { name: "Apply selected suggestions", exact: true })).toBeEnabled();
      await expect(panel.getByText("Suggested field", { exact: true })).toBeVisible();
      const why = panel.locator("summary").filter({ hasText: "Why this suggestion?" });
      await why.focus(); await why.press("Enter"); await expect(panel.getByText(/^Basis:/)).toBeVisible();
      await panel.getByRole("button", { name: "View evidence for email", exact: true }).click();
      await expect(panel.getByLabel("Evidence details for email", { exact: true })).toBeFocused();
    } else if (kind === "analysis") {
      await expect(panel.getByText("Possible cause · AI hypothesis", { exact: true })).toBeVisible();
      await expect(panel.getByText("Verified findings:", { exact: true })).toBeVisible();
      await panel.getByRole("button", { name: /View finding/ }).first().click();
      await expect(page.getByLabel("Fixture navigation")).toHaveText("Issues: 1");
      await panel.getByRole("button", { name: "Locate first cited cell", exact: true }).click();
      await expect(page.getByLabel("Fixture navigation")).toHaveText("Locate finding");
    } else {
      const stages = panel.getByRole("list", { name: "Repair review stages", exact: true });
      await expect(stages.locator('[aria-current="step"]')).toContainText("What-if preview");
      await expect(panel.getByText("Step 2 of 3 · What-if preview", { exact: true })).toBeInViewport();
      await expect(panel.getByRole("region", { name: "Original / current repair value", exact: true })).toHaveText("yes");
      await expect(panel.getByRole("region", { name: "Proposed repair value", exact: true })).toHaveText("true");
      await expect(panel.getByRole("button", { name: "Apply suggested correction", exact: true })).toHaveCount(0);
      await panel.screenshot({ path: testInfo.outputPath(`repair-suggestion-${theme}-${width}.png`) });
      await panel.getByRole("button", { name: "Preview fix", exact: true }).click();
      await expect(stages.locator('[aria-current="step"]')).toContainText("Apply correction");
      await expect(panel.getByRole("region", { name: "Verified repair preview", exact: true })).toBeFocused();
      await expect(panel.getByText("Step 3 of 3 · Apply correction", { exact: true })).toBeInViewport();
      await expect(panel).toContainText("Resolved findings: 1"); await expect(panel).toContainText("Introduced findings: 0");
      await expect(panel).toContainText("Other metrics are unchanged");
      const apply = panel.getByRole("button", { name: "Apply suggested correction", exact: true });
      page.once("dialog", dialog => dialog.dismiss()); await apply.click();
      await expect(page.getByLabel("Fixture navigation")).toHaveText("None");
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await panel.screenshot({ path: testInfo.outputPath(`${kind}-review-${theme}-${width}.png`) });
    expect(model.bodies.join(" ")).not.toMatch(/PRIVATE|first@example|Alpha|Beta/);
  });
}

test("analysis cancellation, unavailable, retry, empty and stale states preserve navigation", async ({ page }) => {
  const model = await transport(page, "analysis"); await mount(page, "analysis");
  const panel = page.getByRole("region", { name: "Explain issues with AI", exact: true });
  await panel.getByLabel("Allow local issue analysis").check(); model.mode("hold");
  await panel.getByRole("button", { name: "Explain Issues with AI", exact: true }).click();
  await expect.poll(model.held).toBe(true); await panel.getByRole("button", { name: "Cancel AI request" }).click();
  await expect(panel.getByRole("button", { name: "Retry local AI" })).toBeFocused();
  model.mode("ok"); await model.finish(); await expect(panel.getByText("Verified findings:", { exact: true })).toHaveCount(0);
  model.mode("unavailable"); await panel.getByRole("button", { name: "Retry local AI" }).click();
  await expect(panel.getByRole("alert")).toContainText("unavailable");
  model.mode("empty"); await panel.getByRole("button", { name: "Retry local AI" }).click();
  await expect(panel.getByText(/No supported explanation was returned/)).toBeVisible();
  model.mode("ok"); await panel.getByRole("button", { name: "Explain Issues with AI", exact: true }).click();
  await expect(panel.getByText("Verified findings:", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Change fixture revision" }).click();
  await expect(panel.getByText(/workspace changed/)).toBeVisible();
  await expect(panel.getByText("Verified findings:", { exact: true })).toHaveCount(0);
  await expect(panel.getByLabel("Allow local issue analysis")).not.toBeChecked();
});

test("analysis shows only evidence-backed potential datasets and opens the existing graph action", async ({ page }, testInfo) => {
  await transport(page, "analysis", true); await mount(page, "analysis", 375, "dark", true);
  const panel = page.getByRole("region", { name: "Explain issues with AI", exact: true });
  await panel.getByLabel("Allow local issue analysis").check(); await panel.getByRole("button", { name: "Explain Issues with AI", exact: true }).click();
  await expect(panel.getByText("Potential downstream impact:", { exact: true })).toBeVisible();
  await expect(panel.getByText(/affected records are unknown/)).toBeVisible();
  await panel.getByRole("button", { name: "View dependency graph", exact: true }).click();
  await expect(page.getByLabel("Fixture navigation")).toHaveText("Dependency graph");
  await panel.screenshot({ path: testInfo.outputPath("analysis-potential-dark-375.png") });
});

test("repair required-input action opens the existing settings and obtains fresh consent", async ({ page }) => {
  await transport(page, "repair"); await mount(page, "repair");
  const panel = page.getByRole("region", { name: "AI repair planner", exact: true });
  await panel.getByRole("button", { name: "Suggest fixes with AI", exact: true }).click();
  await panel.getByLabel("Allow local repair strategy request").check();
  await panel.getByRole("button", { name: "Suggest fix", exact: true }).click();
  await expect(panel.getByText(/Confirm the source boolean convention/)).toBeVisible();
  await expect(panel.getByRole("note", { name: "Repair availability", exact: true })).toContainText("Input required");
  await expect(panel.getByRole("list", { name: "Repair review stages", exact: true }).locator('[aria-current="step"]')).toContainText("Suggested repair");
  await expect(panel.getByRole("button", { name: "Apply suggested correction", exact: true })).toHaveCount(0);
  await panel.getByRole("button", { name: "Review required input", exact: true }).click();
  await expect(panel.locator("summary").filter({ hasText: "Request settings" })).toBeFocused();
  await panel.getByLabel("Source boolean convention", { exact: true }).selectOption("YES_NO");
  await expect(panel.getByRole("group", { name: "Selected repair context", exact: true }).getByText("Confirmed boolean: yes / no", { exact: true })).toBeVisible();
  await expect(panel.getByLabel("Allow local repair strategy request")).not.toBeChecked();
  await panel.getByLabel("Allow local repair strategy request").check();
  await panel.getByRole("button", { name: "Suggest fix", exact: true }).click();
  await expect(panel.getByRole("button", { name: "Preview fix", exact: true })).toBeVisible();
});

for (const theme of ["light", "dark"]) test(`repair mobile metrics support keyboard scrolling and text contrast ${theme}`, async ({ page }) => {
  await transport(page, "repair"); await mount(page, "repair", 320, theme);
  const panel = page.getByRole("region", { name: "AI repair planner", exact: true });
  await panel.getByRole("button", { name: "Suggest fixes with AI", exact: true }).click();
  await panel.getByLabel("Source boolean convention", { exact: true }).selectOption("YES_NO");
  await panel.getByLabel("Allow local repair strategy request").check();
  await panel.getByRole("button", { name: "Suggest fix", exact: true }).click();
  await panel.getByRole("button", { name: "Preview fix", exact: true }).click();
  const metrics = panel.getByRole("region", { name: "What-if before and predicted metrics", exact: true });
  expect(await metrics.evaluate(node => node.scrollWidth > node.clientWidth)).toBe(true);
  await metrics.focus(); await metrics.press("ArrowRight");
  await expect.poll(() => metrics.evaluate(node => node.scrollLeft)).toBeGreaterThan(0);
  const ratios = await panel.evaluate(root => {
    const luminance = (color: string) => color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
    return [...root.querySelectorAll<HTMLElement>("p, dd, dt, th, td, summary, h3, h4")].filter(node => node.getClientRects().length).map(node => {
      let parent: HTMLElement | null = node;
      while (parent && ["transparent", "rgba(0, 0, 0, 0)"].includes(getComputedStyle(parent).backgroundColor)) parent = parent.parentElement;
      const a = luminance(getComputedStyle(node).color), b = luminance(getComputedStyle(parent!).backgroundColor);
      return { text: node.textContent!.slice(0, 50), ratio: (Math.max(a, b) + .05) / (Math.min(a, b) + .05) };
    });
  });
  for (const item of ratios) expect(item.ratio, item.text).toBeGreaterThanOrEqual(4.5);
});
