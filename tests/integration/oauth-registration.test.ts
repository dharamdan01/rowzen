import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fixtures = vi.hoisted(() => ({
  database: { user: [], account: [], session: [], verification: [] },
  prisma: {},
  adapter: vi.fn(),
}));

vi.mock("../../src/lib/prisma", () => ({ prisma: fixtures.prisma }));
vi.mock("better-auth/adapters/prisma", async () => {
  const { memoryAdapter } = await import("better-auth/adapters/memory");
  return { prismaAdapter: (...args: unknown[]) => {
    fixtures.adapter(...args);
    return memoryAdapter(fixtures.database);
  } };
});

const origin = "https://rowzen.example.test";
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  for (const records of Object.values(fixtures.database)) records.length = 0;
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("VERCEL", "1");
  vi.stubEnv("VERCEL_ENV", "production");
  vi.stubEnv("BETTER_AUTH_URL", origin);
  vi.stubEnv("BETTER_AUTH_SECRET", "synthetic-stable-auth-secret-for-isolated-tests-1234567890");
  vi.stubEnv("GITHUB_CLIENT_ID", "synthetic-github-client-id");
  vi.stubEnv("GITHUB_CLIENT_SECRET", "synthetic-github-client-secret");
  vi.stubEnv("GOOGLE_CLIENT_ID", "synthetic-google-client-id.apps.googleusercontent.com");
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "synthetic-google-client-secret");
});
afterEach(() => vi.unstubAllEnvs());

describe("production OAuth registration through the application auth module and route", () => {
  it.each(["google", "github"] as const)("registers %s and initiates its callback with configured production credentials", async provider => {
    const { auth } = await import("../../src/lib/auth");
    const { POST } = await import("../../src/app/api/auth/[...all]/route");
    const context = await auth.$context;
    expect(context.socialProviders.map(item => item.id)).toContain(provider);
    expect(fixtures.adapter).toHaveBeenCalledWith(fixtures.prisma, { provider: "postgresql" });
    expect(context.secret).toBe(process.env.BETTER_AUTH_SECRET);
    expect(context.authCookies.sessionToken.attributes.secure).toBe(true);

    const response = await POST(new Request(origin + "/api/auth/sign-in/social", {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify({ provider, callbackURL: "/dashboard", disableRedirect: true }),
    }));
    expect(response.status).toBe(200);
    const body = await response.json() as { url: string; redirect: boolean };
    const url = new URL(body.url);
    expect(url.origin).toBe(provider === "google" ? "https://accounts.google.com" : "https://github.com");
    expect(url.searchParams.get("redirect_uri")).toBe(origin + "/api/auth/callback/" + provider);
    expect(url.searchParams.get("state")).toBeTruthy();
    if (provider === "google") expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(body).not.toHaveProperty("client_secret");
    expect(url.searchParams.has("client_secret")).toBe(false);
    expect(fixtures.database.user).toHaveLength(0);
    expect(fixtures.database.account).toHaveLength(0);
    expect(fixtures.database.session).toHaveLength(0);
  });

  it.each(["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"] as const)("keeps GitHub available when %s is blank", async name => {
    vi.stubEnv(name, " ");
    const { auth } = await import("../../src/lib/auth");
    const context = await auth.$context;
    expect(context.socialProviders.map(item => item.id)).toContain("github");
    expect(context.socialProviders.map(item => item.id)).not.toContain("google");
  });
});
