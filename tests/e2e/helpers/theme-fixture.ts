import { build } from "esbuild";
import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { themeInitializationScript } from "../../../src/lib/theme/preference";

let script: string;
export async function themeFixture(page: Page, kind: string, theme: "light" | "dark") {
  if (kind === "dashboard") await page.route("**/api/projects/theme-project/runs", route => route.fulfill({ contentType: "application/json", body: JSON.stringify({ runs: [] }) }));
  script ??= (await build({ bundle:true,write:false,platform:"browser",format:"iife",minify:true,
    define:{"process.env.NODE_ENV":'"production"',"process.env":"{}"},
    stdin:{resolveDir:process.cwd(),loader:"tsx",contents:`
      import React from 'react';import{createRoot}from'react-dom/client';
      import{DashboardShellNavigation}from'./src/components/layout/dashboard-nav';
      import SignOutButton from './src/components/auth/sign-out-button';
      import Dashboard from './src/components/projects/dashboard-overview';
      import Projects from './src/components/projects/projects-view';
      import History from './src/components/reports/history-results';
      import Summary from './src/components/reports/saved-summary';
      import Workspace from './src/components/upload/upload-workspace';
      import PageLoading from './src/components/ui/page-loading';
      import PageError from './src/app/(dashboard)/error';
      const projects=[{id:'theme-project',name:'Customer migration',description:'Synthetic project for browser verification'}];
      const report={id:'theme-report',projectId:'theme-project',projectName:'Customer migration',status:'CONFIG_ERROR',totalRows:6,validRows:null,invalidRows:null,issueCount:1,createdAt:new Date('2026-10-23T05:00:00Z')};
      const kind=window.fixtureKind;
      const content=kind==='dashboard'?<Dashboard projects={projects}/>:kind==='projects'?<Projects projects={projects}/>:kind==='history'?<History filters={{search:'',status:'ALL',order:'newest',page:1,pageSize:10}} history={{items:[report],total:12,page:1,pageSize:10,totalPages:2}}/>:kind==='summary'?<Summary summary={{...report,project:{name:report.projectName}}}/>:kind==='loading'?<PageLoading label="Loading projects..."/>:kind==='error'?<PageError error={new Error('Never display this private detail')} retry={()=>{window.retryCount=(window.retryCount||0)+1}}/>:<Workspace initialProjectId="theme-project"/>;
      createRoot(document.querySelector('#fixture')).render(<><DashboardShellNavigation pathname={kind==='summary'?'/results/theme-report':kind==='history'?'/results':kind==='projects'?'/projects':kind==='dashboard'?'/dashboard':'/upload'} accountAction={<SignOutButton/>}/><div className="min-w-0 lg:pl-64"><main id="dashboard-content" tabIndex={-1} className="mx-auto min-w-0 w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">{content}</main></div></>);
    `}})).outputFiles[0].text;
  await page.goto("/");
  const shell = await page.evaluate(() => ({ styles: [...document.head.querySelectorAll('link[rel="stylesheet"],style')].map(n=>n.outerHTML).join(""), font:document.documentElement.className }));
  await page.evaluate(value => localStorage.setItem("datarehearsal-theme",value),theme);
  await page.setContent(`<!doctype html><html lang="en" class="${shell.font}" data-theme="${theme}"><head>${shell.styles}</head><body><div id="fixture"></div></body></html>`);
  await page.addScriptTag({content:themeInitializationScript});
  await page.evaluate(kind=>Object.assign(window,{fixtureKind:kind}),kind);
  await page.addScriptTag({content:script});
  await expect(page.getByRole("main")).toBeVisible();
  await page.evaluate(()=>document.fonts.ready);
}
