/** No network/secret output. Hosted integration remains opt-in and must agree with the built client. */
export function aiEnvironmentErrors(environment, { production = false } = {}) {
  const errors = [], mode = environment.NEXT_PUBLIC_AI_PROVIDER || "ollama";
  if (!["ollama", "groq"].includes(mode)) errors.push("NEXT_PUBLIC_AI_PROVIDER must be ollama or groq.");
  for (const name of ["NEXT_PUBLIC_GROQ_API_KEY", "NEXT_PUBLIC_AI_RATE_LIMIT_REDIS_REST_TOKEN"]) {
    if (environment[name]) errors.push(`${name} must not be public; remove it and rotate any exposed credential.`);
  }
  if (mode === "groq") {
    if (environment.AI_HOSTED_ENABLED !== "true") errors.push("Hosted AI requires AI_HOSTED_ENABLED=true and explicit hosted-metadata consent in the client.");
    if (!environment.GROQ_API_KEY?.trim()) errors.push("GROQ_API_KEY is required for hosted AI (server-only).");
    const url = environment.AI_RATE_LIMIT_REDIS_REST_URL?.trim(), token = environment.AI_RATE_LIMIT_REDIS_REST_TOKEN?.trim();
    if (production && (!url || !token)) errors.push("Production hosted AI requires AI_RATE_LIMIT_REDIS_REST_URL and AI_RATE_LIMIT_REDIS_REST_TOKEN for shared request limits.");
    if (Boolean(url) !== Boolean(token)) errors.push("Configure both rate-limit REST variables together.");
    if (url) {
      try {
        const endpoint = new URL(url);
        if (endpoint.protocol !== "https:" || !endpoint.hostname.endsWith(".upstash.io") || endpoint.port || endpoint.username || endpoint.password || endpoint.pathname !== "/" || endpoint.search || endpoint.hash) throw new Error();
      } catch { errors.push("The rate-limit REST URL must be an exact HTTPS Upstash origin."); }
    }
  } else if (environment.AI_HOSTED_ENABLED === "true") errors.push("Hosted server and built client must agree: choose NEXT_PUBLIC_AI_PROVIDER=groq or disable AI_HOSTED_ENABLED.");
  return errors;
}
