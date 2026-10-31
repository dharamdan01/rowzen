import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { themeFixture } from "./helpers/theme-fixture";
import { workspaceStep } from "./helpers/workspace-navigation";

const phase = process.env.ROWZEN_POLISH_PHASE === "baseline" ? "baseline" : "final";
const folder = resolve(`playwright/.cache/rowzen-final-polish-20261027/${phase}`);
type RecordValue = Awaited<ReturnType<typeof inspect>>;
async function inspect(page: Page, surface: string, kind: "route" | "component-fixture", elapsed: number) {
  await page.evaluate(() => document.fonts.ready);
  const session = await page.context().newCDPSession(page);
  const tree = await session.send("Accessibility.getFullAXTree"); await session.detach();
  const unnamed = tree.nodes.filter(node => !node.ignored && ["button", "link", "combobox", "textbox", "searchbox"].includes(String(node.role?.value)) && !String(node.name?.value ?? "").trim()).map(node => String(node.role?.value));
  return page.evaluate(({surface, kind, elapsed, unnamed}) => {
    const visible = (node: Element) => node.getClientRects().length > 0 && getComputedStyle(node).visibility !== "hidden";
    const ids = [...document.querySelectorAll("[id]")].map(node => node.id), duplicateIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    const paint = performance.getEntriesByType("paint").find(entry => entry.name === "first-contentful-paint");
    const audit = (window as unknown as {rowzenAudit?: {lcp: number; cls: number; longTasks: number[]}}).rowzenAudit;
    return {surface, kind, elapsedMs: elapsed, width: innerWidth, dpr: devicePixelRatio, theme: document.documentElement.dataset.theme, title: document.title, lang: document.documentElement.lang,
      overflowPx: Math.max(0, document.documentElement.scrollWidth - innerWidth), mains: [...document.querySelectorAll("main")].filter(visible).length,
      visibleHeadings: [...document.querySelectorAll("h1,h2,h3,h4")].filter(visible).map(node => node.tagName), duplicateIds, unnamedControls: unnamed,
      imagesMissingAlt: document.querySelectorAll("img:not([alt])").length, tables: [...document.querySelectorAll("table")].filter(visible).length,
      domNodes: document.querySelectorAll("*").length, fcpMs: kind === "route" ? paint?.startTime ?? null : null, lcpMs: kind === "route" ? audit?.lcp ?? null : null,
      cls: kind === "route" ? audit?.cls ?? null : null, longTaskMs: audit?.longTasks ?? [], navigationMs: kind === "route" ? nav?.duration ?? null : null,
      activeAnimations: document.getAnimations().filter(animation => animation.playState === "running").length, reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
      bodyBackground: getComputedStyle(document.body).backgroundColor};
  }, {surface, kind, elapsed, unnamed});
}
async function record(page: Page, surface: string, kind: "route" | "component-fixture", started: number, records: RecordValue[], width: number, theme: string) {
  const entry = await inspect(page, surface, kind, Date.now() - started); records.push(entry);
  expect(entry.width, `${surface}: measured viewport`).toBe(width);
  if (phase === "final" || width === 320 && theme === "light" || width === 1440 && theme === "dark") {
    await page.evaluate(() => scrollTo(0,0)); await page.screenshot({path: resolve(folder, `${surface}-${theme}-${width}.png`), fullPage: true});
  }
  if (phase === "final") {
    expect(entry.overflowPx, `${surface}: page overflow`).toBeLessThanOrEqual(1);
    expect(entry.mains, `${surface}: main landmark`).toBe(1); expect(entry.lang).toBe("en");
    expect(entry.unnamedControls, `${surface}: unnamed AX controls`).toEqual([]); expect(entry.duplicateIds, `${surface}: duplicate IDs`).toEqual([]);
    expect(entry.imagesMissingAlt).toBe(0); expect(entry.reducedMotion).toBe(true); expect(entry.activeAnimations).toBe(0);
    if (kind === "route") expect(entry.title).toContain("Rowzen");
  }
}
for (const width of [320,375,390,768,1024,1280,1440]) for (const theme of ["light","dark"] as const) {
  test(`route and mounted-page audit ${theme} ${width}px`, async ({page}) => {
    test.setTimeout(180000); await page.setViewportSize({width,height:1000}); mkdirSync(folder,{recursive:true}); const records: RecordValue[] = [], errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => {if(message.type() === "error" && /hydration|did not match|server rendering|Suspense boundary/i.test(message.text())) errors.push(message.text());});
    await page.emulateMedia({colorScheme:theme,reducedMotion:"reduce"});
    await page.addInitScript(preference => {
      localStorage.setItem("datarehearsal-theme",preference);
      const audit = {lcp:0,cls:0,longTasks:[] as number[]}; Object.assign(window,{rowzenAudit:audit});
      for (const type of ["largest-contentful-paint","layout-shift","longtask"]) try {new PerformanceObserver(list=>{for(const entry of list.getEntries()){
        if(type==="largest-contentful-paint")audit.lcp=entry.startTime;
        if(type==="layout-shift"&&!(entry as PerformanceEntry & {hadRecentInput:boolean}).hadRecentInput)audit.cls+=(entry as PerformanceEntry & {value:number}).value;
        if(type==="longtask")audit.longTasks.push(entry.duration);
      }}).observe({type,buffered:true});}catch{}
    },theme);
    try {
      for (const [surface,url] of [["landing","/"],["login","/login"],["demo","/rehearsal"],["not-found","/rowzen-unmatched-audit-page"]]) {
        const started=Date.now(); await page.goto(url); await expect(page.getByRole("heading",{level:1}).first()).toBeVisible(); await record(page,surface,"route",started,records,width,theme);
      }
      await page.route("**/api/projects**", route=>route.fulfill({contentType:"application/json",body:JSON.stringify(route.request().url().includes("/templates")?{templates:[]}:route.request().url().endsWith("/runs")?{runs:[]}:{projects:[{id:"theme-project",name:"Synthetic audit project"}]})}));
      for (const surface of ["dashboard","projects","history","summary","loading","error"]) {
        const started=Date.now(); await themeFixture(page,surface,theme); await record(page,surface,"component-fixture",started,records,width,theme);
      }
      let started=Date.now(); await themeFixture(page,"workspace",theme);
      await page.locator("#csv-files").setInputFiles([
        {name:"students.csv",mimeType:"text/csv",buffer:Buffer.from("id,name,department_id\n1,Synthetic A,10\n2,Synthetic B,99")},
        {name:"departments.csv",mimeType:"text/csv",buffer:Buffer.from("id,name\n10,Synthetic parent")},
      ]);
      await record(page,"workspace-upload","component-fixture",started,records,width,theme);
      for (const step of ["Configure","Validate"]) {started=Date.now();await workspaceStep(page,step);await record(page,`workspace-${step.toLowerCase()}`,"component-fixture",started,records,width,theme);}
      await page.getByRole("button",{name:"Run Validation",exact:true}).click();
      for (const step of ["Review","Correct","Export"]) {started=Date.now();await workspaceStep(page,step);await record(page,`workspace-${step.toLowerCase()}`,"component-fixture",started,records,width,theme);}
      expect(errors).toEqual([]);
    } finally {writeFileSync(resolve(folder,`audit-${theme}-${width}.json`),JSON.stringify({phase,width,theme,records,errors},null,2));}
  });
}


test("appearance persistence failure is measured without changing workspace data", async ({page}) => {
  mkdirSync(folder,{recursive:true});
  await page.addInitScript(() => Object.defineProperty(Storage.prototype,"setItem",{configurable:true,value(){throw new DOMException("Synthetic blocked preference storage","SecurityError");}}));
  await page.goto("/login");
  const selector=page.getByRole("combobox",{name:"Color theme",exact:true});await selector.selectOption("dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme","dark");
  const warned=await page.getByText("Appearance works in this tab. It could not be saved on this device.",{exact:true}).isVisible();
  await page.reload(); const after=await page.locator("html").getAttribute("data-theme-preference");
  writeFileSync(resolve(folder,"storage-failure.json"),JSON.stringify({phase,visibleFailureNotice:warned,preferenceAfterReload:after},null,2));
  if(phase==="final")expect(warned).toBe(true);
});
