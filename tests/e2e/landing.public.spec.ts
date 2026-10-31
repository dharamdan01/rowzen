import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const folder=resolve('playwright/.cache/phase9-landing');
function shot(name:string){mkdirSync(folder,{recursive:true});return resolve(folder,name);}
const heading='Catch data issues before import.';
for(const width of [320,375,390,768,1024,1440])for(const theme of ['light','dark']as const){
 test(`landing ${theme} ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:1000});await page.emulateMedia({colorScheme:theme,reducedMotion:'reduce'});
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{
   let cls=0;new PerformanceObserver(list=>{for(const entry of list.getEntries())if(!(entry as PerformanceEntry & {hadRecentInput:boolean}).hadRecentInput)cls+=(entry as PerformanceEntry & {value:number}).value;Object.assign(window,{landingCls:cls});}).observe({type:'layout-shift',buffered:true});
  });
  await page.goto('/');await page.getByRole('combobox',{name:'Color theme',exact:true}).selectOption(theme);
  await expect(page.getByRole('heading',{level:1,name:heading,exact:true})).toBeVisible();
  for(const id of ['features','how-it-works','privacy','product-preview'])await expect(page.locator(`h2#${id}`)).toHaveCount(1);
  const starts=page.getByRole('main').getByRole('link',{name:'Get Started',exact:true});await expect(starts).toHaveCount(2);
  for(const link of await starts.all())await expect(link).toHaveAttribute('href','/dashboard');
  const hero=page.getByRole('img',{name:'Actual sample report excerpt showing blocked migration readiness and validation counts.',exact:true});
  await expect.poll(()=>hero.evaluate(image=>(image as HTMLImageElement).complete&&(image as HTMLImageElement).naturalWidth>0)).toBe(true);
  expect(await hero.evaluate(image=>(image as HTMLImageElement).currentSrc)).toContain(`overview-${theme}-${width<640?'mobile':'desktop'}.webp`);
  const tabs=page.getByRole('tablist',{name:'Product interfaces'});await tabs.scrollIntoViewIfNeeded();
  const results=tabs.getByRole('tab',{name:'Results & issues',exact:true});await expect(results).toHaveAttribute('aria-selected','true');
  await expect.poll(()=>page.getByRole('tabpanel').getByRole('img').evaluate(image=>(image as HTMLImageElement).complete&&(image as HTMLImageElement).naturalWidth>0)).toBe(true);
  const resources=await page.evaluate(()=>performance.getEntriesByType('resource').filter(entry=>entry.name.includes('/landing/')).reduce((total,entry)=>total+(entry as PerformanceResourceTiming).transferSize,0));expect(resources).toBeLessThan(250000);
  const cls=await page.evaluate(()=>(window as unknown as {landingCls:number}).landingCls??0);expect(cls).toBeLessThan(.1);writeFileSync(shot(`metrics-${theme}-${width}.json`),JSON.stringify({theme,width,initialScreenshotTransferBytes:resources,cls},null,2));
  await results.focus();await results.press('ArrowRight');await expect(tabs.getByRole('tab',{name:'Dependencies',exact:true})).toBeFocused();
  await expect(page.getByRole('tabpanel')).toHaveAttribute('id','preview-panel-dependencies');
  await page.getByRole('region',{name:'Dependencies screenshot',exact:true}).screenshot({path:shot(`dependencies-${theme}-${width}.png`)});
  await page.getByRole('tab',{name:'Dependencies',exact:true}).press('End');await expect(tabs.getByRole('tab',{name:'Corrections',exact:true})).toBeFocused();
  await expect(page.getByRole('tabpanel')).toHaveAttribute('id','preview-panel-corrections');
  const full=page.getByRole('tabpanel').getByRole('link',{name:'Open full-size screenshot (new tab)',exact:true});await expect(full).toHaveAttribute('href',`/landing/corrections-${theme}-${width<640?'mobile':'desktop'}.webp`);
  await page.getByRole('tab',{name:'Corrections',exact:true}).press('Home');await expect(results).toBeFocused();
  await expect(page.getByRole('tabpanel')).toHaveAttribute('id','preview-panel-results');
  const nav=width<1024?page.getByRole('navigation',{name:'Mobile homepage navigation'}):page.getByRole('navigation',{name:'Homepage sections'});
  if(width<1024){const menu=page.locator('summary[aria-controls="landing-mobile-navigation"]');await menu.focus();await menu.press('Enter');await expect(nav).toBeVisible();await menu.press('Escape');await expect(nav).not.toBeVisible();await expect(menu).toBeFocused();await menu.press('Enter');}
  await nav.getByRole('link',{name:'Features',exact:true}).click();await expect(page).toHaveURL(/#features$/);
  if(width<1024)await expect(nav).not.toBeVisible();
  const target=(await page.locator('#features').boundingBox())!;const header=(await page.locator('header').boundingBox())!;expect(target.y).toBeGreaterThanOrEqual(header.y+header.height);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:shot(`after-${theme}-${width}.png`),fullPage:true});await page.screenshot({path:shot(`viewport-${theme}-${width}.png`)});expect(errors).toEqual([]);
 });
}
test('landing CTAs retain real login/application flow and system images follow OS changes',async({page})=>{
 await page.emulateMedia({colorScheme:'dark'});await page.goto('/');await page.keyboard.press('Tab');await expect(page.getByRole('link',{name:'Skip to content',exact:true})).toBeFocused();await page.keyboard.press('Enter');await expect(page.getByRole('main')).toBeFocused();const selector=page.getByRole('combobox',{name:'Color theme',exact:true});await selector.selectOption('system');
 await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 const hero=page.getByRole('img',{name:'Actual sample report excerpt showing blocked migration readiness and validation counts.',exact:true});await expect.poll(()=>hero.evaluate(image=>(image as HTMLImageElement).currentSrc)).toContain('overview-dark-');
 await page.emulateMedia({colorScheme:'light'});await expect(page.locator('html')).toHaveAttribute('data-theme','light');await expect.poll(()=>hero.evaluate(image=>(image as HTMLImageElement).currentSrc)).toContain('overview-light-');
 await page.reload();await expect(selector).toHaveValue('system');
 await page.getByRole('main').getByRole('link',{name:'See How It Works',exact:true}).click();await expect(page).toHaveURL(/#how-it-works$/);
 await page.getByRole('main').getByRole('link',{name:'Get Started',exact:true}).first().click();await expect(page).toHaveURL(/\/login$/);
 await expect(page.getByRole('button',{name:'Continue with GitHub',exact:true})).toBeVisible();
});
