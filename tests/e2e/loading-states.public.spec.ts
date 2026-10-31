import { workspaceControl, workspaceStep } from "./helpers/workspace-navigation";
﻿import { expect, test, type Route } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { themeFixture } from "./helpers/theme-fixture";
const folder=resolve('playwright/.cache/phase9-theme');
function shot(name:string){mkdirSync(folder,{recursive:true});return resolve(folder,name);}
for(const width of [320,1440])for(const theme of ['light','dark']as const){
 test(`session loading ${theme} ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:900});await page.emulateMedia({colorScheme:theme,reducedMotion:'reduce'});
  const held:Route[]=[];await page.route('**/api/auth/get-session*',route=>{held.push(route);});
  await page.goto('/login');await expect(page.getByText('Checking your session...', {exact:true})).toBeVisible();
  await page.screenshot({path:shot(`session-loading-${theme}-${width}.png`)});
  await expect.poll(()=>held.length).toBeGreaterThan(0);await held[0].fulfill({contentType:'application/json',body:'null'});
  await expect(page.getByRole('button',{name:'Continue with GitHub',exact:true})).toBeVisible();
 });
 test(`project pending actions ${theme} ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:1000});await page.emulateMedia({colorScheme:theme,reducedMotion:'reduce'});
  const held:Route[]=[];await page.route('**/api/projects**',route=>{held.push(route);});
  await themeFixture(page,'projects',theme);await (await workspaceControl(page, page.getByRole('button',{ includeHidden: true, name:'New project',exact:true}))).click();
  const dialog=page.getByRole('dialog', { name: 'New project', exact: true, includeHidden: true });await (await workspaceControl(page, dialog.getByLabel('Project name'))).fill('New customer project');
  await (await workspaceControl(page, dialog.getByRole('button',{ includeHidden: true, name:'Create project',exact:true}))).click();
  const pending=dialog.getByRole('button',{ includeHidden: true, name:'Saving project...',exact:true});await expect(pending).toBeDisabled();
  await expect(pending).toHaveAttribute('aria-busy','true');expect(await pending.locator('svg').evaluate(n=>getComputedStyle(n).animationName)).toBe('none');
  await dialog.locator('form').evaluate(form=>form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
  expect(held).toHaveLength(1);await page.keyboard.press('Escape');await expect(dialog).toBeVisible();
  await page.screenshot({path:shot(`project-saving-${theme}-${width}.png`)});
  await held[0].fulfill({status:500,contentType:'application/json',body:'{"error":"Could not save project. Try again."}'});
  await expect(dialog.getByRole('alert')).toContainText('Try again');await expect(dialog.getByLabel('Project name')).toHaveValue('New customer project');
  await (await workspaceControl(page, dialog.getByRole('button',{ includeHidden: true, name:'Create project',exact:true}))).click();await expect.poll(()=>held.length).toBe(2);
  await held[1].fulfill({status:201,contentType:'application/json',body:'{"project":{"id":"created-project","name":"New customer project"}}'});await expect(dialog).toHaveCount(0);
  await (await workspaceControl(page, page.getByRole('button',{ includeHidden: true, name:'Delete New customer project',exact:true}))).click();
  await (await workspaceControl(page, page.getByRole('dialog', { name: 'Delete project?', exact: true, includeHidden: true }).getByRole('button',{ includeHidden: true, name:'Cancel',exact:true}))).click();expect(held).toHaveLength(2);
  await (await workspaceControl(page, page.getByRole('button',{ includeHidden: true, name:'Delete New customer project',exact:true}))).click();await (await workspaceControl(page, page.getByRole('button',{ includeHidden: true, name:'Delete project',exact:true}))).click();
  await expect(page.getByRole('button',{name:'Deleting project...',exact:true})).toBeDisabled();await expect.poll(()=>held.length).toBe(3);
  await held[2].fulfill({contentType:'application/json',body:'{}'});await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'New project',exact:true})).toBeFocused();
 });
 test(`workspace waits and recovery ${theme} ${width}px`,async({page})=>{
  test.setTimeout(90000);await page.setViewportSize({width,height:1000});await page.emulateMedia({colorScheme:theme});
  const projects:Route[]=[],templates:Route[]=[],saves:Route[]=[],summaries:Route[]=[];
  await page.route('**/api/projects',route=>{projects.push(route);});
  await page.route('**/api/projects/theme-project/templates',route=>{(route.request().method()==='GET'?templates:saves).push(route);});
  await page.route('**/api/projects/theme-project/runs',route=>{summaries.push(route);});
  await themeFixture(page,'workspace',theme);await expect(page.getByText('Loading projects...', {exact:true})).toHaveCount(1);
  await page.evaluate(()=>{
   const original=File.prototype.arrayBuffer;let release!:()=>void;const pending=new Promise<void>(resolve=>{release=resolve;});
   File.prototype.arrayBuffer=function(){return pending.then(()=>original.call(this));};
   Object.assign(window,{finishCsvRead:()=>{File.prototype.arrayBuffer=original;release();}});
  });
  await (await workspaceControl(page, page.locator('#csv-files'))).setInputFiles({name:'records.csv',mimeType:'text/csv',buffer:Buffer.from('id,name\n1,PRIVATE_ALPHA\n1,PRIVATE_BETA')});
  await expect(page.getByText('Reading CSV files...', {exact:true})).toBeVisible();await expect(page.locator('#csv-files')).toBeDisabled();
  await page.screenshot({path:shot(`csv-reading-${theme}-${width}.png`)});
  await page.evaluate(()=>(window as unknown as {finishCsvRead:()=>void}).finishCsvRead());
  await (await workspaceControl(page, page.getByRole('button',{ includeHidden: true, name:'Run Validation',exact:true}))).click();await expect(page.getByRole('heading',{name:'Migration readiness: BLOCKED',includeHidden:true})).toHaveCount(1);
  await expect.poll(()=>projects.length).toBe(1);await projects[0].fulfill({status:500,body:'{}'});
  await workspaceStep(page,'Configure'); await expect(page.getByRole('main').getByRole('alert')).toContainText('Projects unavailable');await (await workspaceControl(page, page.getByRole('button',{ includeHidden: true, name:'Retry loading projects'}))).click();
  await expect.poll(()=>projects.length).toBe(2);await projects[1].fulfill({contentType:'application/json',body:'{"projects":[{"id":"theme-project","name":"Customer migration"}]}'});
  await page.getByText('Project and mapping templates',{exact:true}).click(); await expect(page.getByText('Loading saved templates...', {exact:true})).toBeVisible();await expect(page.getByRole('heading',{name:'Migration readiness: BLOCKED',includeHidden:true})).toHaveCount(1);
  await expect.poll(()=>templates.length).toBe(1);await templates[0].fulfill({contentType:'application/json',body:'{"templates":[]}'});
  await (await workspaceControl(page, page.getByLabel('New template name',{exact:true}))).fill('Reusable mapping');await (await workspaceControl(page, page.getByRole('button',{ includeHidden: true, name:'Save mapping template',exact:true}))).click();
  await expect(page.getByRole('button',{name:'Saving template...',exact:true})).toBeDisabled();await expect(page.getByLabel('Template project',{exact:true})).toBeDisabled();await expect.poll(()=>saves.length).toBe(1);
  const payload=saves[0].request().postDataJSON();expect(JSON.stringify(payload)).not.toContain('PRIVATE_');
  await page.screenshot({path:shot(`template-saving-${theme}-${width}.png`),fullPage:true});
  await saves[0].fulfill({status:201,contentType:'application/json',body:JSON.stringify({template:{id:'template-1',name:payload.name,projectId:'theme-project',configuration:payload.configuration}})});
  await expect(page.getByLabel('Saved mapping template',{exact:true})).toHaveValue('template-1');
  page.once('dialog',dialog=>dialog.dismiss());await (await workspaceControl(page, page.getByRole('button',{ includeHidden: true, name:'Load mapping template',exact:true}))).click();
  await expect(page.getByRole('heading',{name:'Migration readiness: BLOCKED',includeHidden:true})).toHaveCount(1);
  await (await workspaceControl(page, page.getByRole('button',{ includeHidden: true, name:'Save validation summary',exact:true}))).click();await expect(page.getByRole('button',{name:'Saving...',exact:true})).toBeDisabled();await expect.poll(()=>summaries.length).toBe(1);
  expect(JSON.stringify(summaries[0].request().postDataJSON())).not.toContain('PRIVATE_');
  await summaries[0].fulfill({status:500,body:'{}'});await expect(page.getByRole('button',{name:'Save validation summary',exact:true})).toBeEnabled();
  await expect(page.getByRole('heading',{name:'Migration readiness: BLOCKED',includeHidden:true})).toHaveCount(1);
  await (await workspaceControl(page, page.getByRole('button',{ includeHidden: true, name:'Save validation summary',exact:true}))).click();await expect.poll(()=>summaries.length).toBe(2);
  await summaries[1].fulfill({status:201,contentType:'application/json',body:'{"run":{"id":"saved-run"}}'});
  await expect(page.getByRole('link',{name:'View saved summary',exact:true})).toHaveAttribute('href','/results/saved-run');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 });
}
