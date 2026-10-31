import { workspaceControl } from "./helpers/workspace-navigation";
import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { themeFixture } from "./helpers/theme-fixture";
const folder=resolve("playwright/.cache/phase9-theme");
function shot(name:string){mkdirSync(folder,{recursive:true});return resolve(folder,name);}
function ratio(a:string,b:string){
  const l=(value:string)=>{const v=value.match(/[\d.]+/g)!.slice(0,3).map(Number).map(n=>n/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4);return .2126*v[0]+.7152*v[1]+.0722*v[2];};
  const x=l(a),y=l(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05);
}
for(const width of [320,375,390,768,1024,1440])for(const theme of ["light","dark"]as const){
 test(`application presenters and workspace ${theme} at ${width}px`,async({page})=>{
  test.setTimeout(90000);await page.setViewportSize({width,height:1000});await page.emulateMedia({colorScheme:theme});
  const writes:string[]=[];
  await page.route('**/api/projects**',route=>{
   if(route.request().method()!=='GET'){writes.push(route.request().postData()??'');return route.fulfill({status:400,body:'{}'});}
   return route.fulfill({contentType:'application/json',body:JSON.stringify(route.request().url().includes('/templates')?{templates:[]}:{projects:[{id:'theme-project',name:'Customer migration'}]})});
  });
  for(const kind of ['dashboard','projects','history','summary']){
   await themeFixture(page,kind,theme);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   const selector=page.locator('select[title="Color theme"]:visible');await expect(selector).toHaveValue(theme);await (await workspaceControl(page, selector)).focus();await expect(selector).toBeFocused();
   if(width<1024){const menu=page.locator('button[aria-controls="mobile-dashboard-navigation"]');await (await workspaceControl(page, menu)).click();await expect(page.getByRole('navigation',{name:'Mobile dashboard navigation'})).toBeVisible();await page.keyboard.press('Escape');await expect(page.getByRole('navigation',{name:'Mobile dashboard navigation'})).not.toBeVisible();}
   await page.screenshot({path:shot(`${kind}-${theme}-${width}.png`),fullPage:true});
   if(kind==='projects'){
    await (await workspaceControl(page, page.getByRole('button',{ includeHidden: true, name:'New project',exact:true}))).click();const dialog=page.getByRole('dialog', { name: 'New project', exact: true, includeHidden: true });await expect(dialog.getByLabel('Project name')).toBeFocused();
    await page.screenshot({path:shot(`project-dialog-${theme}-${width}.png`)});await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);
   }
   if(kind==='history'){
    const region=page.getByRole('region',{ includeHidden: true, name:'Saved validation reports',exact:true});await (await workspaceControl(page, region)).focus();await expect(region).toBeFocused();
    if(width<768){await (await workspaceControl(page, region)).press('ArrowRight');await expect.poll(()=>region.evaluate(n=>n.scrollLeft)).toBeGreaterThan(0);}
   }
  }
  await themeFixture(page,'workspace',theme);
  await (await workspaceControl(page, page.locator('#csv-files'))).setInputFiles([
   {name:'students.csv',mimeType:'text/csv',buffer:Buffer.from('id,name,department_id\n1,Ali,10\n2,Sara,20\n3,Ahmed,99\n3,Bilal,10')},
   {name:'departments.csv',mimeType:'text/csv',buffer:Buffer.from('id,name\n10,Engineering\n20,Science')},
  ]);
  await expect(page.getByRole('button',{name:'Run Validation',exact:true,includeHidden:true})).toBeEnabled();
  await page.screenshot({path:shot(`upload-mapping-${theme}-${width}.png`),fullPage:true});
  await (await workspaceControl(page, page.getByRole('button',{ includeHidden: true, name:'Run Validation',exact:true}))).click();
  await expect(page.getByRole('heading',{name:'Migration readiness: BLOCKED'})).toBeVisible();
  const graph=page.getByRole('group',{ includeHidden: true, name:'Interactive dataset dependency diagram',exact:true});await workspaceControl(page,graph);await expect(graph).toBeVisible();
  const colors=await graph.locator('g[data-dataset-node]').evaluateAll(nodes=>nodes.map(node=>({foreground:getComputedStyle(node.querySelector('text')!).fill,background:getComputedStyle(node.querySelector('rect')!).fill})));
  for(const colorset of colors)expect(ratio(colorset.foreground,colorset.background)).toBeGreaterThanOrEqual(4.5);
  await (await workspaceControl(page, page.getByRole('button',{ includeHidden: true, name:'Zoom in dependency diagram'}))).click();await (await workspaceControl(page, graph)).focus();await (await workspaceControl(page, graph)).press('ArrowRight');await (await workspaceControl(page, page.getByRole('button',{ includeHidden: true, name:'Fit diagram',exact:true}))).click();
  await graph.locator('..').screenshot({path:shot(`graph-${theme}-${width}.png`)});
  await (await workspaceControl(page, page.locator('#issue-distribution-toggle'))).click();
  if(width>=640){const chart=page.getByTestId('distribution-chart');await expect(chart.locator('svg')).toBeVisible();await chart.locator('.recharts-bar-rectangle path').first().hover();await expect(page.locator('.recharts-default-tooltip')).toBeVisible();}
  await (await workspaceControl(page, page.getByTestId('report-analytics-dashboard'))).screenshot({path:shot(`analytics-${theme}-${width}.png`)});
  const edit=page.getByRole('button',{ includeHidden: true, name:'Edit students line 4 column department_id',exact:true});await (await workspaceControl(page, edit)).click();await (await workspaceControl(page, page.getByRole('textbox',{ includeHidden: true, name:'Proposed value for students line 4 column department_id'}))).fill('20');await (await workspaceControl(page, page.getByRole('button',{ includeHidden: true, name:'Apply correction',exact:true}))).click();
  const selector=page.locator('select[title="Color theme"]:visible');await (await workspaceControl(page, selector)).selectOption(theme==='dark'?'light':'dark');await (await workspaceControl(page, selector)).selectOption(theme);
  await expect(edit.locator('xpath=ancestor::td')).toContainText('Original: 99');
  await (await workspaceControl(page, page.getByRole('button',{ includeHidden: true, name:'Undo correction',exact:true}))).click();await (await workspaceControl(page, page.getByRole('button',{ includeHidden: true, name:'Redo correction',exact:true}))).click();
  await (await workspaceControl(page, page.locator('[aria-labelledby="correction-workspace-title"]'))).screenshot({path:shot(`corrections-${theme}-${width}.png`)});
  const [download]=await Promise.all([page.waitForEvent('download'),(await workspaceControl(page, page.getByRole('button',{ includeHidden: true, name:'Download corrected CSV',exact:true}))).click()]);expect(await readFile((await download.path())!,'utf8')).toContain('"3","Ahmed","20"');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(writes).toEqual([]);
  expect(await page.evaluate(()=>Object.keys(localStorage).filter(key=>key!=='datarehearsal-theme'))).toEqual([]);
 });
}
