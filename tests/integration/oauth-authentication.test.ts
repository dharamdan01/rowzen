import { randomBytes } from "node:crypto";
import { betterAuth } from "better-auth";
import { memoryAdapter, type MemoryDB } from "better-auth/adapters/memory";
import { describe, expect, it } from "vitest";
import { oauthOptions } from "../../src/lib/security/oauth-options";
import { oauthErrorCallback, type LoginProvider } from "../../src/lib/security/oauth-feedback";

const origin = "http://localhost:3000";
type Profile = { subject: string; email: string; verified: boolean; name: string };
/** Actual Better Auth handlers/state/session/linking with simulated provider transport; no application DB or real OAuth identities. */
async function fixture() {
  const database: MemoryDB = { user: [], account: [], session: [], verification: [] };
  const auth = betterAuth({ ...oauthOptions({ BETTER_AUTH_URL: origin, GITHUB_CLIENT_ID: "synthetic-github-id", GITHUB_CLIENT_SECRET: "synthetic-github-secret",
    GOOGLE_CLIENT_ID: "synthetic-google-id", GOOGLE_CLIENT_SECRET: "synthetic-google-secret" }),
    secret: randomBytes(32).toString("hex"), database: memoryAdapter(database), logger: { disabled: true },
    advanced: { disableOriginCheck: false, disableCSRFCheck: false } });
  const profiles: Record<LoginProvider, Profile> = { github: { subject: "101", email: "owner@example.test", verified: true, name: "Original owner" },
    google: { subject: "google-owner", email: "owner@example.test", verified: true, name: "Google profile" } };
  const context = await auth.$context;
  for (const provider of context.socialProviders) {
    const id = provider.id as LoginProvider;
    provider.validateAuthorizationCode = async ({ code }) => {
      if (code === "invalid") throw new Error("Synthetic invalid/expired authorization code");
      return { accessToken: "synthetic-token", scopes: ["openid", "email", "profile"] };
    };
    provider.getUserInfo = async () => ({ user: { name: profiles[id].name, email: profiles[id].email, emailVerified: profiles[id].verified },
      data: id === "google" ? { sub: profiles[id].subject, email: profiles[id].email, email_verified: profiles[id].verified } : { id: profiles[id].subject, email: profiles[id].email } });
  }
  const browser = () => new Map<string, string>();
  async function request(path: string, jar = browser(), body?: unknown) {
    const response = await auth.handler(new Request(origin + "/api/auth" + path, { method: body === undefined ? "GET" : "POST",
      headers: { origin, cookie: [...jar].map(([key, value]) => `${key}=${value}`).join("; "), ...(body === undefined ? {} : { "content-type": "application/json" }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) }));
    for (const cookie of response.headers.getSetCookie()) {
      const pair = cookie.split(";", 1)[0], split = pair.indexOf("="), name = pair.slice(0, split), value = pair.slice(split + 1);
      if (!value || /max-age=0/i.test(cookie)) jar.delete(name); else jar.set(name, value);
    }
    return response;
  }
  async function begin(provider: LoginProvider, jar = browser(), link = false) {
    const response = await request(link ? "/link-social" : "/sign-in/social", jar, { provider, callbackURL: "/results/report-owned",
      errorCallbackURL: oauthErrorCallback(provider, link ? "link" : "sign-in", "/results/report-owned"), disableRedirect: true });
    expect(response.status).toBe(200);
    const result = await response.json() as { url: string };
    return { jar, url: new URL(result.url) };
  }
  async function complete(provider: LoginProvider, start: Awaited<ReturnType<typeof begin>>, code = "synthetic-valid-code") {
    const state = start.url.searchParams.get("state"); expect(state).toBeTruthy();
    return request(`/callback/${provider}?state=${encodeURIComponent(state!)}&code=${code}`, start.jar);
  }
  async function session(jar: ReturnType<typeof browser>) { return (await request("/get-session", jar)).json() as Promise<{ user: { id: string; name: string; email: string } } | null>; }
  return { auth, database, profiles, browser, request, begin, complete, session };
}

describe("isolated OAuth registration, returning identities and explicit linking", () => {
  it("creates one Google user and returns to the same stable identity without duplicate accounts", async () => {
    const f = await fixture(), first = await f.begin("google");
    expect(first.url.origin).toBe("https://accounts.google.com");
    expect(first.url.searchParams.get("redirect_uri")).toBe(origin + "/api/auth/callback/google");
    expect(first.url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(first.url.searchParams.get("state")).toBeTruthy(); expect(first.url.searchParams.get("code_challenge")).toBeTruthy();
    expect(new Set(first.url.searchParams.get("scope")!.split(" "))).toEqual(new Set(["openid", "email", "profile"]));
    expect((await f.complete("google", first)).headers.get("location")).toBe("/results/report-owned");
    const owner = (await f.session(first.jar))!.user.id;
    const second = await f.begin("google"); await f.complete("google", second);
    expect((await f.session(second.jar))!.user.id).toBe(owner);
    expect(f.database.user).toHaveLength(1); expect(f.database.account).toHaveLength(1);
    expect(f.database.account[0]).toMatchObject({ providerId: "google", accountId: "google-owner", userId: owner });
  });
  it("preserves GitHub identity/profile and requires explicit same-email Google connection", async () => {
    const f = await fixture(), github = await f.begin("github");
    await f.complete("github", github); const original = (await f.session(github.jar))!.user;
    const implicit = await f.begin("google"), rejected = await f.complete("google", implicit);
    expect(new URL(rejected.headers.get("location")!, origin).searchParams.get("error")).toBe("account_not_linked");
    expect(await f.session(implicit.jar)).toBeNull(); expect(f.database.user).toHaveLength(1); expect(f.database.account).toHaveLength(1);
    const connected = await f.begin("google", github.jar, true); await f.complete("google", connected);
    expect(f.database.user).toHaveLength(1); expect(f.database.account).toHaveLength(2);
    expect(f.database.account.every(account => account.userId === original.id)).toBe(true);
    expect(f.database.user[0]).toMatchObject({ id: original.id, name: "Original owner", email: original.email });
    const repeated = await f.begin("google", github.jar, true); await f.complete("google", repeated); expect(f.database.account).toHaveLength(2);
    const returningGoogle = await f.begin("google"); await f.complete("google", returningGoogle);
    const returningGithub = await f.begin("github"); await f.complete("github", returningGithub);
    expect((await f.session(returningGoogle.jar))!.user.id).toBe(original.id); expect((await f.session(returningGithub.jar))!.user.id).toBe(original.id);
  });
  it("supports explicit GitHub linking after Google-first registration", async () => {
    const f = await fixture(), first = await f.begin("google"); await f.complete("google", first);
    const owner = (await f.session(first.jar))!.user.id;
    await f.complete("github", await f.begin("github", first.jar, true));
    expect(f.database.user).toHaveLength(1); expect(f.database.account).toHaveLength(2);
    expect(f.database.account.every(account => account.userId === owner)).toBe(true);
  });
  it("rejects unverified Google before provisioning and permits a later verified attempt", async () => {
    const f = await fixture(); f.profiles.google.verified = false;
    const start = await f.begin("google"), result = await f.complete("google", start);
    expect(new URL(result.headers.get("location")!, origin).searchParams.get("error")).toBeTruthy();
    expect(f.database.session).toHaveLength(0); expect(await f.session(start.jar)).toBeNull();
    expect(f.database.user).toHaveLength(0); expect(f.database.account).toHaveLength(0);
    f.profiles.google.verified = true; const verified = await f.begin("google"); await f.complete("google", verified);
    expect((await f.session(verified.jar))!.user.id).toBeTruthy(); expect(f.database.user).toHaveLength(1); expect(f.database.account).toHaveLength(1);
  });
  it("rejects mismatched/unverified explicit links and anonymous link requests", async () => {
    const f = await fixture(), start = await f.begin("github"); await f.complete("github", start);
    f.profiles.google.email = "different@example.test";
    const different = await f.complete("google", await f.begin("google", start.jar, true));
    expect(new URL(different.headers.get("location")!, origin).searchParams.get("error")).toBe("email_does_not_match");
    f.profiles.google.email = f.profiles.github.email; f.profiles.google.verified = false;
    const unverified = await f.complete("google", await f.begin("google", start.jar, true));
    expect(new URL(unverified.headers.get("location")!, origin).searchParams.get("error")).toBe("email_not_verified");
    expect((await f.request("/link-social", f.browser(), { provider: "google", callbackURL: "/dashboard" })).status).toBe(401);
    expect(f.database.account).toHaveLength(1); expect(f.database.user).toHaveLength(1);
  });
  it("never transfers a provider owned by another user even when its verified email changes", async () => {
    const f = await fixture(), owner = await f.begin("github"); await f.complete("github", owner);
    f.profiles.google.email = "second@example.test";
    const other = await f.begin("google"); await f.complete("google", other);
    const firstId = (await f.session(owner.jar))!.user.id, secondId = (await f.session(other.jar))!.user.id;
    expect(firstId).not.toBe(secondId); f.profiles.google.email = f.profiles.github.email;
    const result = await f.complete("google", await f.begin("google", owner.jar, true));
    expect(new URL(result.headers.get("location")!, origin).searchParams.get("error")).toBe("account_already_linked_to_different_user");
    const returning = await f.begin("google"); await f.complete("google", returning);
    expect((await f.session(returning.jar))!.user.id).toBe(secondId);
    expect(f.database.user).toHaveLength(2); expect(f.database.account).toHaveLength(2);
  });
  it("handles cancellation, invalid/replayed state, invalid code and malformed tokens without session creation", async () => {
    const f = await fixture(), cancel = await f.begin("google");
    const denied = await f.request(`/callback/google?state=${encodeURIComponent(cancel.url.searchParams.get("state")!)}&error=access_denied`, cancel.jar);
    expect(new URL(denied.headers.get("location")!, origin).searchParams.get("error")).toBe("access_denied");
    expect((await f.complete("google", cancel)).status).toBe(302); expect(f.database.user).toHaveLength(0);
    await f.request("/callback/google?state=forged&code=invalid");
    await f.complete("google", await f.begin("google"), "invalid");
    const token = await f.request("/sign-in/social", f.browser(), { provider: "google", idToken: { token: "invalid-token" } });
    expect(token.ok).toBe(false); expect(f.database.user).toHaveLength(0); expect(f.database.session).toHaveLength(0);
  });
  it("rejects foreign callback origins and invalidates its actual session on sign-out", async () => {
    const f = await fixture();
    const external = await f.request("/sign-in/social", f.browser(), { provider: "google", callbackURL: "https://evil.invalid" });
    expect(external.ok).toBe(false);
    const start = await f.begin("google"); await f.complete("google", start); expect(await f.session(start.jar)).not.toBeNull();
    expect((await f.request("/sign-out", start.jar, {})).ok).toBe(true); expect(await f.session(start.jar)).toBeNull();
  });
});
