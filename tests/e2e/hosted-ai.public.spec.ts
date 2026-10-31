import { build } from "esbuild";
import { expect, test, type Page, type Route } from "@playwright/test";
import { schemaAnswer, schemaWireAnswer } from "../fixtures/ai-schema-mapping";
import { groundedKeyResponse } from "../fixtures/ai-root-cause";

let script: string;
test("the real inference route denies anonymous requests before configuration or model access", async ({ request }) => {
  const response = await request.post("/api/ai/inference", { data: { feature: "smart-repair", consent: true, metadata: {} } });
  expect(response.status()).toBe(401); expect(await response.json()).toMatchObject({ code: "AUTH_REQUIRED" });
  expect(response.headers()["cache-control"]).toBe("no-store");
});
test.beforeAll(async () => {
  script = (await build({ bundle: true, write: false, minify: true, platform: "browser", format: "iife",
    define: { "process.env.NODE_ENV": '"production"', "process.env.NEXT_PUBLIC_AI_PROVIDER": '"groq"', "process.env": "{}" },
    stdin: { resolveDir: process.cwd(), loader: "tsx", contents: `
      import React,{useState} from 'react';import{createRoot}from'react-dom/client';
      import Mapping from './src/components/ai/schema-mapping-assistant';
      import Root from './src/components/ai/root-cause-analyzer';
      import Repair from './src/components/ai/smart-repair-planner';
      import{schemaFixture}from'./tests/fixtures/ai-schema-mapping';
      import{rootCauseFixture}from'./tests/fixtures/ai-root-cause';
      import{normalizationFixture}from'./tests/fixtures/repair-candidates';
      function Fixture(){const[m]=useState(schemaFixture);const[r,setRoot]=useState(rootCauseFixture);
        const[revision,setRevision]=useState({});const[action,setAction]=useState('None');
        const[repair]=useState(()=>{const f=normalizationFixture('yes');return{...f.getSnapshot(),revision:{},getVersion:f.owner.getVersion};});
        return <><button onClick={()=>{setRoot(rootCauseFixture());setRevision({});}}>Change snapshot</button><output aria-label="Test action">{action}</output>
        <Mapping configuration={m.configuration} datasetName="contacts" dataset={m.dataset} template={m.template} revision={revision} onApprove={()=>setAction('Mapping approved')}/>
        <Root report={r.verified.report} evidence={r.evidence} revision={revision} onClearFocus={()=>{}} onViewIssues={()=>setAction('Cited issues')} onLocate={()=>setAction('Locate')} canLocate={()=>true}/>
        <Repair source={repair} dataset="records" scopeKey="test" active manualEditing={false} onApprove={()=>setAction('Repair approved')} onLocate={()=>{}}/></>;
      }createRoot(document.querySelector('#fixture')).render(<React.StrictMode><Fixture/></React.StrictMode>);` },
  })).outputFiles[0].text;
});
async function mount(page: Page) {
  await page.goto("/");
  const styles = await page.evaluate(() => [...document.head.querySelectorAll('link[rel="stylesheet"],style')].map(node => node.outerHTML).join(""));
  await page.setContent(`<!doctype html><html data-theme="light"><head>${styles}</head><body><main style="max-width:1080px;margin:auto;padding:16px"><div id="fixture"></div></main></body></html>`);
  await page.addScriptTag({ content: script });
}
async function transport(page: Page) {
  const calls: { feature: string; metadata: Record<string, unknown> }[] = [], forbidden: string[] = [];
  let mode: "ok" | "rate" | "config" | "unauthorized" | "invalid" | "hold" = "ok", held: Route | undefined;
  const respond = async (route: Route) => {
    const body = route.request().postDataJSON(); calls.push(body);
    expect(body.consent).toBe(true);
    expect(JSON.stringify(body)).not.toMatch(/PRIVATE_|first@example|second@example|Alpha|Beta|rowNumber|expectedValue|Authorization|GROQ_API_KEY/);
    if (mode === "hold") { held = route; return; }
    const code = mode === "rate" ? "RATE_LIMITED" : mode === "config" ? "HOSTED_CONFIGURATION" : "AUTH_REQUIRED";
    if (["rate", "config", "unauthorized"].includes(mode)) return route.fulfill({ status: mode === "rate" ? 429 : mode === "config" ? 503 : 401, contentType: "application/json", body: JSON.stringify({ code, error: "DO_NOT_DISPLAY_PRIVATE_PROVIDER_ERROR" }) });
    const metadata = body.metadata;
    const result = mode === "invalid" ? { instructions: "FORGED_OUTPUT" } : body.feature === "schema-mapping" ? schemaWireAnswer(schemaAnswer)
      : body.feature === "root-cause" ? groundedKeyResponse
      : { schemaVersion: 1, requestId: metadata.requestId, target: metadata.target, outcome: "ACTIONABLE_CANDIDATE", strategyId: metadata.allowedStrategies[0] };
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ result }) });
  };
  await page.route("**/api/ai/inference", respond);
  for (const pattern of ["http://127.0.0.1:11434/**", "https://api.groq.com/**"]) await page.route(pattern, route => { forbidden.push(route.request().url()); return route.abort(); });
  return { calls, forbidden, mode: (value: typeof mode) => { mode = value; }, finish: async () => { await held?.fulfill({ contentType: "application/json", body: JSON.stringify({ result: groundedKeyResponse }) }).catch(() => {}); } };
}
test("hosted consent and the three real feature UIs use the same-origin adapter; repair still requires preview and approval", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 375, height: 1000 }); const wire = await transport(page); await mount(page);
  await expect(page.getByRole("button", { name: "Suggest schema settings", exact: true })).toBeDisabled();
  await page.getByRole("region", { name: "AI schema mapping", exact: true }).locator("summary").filter({ hasText: "Processing details" }).click();
  await expect(page.getByText(/through Rowzen's server to Groq/).first()).toBeVisible(); expect(wire.calls).toHaveLength(0);
  await page.getByLabel("Allow hosted schema metadata request").check(); await page.getByRole("button", { name: "Suggest schema settings", exact: true }).click();
  await expect(page.getByRole("region", { name: "AI schema mapping" })).toContainText("Unverified suggestions");
  await page.getByLabel("Accept suggestion for email", { exact: true }).check(); page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "Apply selected suggestions" }).click(); await expect(page.getByLabel("Test action")).toHaveText("Mapping approved");
  await page.getByLabel("Allow hosted issue analysis").check(); await page.getByRole("button", { name: "Explain Issues with AI", exact: true }).click();
  await expect(page.getByLabel("AI issue hypotheses")).toContainText("Needs investigation");
  await page.getByRole("button", { name: "View cited issues (2)" }).click(); await expect(page.getByLabel("Test action")).toHaveText("Cited issues");
  await page.getByRole("button", { name: "Suggest fixes with AI" }).click();
  await page.getByLabel("Source boolean convention").selectOption("YES_NO"); await page.getByLabel("Allow hosted repair strategy request").check();
  await page.getByRole("button", { name: "Suggest fix", exact: true }).click();
  await expect(page.getByRole("region", { name: "Proposed repair value", exact: true })).toHaveText("true");
  await expect(page.getByRole("button", { name: "Apply suggested correction" })).toHaveCount(0);
  await page.getByRole("button", { name: "Preview fix" }).click();
  await expect(page.getByRole("region", { name: "Verified repair preview" })).toContainText("Resolved findings: 1");
  await page.getByRole("region", { name: "Verified repair preview", exact: true }).screenshot({ path: testInfo.outputPath("hosted-repair-preview.png") });
  page.once("dialog", dialog => dialog.dismiss()); await page.getByRole("button", { name: "Apply suggested correction" }).click();
  await expect(page.getByLabel("Test action")).toHaveText("Cited issues");
  page.once("dialog", dialog => dialog.accept()); await page.getByRole("button", { name: "Apply suggested correction" }).click();
  await expect(page.getByLabel("Test action")).toHaveText("Repair approved");
  expect(wire.calls.map(call => call.feature)).toEqual(["schema-mapping", "root-cause", "smart-repair"]); expect(wire.forbidden).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
for (const mode of ["rate", "config", "unauthorized", "invalid"] as const) test(`hosted ${mode} is a real error with manual fallback and no fabricated explanation`, async ({ page }) => {
  const wire = await transport(page); wire.mode(mode); await mount(page);
  await page.getByLabel("Allow hosted issue analysis").check(); await page.getByRole("button", { name: "Explain Issues with AI", exact: true }).click();
  const error = page.getByRole("region", { name: "Explain issues with AI", exact: true }).getByRole("alert");
  await expect(error).toBeVisible(); await expect(error).not.toContainText("DO_NOT_DISPLAY");
  await expect(page.getByLabel("AI issue hypotheses")).toHaveCount(0); await expect(page.getByRole("button", { name: "Retry hosted AI" })).toBeVisible();
  expect(wire.calls).toHaveLength(1); expect(wire.forbidden).toEqual([]);
});
test("cancel and snapshot changes never accept a late hosted explanation", async ({ page }) => {
  const wire = await transport(page); wire.mode("hold"); await mount(page);
  await page.getByLabel("Allow hosted issue analysis").check(); await page.getByRole("button", { name: "Explain Issues with AI", exact: true }).click();
  await expect(page.getByRole("button", { name: "Cancel AI request" })).toBeVisible(); await page.getByRole("button", { name: "Cancel AI request" }).click();
  await expect(page.getByText("Hosted AI request cancelled. Your data is unchanged.")).toBeVisible();
  await wire.finish(); await expect(page.getByLabel("AI issue hypotheses")).toHaveCount(0);
  wire.mode("ok"); await page.getByRole("button", { name: "Retry hosted AI" }).click(); await expect(page.getByLabel("AI issue hypotheses")).toBeVisible();
  await page.getByRole("button", { name: "Change snapshot" }).click(); await expect(page.getByLabel("AI issue hypotheses")).toHaveCount(0);
  await expect(page.getByLabel("Allow hosted issue analysis")).not.toBeChecked();
});
