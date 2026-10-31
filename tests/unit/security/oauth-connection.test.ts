import { describe, expect, it } from "vitest";
import { connectionProvider, connectionReturn } from "../../../src/lib/security/oauth-connection";
describe("explicit connection return intent", () => {
  it.each(["google", "github"] as const)("permits only %s UI intent and a fixed local return", provider => {
    expect(connectionProvider(provider)).toBe(provider);
    const url = new URL(connectionReturn(provider, "/results/owned?returnTo=history"), "https://local.invalid");
    expect(url.pathname).toBe("/login"); expect(url.searchParams.get("connect")).toBe(provider);
    expect(url.searchParams.get("next")).toBe("/results/owned?returnTo=history");
  });
  it.each([null, "Google", "javascript:alert(1)", "//evil.invalid", "credential"])("rejects invalid provider %s", value => expect(connectionProvider(value)).toBeNull());
  it("never forwards an external destination or accepts login as an arbitrary continuation", () => {
    expect(new URL(connectionReturn("google", "//evil.invalid"), "https://local.invalid").searchParams.get("next")).toBe("/dashboard");
    expect(new URL(connectionReturn("google", "/login?connect=github"), "https://local.invalid").searchParams.get("next")).toBe("/dashboard");
  });
});
