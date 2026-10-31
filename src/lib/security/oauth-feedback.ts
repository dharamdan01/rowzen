import { loginDestination } from "./login-destination";

export type LoginProvider = "github" | "google";
export type OAuthAction = "sign-in" | "link";
export const providerLabels: Record<LoginProvider, string> = { github: "GitHub", google: "Google" };

/** Presentation hints are untrusted; they never select identities or authorize linking. */
export function oauthFeedback(error: string | null, provider: string | null, action: string | null): string {
  if (!error) return "";
  const label = provider === "google" ? "Google" : provider === "github" ? "GitHub" : null;
  const subject = label ? `${label} ${action === "link" ? "connection" : "sign-in"}` : action === "link" ? "Account connection" : "Sign-in";
  if (error === "account_not_linked") return "This sign-in method is not connected. Sign in with your existing provider, then connect the other provider from this page.";
  if (error === "email_does_not_match") return "Use a provider account with the same verified email as your current account. Your accounts were not merged.";
  if (error === "account_already_linked_to_different_user") return "This provider account is connected to a different user. Your accounts were not changed.";
  if (error === "email_not_verified") return "Verify your Google email before signing in. Your account was not linked.";
  if (error === "access_denied") return `${subject} was cancelled or declined. Try again when ready.`;
  return `${subject} was not completed. Try again.`;
}

export function oauthErrorCallback(provider: LoginProvider, action: OAuthAction, destination: string): string {
  // Better Auth appends its own error code; an existing error parameter would mask it.
  return `/login?next=${encodeURIComponent(loginDestination(destination))}&provider=${provider}&action=${action}`;
}
