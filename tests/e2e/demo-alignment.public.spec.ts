import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { downloadText } from "./helpers";
for(const width of [320,1280]) test(`two-file public demo preserves validation/export at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:1000});const posts:string[]=[];page.on('request',request=>{if(request.method()==='POST')posts.push(request.url());});
  await page.goto('/rehearsal');const picker=page.getByLabel('Choose 1 or 2 CSV files (1 MB maximum each)',{exact:true});
  await expect(page.getByRole('region',{name:'Validation results',exact:true})).toHaveCount(0);
  await picker.setInputFiles({name:'students.csv',mimeType:'text/csv',buffer:Buffer.from('id,name,department_id\n1,Ada,10')});
  await page.getByRole('button',{name:'Run validation',exact:true}).click();await expect(page.getByText('No data checks configured',{exact:true})).toBeVisible();
  await picker.setInputFiles([{name:'students.csv',mimeType:'text/csv',buffer:Buffer.from('id,name,department_id\n1,Ada,10\n2,Grace,10')},{name:'departments.csv',mimeType:'text/csv',buffer:Buffer.from('id,name\n10,Science')}]);
  await page.getByRole('button',{name:'Apply students/departments example rules',exact:true}).click();await page.getByRole('button',{name:'Run validation',exact:true}).click();
  const report=page.getByRole('region',{name:'Validation results',exact:true});await expect(report).toBeVisible();
  const output=JSON.parse(await downloadText(page,'Download JSON report'));expect(output.summary.totalRecords).toBe(3);expect(output.summary.validRows).toBe(3);expect(output.summary.invalidRows).toBe(0);expect(output.dependency.recommendedImportOrder).toEqual(['departments','students']);
  await picker.focus();await expect(picker).toBeFocused();expect(posts).toEqual([]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const stage=process.env.LS3_SCREENSHOT_STAGE||'after';const folder=resolve('playwright/.cache/ls3',stage);mkdirSync(folder,{recursive:true});await page.screenshot({path:resolve(folder,`demo-${width}.png`),fullPage:true});
  if(stage==='after'){await expect(page.getByRole('link',{name:'CSV workspace',exact:true})).toHaveAttribute('href','/upload');await expect(page.getByRole('navigation',{name:'Demo navigation'})).toBeVisible();}
});
