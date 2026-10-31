import { describe, expect, it } from "vitest";
import { oauthOptions } from "../../../src/lib/security/oauth-options";
import { oauthErrorCallback, oauthFeedback } from "../../../src/lib/security/oauth-feedback";

const environment = { BETTER_AUTH_URL: "http://localhost:3000", GITHUB_CLIENT_ID: "synthetic-github-id", GITHUB_CLIENT_SECRET: "synthetic-github-secret",
  GOOGLE_CLIENT_ID: "synthetic-google-id", GOOGLE_CLIENT_SECRET: "synthetic-google-secret" };
describe("server OAuth configuration and fixed client feedback", () => {
  it("preserves GitHub and adds verified Google without identity/profile merging or trust overrides", () => {
    const options = oauthOptions(environment);
    expect(options.socialProviders.github).toEqual({ clientId: environment.GITHUB_CLIENT_ID, clientSecret: environment.GITHUB_CLIENT_SECRET });
    expect(options.socialProviders.google).toMatchObject({ clientId: environment.GOOGLE_CLIENT_ID, clientSecret: environment.GOOGLE_CLIENT_SECRET, requireEmailVerification: true });
    expect(options.account.accountLinking).toEqual({ enabled: true, disableImplicitLinking: true, allowDifferentEmails: false, trustedProviders: [], updateUserInfoOnLink: false, allowUnlinkingAll: false });
    expect(options).not.toHaveProperty("advanced.disableCSRFCheck"); expect(options).not.toHaveProperty("advanced.disableOriginCheck");
    expect(options.baseURL).toBe(environment.BETTER_AUTH_URL);
  });
  it.each([{}, { GOOGLE_CLIENT_ID: "" }, { GOOGLE_CLIENT_SECRET: "" }, { GOOGLE_CLIENT_ID: " " }])("keeps GitHub available with incomplete Google configuration %j", google => {
    const options = oauthOptions({ BETTER_AUTH_URL: environment.BETTER_AUTH_URL, GITHUB_CLIENT_ID: environment.GITHUB_CLIENT_ID,
      GITHUB_CLIENT_SECRET: environment.GITHUB_CLIENT_SECRET, ...google });
    expect(options.socialProviders.github.clientSecret).toBe(environment.GITHUB_CLIENT_SECRET); expect(options.socialProviders.google).toBeUndefined();
  });
  it("preserves a safe internal next URL without pre-filling/masking the framework error code", () => {
    const target = new URL(oauthErrorCallback("google", "link", "/results/report-id?page=2"), "https://local.invalid");
    expect(target.pathname).toBe("/login"); expect(target.searchParams.get("next")).toBe("/results/report-id?page=2");
    expect(target.searchParams.get("provider")).toBe("google"); expect(target.searchParams.has("error")).toBe(false);
    expect(new URL(oauthErrorCallback("github", "sign-in", "https://evil.invalid"), "https://local.invalid").searchParams.get("next")).toBe("/dashboard");
  });
  it.each(["<img onerror=secret>", "PRIVATE_TOKEN", "unknown", "javascript:alert(1)"])("never echoes untrusted callback error %s", error => {
    expect(oauthFeedback(error, "google", "sign-in")).toBe("Google sign-in was not completed. Try again.");
    expect(oauthFeedback(error, "<script>", "link")).toBe("Account connection was not completed. Try again.");
  });
  it("provides deterministic cancellation/linking guidance without account claims from query hints", () => {
    expect(oauthFeedback("access_denied", "google", "sign-in")).toContain("cancelled or declined");
    expect(oauthFeedback("account_not_linked", "google", null)).toContain("existing provider");
    expect(oauthFeedback("email_does_not_match", "github", "link")).toContain("not merged");
    expect(oauthFeedback("account_already_linked_to_different_user", "google", "link")).toContain("not changed");
    expect(oauthFeedback(null, "google", "link")).toBe("");
  });
});
