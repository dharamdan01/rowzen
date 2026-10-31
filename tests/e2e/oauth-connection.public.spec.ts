import { build } from "esbuild";
import { expect, test, type Page } from "@playwright/test";

// Presentation fixtures only: actual provider identity and linking are covered separately.
async function connectionFixture(page: Page) {
  await page.route("**/api/auth/get-session*", route => route.fulfill({ contentType: "application/json", body: "null" }));
  await page.goto("/login?next=%2Fprojects&connect=google");
  const shell = await page.evaluate(() => ({ styles: [...document.head.querySelectorAll('link[rel="stylesheet"],style')].map(node => node.outerHTML).join(""), font: document.documentElement.className }));
  const bundle = await build({ bundle: true, write: false, platform: "browser", format: "iife", minify: true,
    define: { "process.env.NODE_ENV": '"production"', "process.env": "{}" },
    plugins: [{ name: "connection-presentation", setup(builder) {
      builder.onLoad({ filter: /auth-client\.ts$/ }, () => ({ loader: "js", contents: `export const authClient={useSession:()=>({data:{user:{id:'synthetic-owner',name:'Synthetic owner',email:'owner@example.invalid'}},isPending:false}),listAccounts:async()=>{const r=await fetch('/fixture/accounts');return r.ok?{data:await r.json()}:{error:{}}},linkSocial:async options=>{const r=await fetch('/fixture/link',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(options)});return r.ok?{}:{error:{}}},signIn:{social:async()=>{throw Error('Sign-in must not authorize a link')}},signOut:async()=>({})};` }));
      builder.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: "nav", namespace: "fixture" }));
      builder.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ loader: "js", contents: "export const useSearchParams=()=>new URLSearchParams(window.location.search);" }));
    } }], stdin: { resolveDir: process.cwd(), loader: "tsx", contents: "import React from 'react';import{createRoot}from'react-dom/client';import Login from './src/app/login/page';createRoot(document.querySelector('#fixture')).render(<Login/>);" } });
  await page.setContent(`<!doctype html><html lang="en" class="${shell.font}"><head>${shell.styles}</head><body><div id="fixture"></div></body></html>`);
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
}
test("unconnected Google recovery keeps explicit intent through existing-provider sign-in", async ({ page }) => {
  await page.route("**/api/auth/get-session*", route => route.fulfill({ contentType: "application/json", body: "null" }));
  let options: { provider: string; callbackURL: string; errorCallbackURL: string } | undefined;
  await page.route("**/api/auth/sign-in/social", route => { options = route.request().postDataJSON(); return route.fulfill({ status: 400, contentType: "application/json", body: "{}" }); });
  await page.goto("/login?provider=google&error=account_not_linked&next=%2Fresults%3Fpage%3D2");
  await page.getByRole("button", { name: "Sign in with GitHub to connect Google", exact: true }).click();
  await expect.poll(() => options?.provider).toBe("github");
  const callback = new URL(options!.callbackURL, "http://localhost:3000");
  expect(callback.pathname).toBe("/login"); expect(callback.searchParams.get("connect")).toBe("google"); expect(callback.searchParams.get("next")).toBe("/results?page=2");
  const error = new URL(options!.errorCallbackURL, callback.origin); expect(error.searchParams.get("connect")).toBe("google"); expect(error.searchParams.has("error")).toBe(false);
  await expect(page.locator("main").getByRole("alert")).toContainText("Could not start GitHub sign-in");
});
test("signed-in connection uses linkSocial only after approval, returns to the screen and permits retry", async ({ page }) => {
  await page.route("**/fixture/accounts", route => route.fulfill({ contentType: "application/json", body: '[{"providerId":"github"}]' }));
  const options: { provider: string; callbackURL: string }[] = [];
  await page.route("**/fixture/link", route => { options.push(route.request().postDataJSON()); return route.fulfill({ status: 400, contentType: "application/json", body: "{}" }); });
  await connectionFixture(page);
  const connect = page.getByRole("button", { name: "Connect Google", exact: true }); await expect(connect).toBeVisible();
  expect(options).toEqual([]); await connect.focus(); await connect.press("Enter");
  await expect.poll(() => options.length).toBe(1); expect(options[0].provider).toBe("google");
  expect(new URL(options[0].callbackURL, "http://localhost:3000").searchParams.get("connect")).toBe("google");
  await expect(page.locator("main").getByRole("alert")).toContainText("Could not start Google connection"); await connect.click(); await expect.poll(() => options.length).toBe(2);
});
test("connection success requires authenticated provider-list evidence, not query hints", async ({ page }) => {
  await page.route("**/fixture/accounts", route => route.fulfill({ contentType: "application/json", body: '[{"providerId":"github"},{"providerId":"google"}]' }));
  await connectionFixture(page);
  await expect(page.getByRole("region", { name: "Account access", exact: true }).getByRole("status")).toContainText("Google is connected to this account");
  await expect(page.getByRole("button", { name: "Connect Google", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Continue to Rowzen", exact: true })).toHaveAttribute("href", "/projects");
});
test("provider-list failure blocks connection and supports retry without changing identities", async ({ page }) => {
  let available = false;
  await page.route("**/fixture/accounts", route => route.fulfill({ status: available ? 200 : 503, contentType: "application/json", body: available ? '[{"providerId":"github"}]' : "{}" }));
  await connectionFixture(page); await expect(page.locator("main").getByRole("alert")).toContainText("Could not check connected methods");
  await expect(page.getByRole("button", { name: "Connect Google", exact: true })).toHaveCount(0);
  available = true; await page.getByRole("button", { name: "Retry connected methods", exact: true }).click(); await expect(page.getByRole("button", { name: "Connect Google", exact: true })).toBeVisible();
});
