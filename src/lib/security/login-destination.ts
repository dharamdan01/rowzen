/** OAuth continuation is restricted to existing app pages, never auth/API endpoints. */
export function loginDestination(value: string | null | undefined): string {
  const fallback = "/dashboard";
  if (!value || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u0020\u007f]/.test(value)) return fallback;
  try {
    const destination = new URL(value, "https://continuation.invalid");
    if (destination.origin !== "https://continuation.invalid" || /%2f|%5c|%25/i.test(destination.pathname)) return fallback;
    if (!/^\/(dashboard|projects|upload|results)$/.test(destination.pathname) && !/^\/results\/[^/]+$/.test(destination.pathname)) return fallback;
    return destination.pathname + destination.search + destination.hash;
  } catch {
    return fallback;
  }
}
