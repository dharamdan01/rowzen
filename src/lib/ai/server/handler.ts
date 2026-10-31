import { AiError, safeAiError } from "../contracts";
import { parseHostedRequest } from "../providers/hosted-contracts";
import { hostedConfiguration, type ServerEnvironment } from "./config";
import { createHostedRateLimiter } from "./rate-limit";
import { inferWithGroq } from "./groq";
import { HostedServiceError } from "./service-error";

const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
type Stage = "authentication" | "configuration" | "request" | "rate-limit" | "inference";
export type HostedFailure = Readonly<{ stage: Stage; code: AiError["code"]; service?: "groq" | "rate-limit"; upstreamStatus?: number }>;
type Dependencies = { getUser: () => Promise<{ id: string } | null>; environment: () => ServerEnvironment;
  limit?: ReturnType<typeof createHostedRateLimiter>; infer?: typeof inferWithGroq; timeoutMs?: number;
  reportFailure?: (failure: HostedFailure) => void };
/** Identity comes exclusively from Better Auth; no report/project IDs or user-selected upstreams. */
export function createInferenceHandler({ getUser, environment, limit = createHostedRateLimiter(), infer = inferWithGroq, timeoutMs = 45_000, reportFailure }: Dependencies) {
  return async (request: Request): Promise<Response> => {
    let stage: Stage = "authentication";
    const controller = new AbortController();
    const abort = () => controller.abort(new AiError("CANCELLED"));
    if (request.signal.aborted) abort();
    request.signal.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(() => controller.abort(new AiError("HOSTED_TIMEOUT")), timeoutMs);
    let rejectAbort!: (error: unknown) => void;
    const aborted = new Promise<never>((_, reject) => { rejectAbort = reject; });
    const reject = () => rejectAbort(controller.signal.reason);
    controller.signal.addEventListener("abort", reject, { once: true });
    const perform = async () => {
      controller.signal.throwIfAborted();
      const user = await getUser();
      if (!user) throw new AiError("AUTH_REQUIRED");
      stage = "configuration";
      const config = hostedConfiguration(environment());
      stage = "request";
      if (request.headers.get("origin") !== config.appOrigin || request.headers.get("sec-fetch-site") === "cross-site") throw new AiError("ORIGIN_REJECTED");
      if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") throw new AiError("INVALID_CONTEXT");
      if (Number(request.headers.get("content-length")) > 8192) throw new AiError("CONTEXT_TOO_LARGE");
      if (!request.body) throw new AiError("INVALID_CONTEXT");
      const reader = request.body.getReader(); let size = 0; const chunks: Uint8Array[] = [];
      const cancel = () => { void reader.cancel().catch(() => {}); };
      controller.signal.addEventListener("abort", cancel, { once: true });
      let body: unknown;
      try {
        while (true) {
          controller.signal.throwIfAborted(); const next = await reader.read(); controller.signal.throwIfAborted();
          if (next.done) break;
          size += next.value.byteLength;
          if (size > 8192) { cancel(); throw new AiError("CONTEXT_TOO_LARGE"); }
          chunks.push(next.value);
        }
        const bytes = new Uint8Array(size); let offset = 0;
        for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
        try { body = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); } catch { throw new AiError("INVALID_CONTEXT"); }
      } finally { controller.signal.removeEventListener("abort", cancel); reader.releaseLock(); }
      const task = parseHostedRequest(body);
      stage = "rate-limit";
      await limit(user.id, config, controller.signal);
      controller.signal.throwIfAborted();
      stage = "inference";
      const result = await infer(task, config, controller.signal);
      controller.signal.throwIfAborted(); return Response.json({ result }, { headers });
    };
    try { controller.signal.throwIfAborted(); return await Promise.race([perform(), aborted]); }
    catch (error) {
      const safe = controller.signal.aborted ? safeAiError(controller.signal.reason) : error instanceof AiError ? error : new AiError("HOSTED_UNAVAILABLE");
      const status = safe.code === "AUTH_REQUIRED" ? 401 : safe.code === "ORIGIN_REJECTED" ? 403 : safe.code === "RATE_LIMITED" ? 429
        : safe.code === "CONTEXT_TOO_LARGE" ? 413 : safe.code === "INVALID_CONTEXT" ? 400 : safe.code === "HOSTED_TIMEOUT" ? 504 : safe.code === "CANCELLED" ? 499 : 503;
      if (status >= 500 && reportFailure) {
        const service = error instanceof HostedServiceError && !controller.signal.aborted ? error : undefined;
        try {
          reportFailure({ stage, code: safe.code, ...(service ? { service: service.service,
            ...(service.upstreamStatus === undefined ? {} : { upstreamStatus: service.upstreamStatus }) } : {}) });
        } catch { /* Diagnostic sinks must not alter the fixed response or fail-open. */ }
      }
      return Response.json({ code: safe.code, error: safe.message }, { status, headers: { ...headers, ...(status === 429 ? { "Retry-After": "60" } : {}) } });
    } finally { clearTimeout(timer); request.signal.removeEventListener("abort", abort); controller.signal.removeEventListener("abort", reject); }
  };
}
