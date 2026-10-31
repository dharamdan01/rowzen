import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium, expect, test } from "@playwright/test";
import { themeFixture } from "./helpers/theme-fixture";
import { workspaceStep } from "./helpers/workspace-navigation";

const folder=resolve("playwright/.cache/rowzen-final-polish-20261027/final");
for(const width of [320,375,390,768,1024,1280,1440])for(const theme of ["light","dark"] as const){
  test(`keyboard, no matches and 403/404 recovery ${theme} ${width}px`,async({page})=>{
    await page.setViewportSize({width,height:1000});await page.emulateMedia({colorScheme:theme,reducedMotion:"reduce"});
    let code=403;
    await page.route("**/api/projects/theme-project",route=>route.fulfill({status:code,contentType:"application/json",body:'{"error":"PRIVATE_ACCESS_DETAIL"}'}));
    await themeFixture(page,"projects",theme);
    const search=page.getByRole("searchbox",{name:"Search projects",exact:true});await search.focus();await page.keyboard.type("no_synthetic_match");
    await expect(page.getByText("No matching projects",{exact:true})).toBeVisible();await search.press("Control+A");await search.press("Backspace");
    const details=page.getByRole("button",{name:"Details for Customer migration",exact:true});await details.focus();await page.keyboard.press("Enter");
    const dialog=page.getByRole("dialog",{name:"Project details",exact:true});
    await expect(dialog.getByRole("alert")).toContainText("Could not load project");await expect(dialog).not.toContainText("PRIVATE_ACCESS_DETAIL");
    await expect(dialog.getByRole("link",{name:/workspace/i})).toHaveCount(0);
    code=404;await dialog.getByRole("button",{name:"Retry project details",exact:true}).focus();await page.keyboard.press("Enter");
    await expect(dialog.getByRole("alert")).toHaveText("This project is unavailable or you no longer have access.");
    await expect(dialog).not.toContainText("PRIVATE_ACCESS_DETAIL");
    await page.keyboard.press("Escape");await expect(details).toBeFocused();
    const account=page.getByRole("button",{name:"Account",exact:true});await account.focus();await page.keyboard.press("Enter");
    await page.getByRole("button",{name:"Sign Out",exact:true}).focus();await page.keyboard.press("Escape");await expect(account).toBeFocused();
    if(width<1024){const menu=page.getByRole("button",{name:"Navigation",exact:true});await menu.focus();await page.keyboard.press("Enter");
      const drawer=page.getByRole("dialog",{name:"Workspace navigation",exact:true}),close=drawer.getByRole("button",{name:"Close navigation",exact:true});
      await expect(close).toBeFocused();await page.keyboard.press("Shift+Tab");await expect(drawer.getByRole("link",{name:"Results",exact:true})).toBeFocused();await page.keyboard.press("Tab");await expect(close).toBeFocused();await page.keyboard.press("Escape");await expect(menu).toBeFocused();}
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  });
}

test("real preference persistence, cross-tab synchronization and System follow OS",async({page,context})=>{
  await page.emulateMedia({colorScheme:"light"});await page.goto("/login");
  const selector=page.getByRole("combobox",{name:"Color theme",exact:true});
  // focus() can silently do nothing on a control that is still disabled during hydration.
  await expect(selector).toBeEnabled();await selector.focus();await expect(selector).toBeFocused();
  await selector.selectOption("dark");await expect(selector).toBeFocused();
  await expect(page.getByText("Appearance saved on this device.",{exact:true})).toHaveCount(1);
  const second=await context.newPage();await second.goto("/rehearsal");await expect(second.locator("html")).toHaveAttribute("data-theme","dark");
  await second.getByRole("combobox",{name:"Color theme",exact:true}).selectOption("light");await expect(page.locator("html")).toHaveAttribute("data-theme","light");
  await selector.selectOption("system");await page.emulateMedia({colorScheme:"dark"});await expect(page.locator("html")).toHaveAttribute("data-theme","dark");
  await page.reload();await expect(page.locator("html")).toHaveAttribute("data-theme-preference","system");
  expect(await page.evaluate(()=>Object.keys(localStorage))).toEqual(["datarehearsal-theme"]);
});

test("native Chromium 200/400 percent zoom reflows every surface and retains workspace drafts",async({},testInfo)=>{
  test.setTimeout(240000);mkdirSync(folder,{recursive:true});
  const context=await chromium.launchPersistentContext(testInfo.outputPath("native-zoom-profile"),{channel:"chromium",headless:true,viewport:null,deviceScaleFactor:undefined,reducedMotion:"reduce",args:["--window-size=1302,1000"]});
  const measurements:unknown[]=[];
  try{
    const settings=context.pages()[0]||await context.newPage();await settings.goto("chrome://settings/appearance");const zoom=settings.locator("select#zoomLevel");await zoom.selectOption("1");
    const page=await context.newPage();const baseURL=process.env.PLAYWRIGHT_BASE_URL||"http://localhost:3000";await page.goto(`${baseURL}/login`);const base=await page.evaluate(()=>({width:innerWidth,dpr:devicePixelRatio}));
    const capture=async(name:string,factor:number,theme:string,extra:Record<string,unknown>={})=>{
      const m=await page.evaluate(()=>({width:innerWidth,dpr:devicePixelRatio,scale:visualViewport?.scale,overflow:document.documentElement.scrollWidth-innerWidth,theme:document.documentElement.dataset.theme}));
      expect(Math.abs(m.width-base.width/factor)).toBeLessThanOrEqual(1);expect(m.dpr).toBe(base.dpr*factor);expect(m.scale).toBe(1);expect(m.overflow).toBeLessThanOrEqual(1);expect(m.theme).toBe(theme);measurements.push({name,factor,...m,...extra});
      // Full-page capture resizes a native zoom window; CDP preserves physical viewport pixels.
      const session=await context.newCDPSession(page);const shot=await session.send("Page.captureScreenshot",{format:"png",captureBeyondViewport:false,fromSurface:true});await session.detach();
      writeFileSync(resolve(folder,`native-zoom-${factor*100}-${theme}-${name}.png`),Buffer.from(shot.data,"base64"));
    };
    await page.route("**/api/projects**",route=>route.fulfill({contentType:"application/json",body:JSON.stringify(route.request().url().includes("/templates")?{templates:[]}:{projects:[{id:"theme-project",name:"Synthetic zoom project"}]})}));
    for(const theme of ["light","dark"] as const){
      await zoom.selectOption("1");await page.emulateMedia({colorScheme:theme,reducedMotion:"reduce"});await page.goto(`${baseURL}/login`);await page.getByRole("combobox",{name:"Color theme",exact:true}).selectOption(theme);
      await expect(page.locator("html")).toHaveAttribute("data-theme-preference",theme);
      expect(await page.evaluate(()=>localStorage.getItem("datarehearsal-theme"))).toBe(theme);
      for(const factor of [2,4]){await zoom.selectOption(String(factor));
        for(const [name,path]of [["landing","/"],["login","/login"],["demo","/rehearsal"],["not-found","/rowzen-unmatched-zoom-page"]]){
          await page.goto(`${baseURL}${path}`);await expect(page.getByRole("heading",{level:1}).first()).toBeVisible();await page.bringToFront();await page.keyboard.press("Tab");expect(await page.locator(":focus-visible").count()).toBeGreaterThan(0);await capture(name,factor,theme);
        }
        for(const name of ["dashboard","projects","history","summary","loading","error"]){await themeFixture(page,name,theme);await capture(name,factor,theme);}
      }
      await themeFixture(page,"workspace",theme);await page.locator("#csv-files").setInputFiles({name:"records.csv",mimeType:"text/csv",buffer:Buffer.from("id,name\n1,Synthetic record")});
      for(const factor of [2,4]){await zoom.selectOption(String(factor));
        for(const step of ["Upload","Configure","Validate","Review","Correct","Export"]){await workspaceStep(page,step);if(step==="Validate")await page.getByRole("button",{name:"Run Validation",exact:true}).click();await capture(`workspace-${step.toLowerCase()}`,factor,theme);}
      }
      await workspaceStep(page,"Configure");const target=page.getByLabel("Target for records.name",{exact:true});await target.fill("retained_draft");const node=await target.elementHandle();
      for(const factor of [2,4]){await zoom.selectOption(String(factor));await expect.poll(()=>page.evaluate(()=>devicePixelRatio)).toBe(base.dpr*factor);await expect(target).toHaveValue("retained_draft");const retained=await target.evaluate((el,original)=>el===original,node);expect(retained).toBe(true);
        const menu=page.getByRole("button",{name:"Navigation",exact:true});await menu.focus();await page.keyboard.press("Enter");const drawer=page.getByRole("dialog",{name:"Workspace navigation",exact:true});await expect(drawer).toBeVisible();await page.keyboard.press("Escape");await expect(menu).toBeFocused();await capture("workspace-draft",factor,theme,{draftRetained:true,domNodeRetained:retained});}
    }
    await zoom.selectOption("1");
  }finally{writeFileSync(resolve(folder,"native-zoom.json"),JSON.stringify(measurements,null,2));await context.close();}
});
