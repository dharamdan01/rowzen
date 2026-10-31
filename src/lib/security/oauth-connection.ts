import { loginDestination } from "./login-destination";
import type { LoginProvider } from "./oauth-feedback";

/** UI intent only. Better Auth still authorizes every session and explicit link. */
export function connectionProvider(value: string | null): LoginProvider | null {
  return value === "google" || value === "github" ? value : null;
}
export function connectionReturn(provider: LoginProvider, destination: string): string {
  return "/login?next=" + encodeURIComponent(loginDestination(destination)) + "&connect=" + provider;
}
