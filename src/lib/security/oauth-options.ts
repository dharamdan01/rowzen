import type { BetterAuthOptions } from "better-auth";

type OAuthEnvironment = Readonly<Record<string, string | undefined>>;

/** Server configuration only. Client components must never import these credentials. */
export function oauthOptions(environment: OAuthEnvironment) {
  const googleConfigured = Boolean(environment.GOOGLE_CLIENT_ID?.trim() && environment.GOOGLE_CLIENT_SECRET?.trim());
  return {
    baseURL: environment.BETTER_AUTH_URL,
    socialProviders: {
      github: { clientId: environment.GITHUB_CLIENT_ID!, clientSecret: environment.GITHUB_CLIENT_SECRET! },
      ...(googleConfigured ? { google: {
        clientId: environment.GOOGLE_CLIENT_ID!, clientSecret: environment.GOOGLE_CLIENT_SECRET!,
        requireEmailVerification: true, prompt: "select_account" as const,
      } } : {}),
    },
    account: {
      accountLinking: {
        enabled: true, disableImplicitLinking: true, allowDifferentEmails: false,
        trustedProviders: [], updateUserInfoOnLink: false, allowUnlinkingAll: false,
      },
    },
    user: {
      // The provider's session gate alone can run after provisioning; reject earlier as well.
      validateUserInfo: ({ user, source }) => {
        if (source.method === "oauth" && source.oauth?.providerId === "google" && user.emailVerified !== true) {
          return { error: "email_not_verified", errorDescription: "Verify your Google email before signing in or connecting this account." };
        }
      },
    },
    onAPIError: { errorURL: "/login" },
  } satisfies BetterAuthOptions;
}
