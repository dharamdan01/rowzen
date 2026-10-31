import { build } from "esbuild";
import { expect, test, type Route } from "@playwright/test";

for (const [width, theme] of [[320, "dark"], [375, "light"], [390, "system"], [768, "dark"], [1024, "light"], [1440, "dark"]] as const) {
  test(`both OAuth providers retain keyboard, pending/error and safe continuation ${width}px ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ colorScheme: "dark" });
    await page.addInitScript(value => localStorage.setItem("datarehearsal-theme", value), theme);
    await page.route("**/api/auth/get-session*", route => route.fulfill({ contentType: "application/json", body: "null" }));
    const requests: Route[] = []; await page.route("**/api/auth/sign-in/social", route => { requests.push(route); });
    await page.goto("/login?next=%2Fresults%2Freport-owned%3FreturnTo%3Dhistory");
    const github = page.getByRole("button", { name: "Continue with GitHub", exact: true }), google = page.getByRole("button", { name: "Continue with Google", exact: true });
    await expect(github).toBeVisible(); await google.focus(); await google.press("Enter");
    await expect(page.getByRole("button", { name: "Opening Google...", exact: true })).toBeDisabled(); await expect(github).toBeDisabled();
    await expect.poll(() => requests.length).toBe(1);
    const options = requests[0].request().postDataJSON();
    expect(options).toMatchObject({ provider: "google", callbackURL: "/results/report-owned?returnTo=history" });
    const errorURL = new URL(options.errorCallbackURL, "http://localhost:3000");
    expect(errorURL.searchParams.get("provider")).toBe("google"); expect(errorURL.searchParams.has("error")).toBe(false);
    await requests[0].fulfill({ status: 400, contentType: "application/json", body: '{"message":"PRIVATE_PROVIDER_FAILURE"}' });
    await expect(page.locator("main").getByRole("alert")).toHaveText("Could not start Google sign-in. Try again.");
    await expect(google).toBeEnabled(); await expect(github).toBeEnabled();
    await github.click(); await expect.poll(() => requests.length).toBe(2);
    expect(requests[1].request().postDataJSON().provider).toBe("github");
    await requests[1].abort("failed"); await expect(page.locator("main").getByRole("alert")).toContainText("Could not start GitHub sign-in");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await page.locator("main").innerText()).not.toContain("PRIVATE_PROVIDER_FAILURE");
    expect(await page.evaluate(() => Object.keys(sessionStorage))).toEqual([]);
    expect(await page.evaluate(() => Object.keys(localStorage).filter(key => key !== "datarehearsal-theme"))).toEqual([]);
  });
}

test("Google cancellation, same-email linking guidance and hostile hints never echo provider prose", async ({ page }) => {
  await page.route("**/api/auth/get-session*", route => route.fulfill({ contentType: "application/json", body: "null" }));
  for (const [error, expected] of [["access_denied", "Google sign-in was cancelled or declined"], ["account_not_linked", "Sign in with your existing provider"],
    ["email_does_not_match", "same verified email"], ["<script>PRIVATE_TOKEN</script>", "Google sign-in was not completed"]]) {
    await page.goto(`/login?provider=google&error=${encodeURIComponent(error)}&next=${encodeURIComponent("//evil.invalid")}`);
    await expect(page.locator("main").getByRole("alert")).toContainText(expected); await expect(page.locator("main")).not.toContainText("PRIVATE_TOKEN");
  }
  let body: { callbackURL: string } | undefined;
  await page.route("**/api/auth/sign-in/social", route => { body = route.request().postDataJSON(); return route.fulfill({ status: 400, contentType: "application/json", body: "{}" }); });
  await page.getByRole("button", { name: "Continue with Google", exact: true }).click(); await expect.poll(() => body?.callbackURL).toBe("/dashboard");
});

test("authenticated presentation connects only through linkSocial, preserving Continue/sign-out", async ({ page }) => {
  // Synthetic presentation only, not a real authenticated route or provider-identity proof.
  await page.setViewportSize({ width: 320, height: 900 });
  await page.route("**/api/auth/get-session*", route => route.fulfill({ contentType: "application/json", body: "null" }));
  await page.goto("/"); const shell = await page.evaluate(() => ({ styles: [...document.head.querySelectorAll('link[rel="stylesheet"],style')].map(node => node.outerHTML).join(""), font: document.documentElement.className }));
  const output = await build({ bundle: true, write: false, platform: "browser", format: "iife", minify: true,
    define: { "process.env.NODE_ENV": '"production"', "process.env": "{}" },
    plugins: [{ name: "isolated-session-presentation", setup(builder) {
      builder.onLoad({ filter: /auth-client\.ts$/ }, () => ({ loader: "js", contents: `export const authClient={useSession:()=>({data:{user:{id:'fixture-owner',name:'Synthetic owner',email:'owner@example.invalid'}},isPending:false}),signOut:async()=>({}),signIn:{social:async()=>{throw Error('Use linkSocial')}},linkSocial:async options=>{await fetch('/fixture/link-social',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(options)});return {error:{message:'PRIVATE_LINK_FAILURE'}}}};` }));
      builder.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: "navigation", namespace: "fixture" }));
      builder.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ loader: "js", contents: "export const useSearchParams=()=>new URLSearchParams('?next=%2Fprojects');" }));
    } }], stdin: { resolveDir: process.cwd(), loader: "tsx", contents: "import React from 'react';import {createRoot} from 'react-dom/client';import Login from './src/app/login/page';createRoot(document.querySelector('#fixture')).render(<Login/>);" } });
  await page.setContent(`<!doctype html><html lang="en" class="${shell.font}"><head>${shell.styles}</head><body><div id="fixture"></div></body></html>`); await page.addScriptTag({ content: output.outputFiles[0].text });
  let body: unknown;
  await page.route("**/fixture/link-social", route => { body = route.request().postDataJSON(); return route.fulfill({ contentType: "application/json", body: "{}" }); });
  await expect(page.getByRole("link", { name: "Continue to Rowzen", exact: true })).toHaveAttribute("href", "/projects");
  await page.getByRole("button", { name: "Connect Google", exact: true }).click();
  await expect.poll(() => body).toMatchObject({ provider: "google", callbackURL: "/projects" });
  await expect(page.locator("main").getByRole("alert")).toHaveText("Could not start Google connection. Try again.");
  await expect(page.getByRole("button", { name: "Sign Out", exact: true })).toBeVisible();
  await expect(page.locator("main")).not.toContainText("PRIVATE_LINK_FAILURE");
});

test("a restored browser page clears the opening state after provider navigation", async ({ page }) => {
  await page.route("**/api/auth/get-session*", route => route.fulfill({ contentType: "application/json", body: "null" }));
  const requests: Route[] = []; await page.route("**/api/auth/sign-in/social", route => { requests.push(route); });
  await page.goto("/login"); await page.getByRole("button", { name: "Continue with Google", exact: true }).click();
  await expect.poll(() => requests.length).toBe(1); await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
  await expect(page.getByRole("button", { name: "Continue with Google", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Continue with GitHub", exact: true }).click(); await expect.poll(() => requests.length).toBe(2);
  await requests[0].abort("failed");
  await expect(page.getByRole("button", { name: "Opening GitHub...", exact: true })).toBeDisabled();
  await requests[1].fulfill({ status: 400, contentType: "application/json", body: "{}" });
  await expect(page.locator("main").getByRole("alert")).toHaveText("Could not start GitHub sign-in. Try again.");
});

if (process.env.DATAREHEARSAL_REAL_OAUTH_INIT === "1") for (const provider of ["google", "github"] as const) {
  test(`LIVE ${provider} authorization initiation uses configured server credentials without exposing secrets`, async ({ request, baseURL }) => {
    const response = await request.post("/api/auth/sign-in/social", { headers: { Origin: new URL(baseURL!).origin },
      data: { provider, callbackURL: "/dashboard", errorCallbackURL: `/login?provider=${provider}`, disableRedirect: true } });
    expect(response.status()).toBe(200);
    const result = await response.json() as { url: string; redirect: boolean };
    expect(Object.keys(result).sort()).toEqual(["redirect", "url"]);
    const url = new URL(result.url);
    expect(url.origin).toBe(provider === "google" ? "https://accounts.google.com" : "https://github.com");
    expect(url.searchParams.get("redirect_uri")).toBe(new URL(`/api/auth/callback/${provider}`, baseURL!).href);
    expect(url.searchParams.has("client_id")).toBe(true); expect(url.searchParams.has("client_secret")).toBe(false);
    expect(url.searchParams.has("state")).toBe(true);
    if (provider === "google") expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    // No provider navigation, code exchange, real user creation or successful identity verification is claimed.
  });
}
