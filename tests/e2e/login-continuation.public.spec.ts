import { readFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { build } from "esbuild";
import { expect, test } from "@playwright/test";

for (const [next, expected] of [["", "/dashboard"], ["/upload?project=example", "/upload?project=example"], ["//example.com", "/dashboard"]]) {
  test(`public login requests safe OAuth continuation ${expected} from ${next || "default"}`, async ({ page }) => {
    await page.route("**/api/auth/get-session*", route => route.fulfill({ contentType: "application/json", body: "null" }));
    let callback: string | undefined;
    // Intercept only this browser's request; do not contact GitHub or fabricate a session.
    await page.route("**/api/auth/sign-in/social", route => {
      callback = route.request().postDataJSON().callbackURL;
      return route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ message: "Synthetic provider rejection" }) });
    });
    await page.goto(`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`);
    const button = page.getByRole("button", { name: "Continue with GitHub", exact: true });
    await button.focus(); await button.press("Enter");
    await expect.poll(() => callback).toBe(expected);
    await expect(page).toHaveURL(/\/login/);
  });
}
for (const width of [320,1280]) {
  test(`signed-in presentation has a keyboard-accessible continuation at ${width}px`, async ({ page }) => {
    await page.setViewportSize({width,height:800});
    await page.route("**/api/auth/get-session*", route => route.fulfill({ contentType: "application/json", body: "null" }));
    await page.goto("/login?next=%2Fresults%3Fpage%3D2");
    const shell = await page.evaluate(() => ({ styles: [...document.head.querySelectorAll('link[rel="stylesheet"],style')].map(node=>node.outerHTML).join(""), font: document.documentElement.className }));
    const baseline = process.env.CW1_BASELINE === "1";
    const bundle = await build({bundle:true,write:false,platform:"browser",format:"iife",minify:true,
      define:{"process.env.NODE_ENV":'"production"',"process.env":"{}"},
      plugins:[{ name:"isolated-login-presentation", setup(builder) {
        builder.onLoad({filter:/auth-client\.ts$/},()=>({contents:`export const authClient={useSession:()=>({data:{user:{name:"Synthetic user",email:"fixture@example.invalid"}},isPending:false}),signOut:async()=>({}),signIn:{social:async()=>({})}};`,loader:"js"}));
        builder.onResolve({filter:/^next\/navigation$/},()=>({path:"navigation",namespace:"fixture"}));
        builder.onLoad({filter:/.*/,namespace:"fixture"},()=>({contents:"export const useSearchParams=()=>new URLSearchParams(window.location.search);",loader:"js"}));
        if(baseline) builder.onLoad({filter:/app[\\/]login[\\/]page\.tsx$/},args=>({contents:readFileSync(resolve("playwright/.cache/cw1/before-page.txt"),"utf8"),loader:"tsx",resolveDir:dirname(args.path)}));
      }}],stdin:{resolveDir:process.cwd(),loader:"tsx",contents:`import React from 'react';import {createRoot} from 'react-dom/client';import Login from './src/app/login/page';createRoot(document.querySelector('#fixture')).render(<Login/>);`}});
    await page.setContent(`<!doctype html><html lang="en" class="${shell.font}"><head>${shell.styles}</head><body><div id="fixture"></div></body></html>`);
    await page.addScriptTag({content:bundle.outputFiles[0].text});
    await expect(page.getByRole("heading",{name:"Welcome, Synthetic user"})).toBeVisible();
    const folder=resolve("playwright/.cache/cw1",baseline?"before":"after");mkdirSync(folder,{recursive:true});
    await page.screenshot({path:resolve(folder,`login-${width}.png`)});
    const link=page.getByRole("link",{name:"Continue to Rowzen",exact:true});
    if(baseline){await expect(link).toHaveCount(0);return;}
    await expect(link).toHaveAttribute("href","/results?page=2");
    await link.focus();await expect(link).toBeFocused();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  });
}
