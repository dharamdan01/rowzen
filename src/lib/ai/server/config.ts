import { AiError } from "../contracts";

export type ServerEnvironment = Readonly<Record<string, string | undefined>>;
export const GROQ_MODEL = "openai/gpt-oss-20b";
export function hostedConfiguration(environment: ServerEnvironment) {
  if (environment.AI_HOSTED_ENABLED !== "true" || !environment.GROQ_API_KEY?.trim()) throw new AiError("HOSTED_CONFIGURATION");
  const cloud = environment.VERCEL === "1" || environment.NODE_ENV === "production";
  let app: URL;
  try {
    app = new URL(environment.BETTER_AUTH_URL ?? "");
    if (app.username || app.password || app.pathname !== "/" || app.search || app.hash ||
        (app.protocol !== "https:" && !(app.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(app.hostname) && !cloud))) throw new Error();
  } catch { throw new AiError("HOSTED_CONFIGURATION"); }
  const redisUrl = environment.AI_RATE_LIMIT_REDIS_REST_URL?.trim(), redisToken = environment.AI_RATE_LIMIT_REDIS_REST_TOKEN?.trim();
  if (cloud && (!redisUrl || !redisToken)) throw new AiError("HOSTED_CONFIGURATION");
  if (Boolean(redisUrl) !== Boolean(redisToken)) throw new AiError("HOSTED_CONFIGURATION");
  if (redisUrl) {
    try {
      const redis = new URL(redisUrl);
      if (redis.protocol !== "https:" || !redis.hostname.endsWith(".upstash.io") || redis.port || redis.username || redis.password || redis.pathname !== "/" || redis.search || redis.hash) throw new Error();
    } catch { throw new AiError("HOSTED_CONFIGURATION"); }
  }
  return { appOrigin: app.origin, apiKey: environment.GROQ_API_KEY.trim(), redisUrl, redisToken, model: GROQ_MODEL };
}
