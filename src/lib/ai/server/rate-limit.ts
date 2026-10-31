import { createHash } from "node:crypto";
import { AiError } from "../contracts";
import { readBoundedJson } from "../providers/bounded-json";
import type { hostedConfiguration } from "./config";
import { HostedServiceError } from "./service-error";

type Configuration = ReturnType<typeof hostedConfiguration>;
const perMinute = 5, perDay = 200;
// Atomic check-and-increment: concurrent Vercel functions share the same budgets.
const script = `local u=tonumber(redis.call('GET',KEYS[1]) or '0')
local g=tonumber(redis.call('GET',KEYS[2]) or '0')
if u>=tonumber(ARGV[1]) or g>=tonumber(ARGV[2]) then return 0 end
redis.call('INCR',KEYS[1]); redis.call('EXPIRE',KEYS[1],60)
redis.call('INCR',KEYS[2]); redis.call('EXPIRE',KEYS[2],86400)
return 1`;
/** A bounded local counter is for development only. Production requires the shared Redis limiter. */
export function createHostedRateLimiter() {
  const local = new Map<string, { expires: number; count: number }>();
  return async (userId: string, config: Configuration, signal: AbortSignal, now = Date.now()) => {
    const namespace = createHash("sha256").update(config.appOrigin).digest("hex").slice(0, 16);
    const identity = createHash("sha256").update(config.appOrigin + "\0" + userId).digest("hex");
    const keys = [`rowzen:ai:${namespace}:user:${identity}:${Math.floor(now / 60_000)}`, `rowzen:ai:${namespace}:day:${Math.floor(now / 86_400_000)}`];
    if (config.redisUrl && config.redisToken) {
      try {
        const bounded = AbortSignal.any([signal, AbortSignal.timeout(3000)]);
        const response = await fetch(config.redisUrl, { method: "POST", signal: bounded, cache: "no-store", redirect: "error", credentials: "omit",
          headers: { Authorization: `Bearer ${config.redisToken}`, "Content-Type": "application/json" },
          body: JSON.stringify(["EVAL", script, "2", ...keys, String(perMinute), String(perDay)]) });
        if (!response.ok) {
          void response.body?.cancel().catch(() => {});
          throw new HostedServiceError([401, 403].includes(response.status) ? "HOSTED_CONFIGURATION" : "HOSTED_UNAVAILABLE", "rate-limit", response.status);
        }
        const body = await readBoundedJson(response, bounded, 1024);
        if (!body || typeof body !== "object" || !("result" in body) || ![0, 1].includes(body.result as number)) throw new Error();
        if (body.result === 0) throw new AiError("RATE_LIMITED");
        return;
      } catch (error) {
        if (signal.aborted) throw new AiError("CANCELLED");
        if (error instanceof AiError && error.code === "RATE_LIMITED") throw error;
        if (error instanceof HostedServiceError) throw error;
        throw new HostedServiceError("HOSTED_UNAVAILABLE", "rate-limit");
      }
    }
    for (const [key, value] of local) if (value.expires <= now) local.delete(key);
    if (local.size > 1024) throw new AiError("RATE_LIMITED");
    const counts = keys.map(key => local.get(key)?.count ?? 0);
    if (counts[0] >= perMinute || counts[1] >= perDay) throw new AiError("RATE_LIMITED");
    keys.forEach((key, index) => local.set(key, { count: counts[index] + 1, expires: now + (index ? 86_400_000 : 60_000) }));
  };
}
