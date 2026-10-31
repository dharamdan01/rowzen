import { afterEach, describe, expect, it, vi } from "vitest";
import { createInferenceHandler } from "../../../src/lib/ai/server/handler";
import { hostedConfiguration, GROQ_MODEL } from "../../../src/lib/ai/server/config";
import { createHostedRateLimiter } from "../../../src/lib/ai/server/rate-limit";
import { inferWithGroq } from "../../../src/lib/ai/server/groq";
import { parseHostedRequest } from "../../../src/lib/ai/providers/hosted-contracts";
import { AiError } from "../../../src/lib/ai/contracts";
import { schemaFixture, schemaAnswer, schemaWireAnswer } from "../../fixtures/ai-schema-mapping";
import { serializeSchemaMappingContext } from "../../../src/lib/ai/schema-mapping";
import { rootCauseFixture, groundedKeyResponse } from "../../fixtures/ai-root-cause";
import { serializeRootCauseContext } from "../../../src/lib/ai/root-cause";
import { repairCandidateFixture } from "../../fixtures/repair-candidates";

const environment = { NODE_ENV: "development", AI_HOSTED_ENABLED: "true", GROQ_API_KEY: "SYNTHETIC_PRIVATE_GROQ_KEY", BETTER_AUTH_URL: "http://localhost:3000" };
const cloud = { ...environment, NODE_ENV: "production", VERCEL: "1", BETTER_AUTH_URL: "https://qa.example.test", AI_RATE_LIMIT_REDIS_REST_URL: "https://qa.upstash.io", AI_RATE_LIMIT_REDIS_REST_TOKEN: "SYNTHETIC_PRIVATE_REDIS_KEY" };
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
const fixtures = () => {
  const repair = repairCandidateFixture();
  return [
    { request: parseHostedRequest({ feature: "schema-mapping", consent: true, metadata: JSON.parse(serializeSchemaMappingContext(schemaFixture().context)) }), result: schemaWireAnswer(schemaAnswer) },
    { request: parseHostedRequest({ feature: "root-cause", consent: true, metadata: JSON.parse(serializeRootCauseContext(rootCauseFixture().context)) }), result: groundedKeyResponse },
    { request: parseHostedRequest({ feature: "smart-repair", consent: true, metadata: repair.wire }), result: repair.recommendation },
  ];
};
const request = (body: unknown, headers: Record<string, string> = {}, signal?: AbortSignal) => new Request("http://localhost:3000/api/ai/inference", {
  method: "POST", signal, headers: { "Content-Type": "application/json", Origin: environment.BETTER_AUTH_URL, ...headers }, body: JSON.stringify(body),
});
const completion = (result: unknown, patch = {}) => json({ model: GROQ_MODEL, choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ result }) } }], ...patch });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
describe("authenticated hosted inference boundary (mocked auth and provider; no real sessions)", () => {
  it.each([0, 1, 2])("forwards only the approved serializer projection for feature %i", async index => {
    const fixture = fixtures()[index], fetcher = vi.fn(async () => completion(fixture.result)); vi.stubGlobal("fetch", fetcher);
    const handler = createInferenceHandler({ getUser: async () => ({ id: "test-user" }), environment: () => environment });
    const response = await handler(request(fixture.request));
    expect(response.status).toBe(200); expect(await response.json()).toEqual({ result: fixture.result });
    expect(response.headers.get("cache-control")).toBe("no-store");
    const [url, options] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.groq.com/openai/v1/chat/completions"); expect(options).toMatchObject({ redirect: "error", credentials: "omit", cache: "no-store" });
    const payload = JSON.parse(options.body as string);
    expect(payload.messages[1].content).toBe(JSON.stringify(fixture.request.metadata));
    expect(payload).toMatchObject({ model: GROQ_MODEL, stream: false, response_format: { type: "json_schema", json_schema: { strict: true } } });
    expect(payload).not.toHaveProperty("tools"); expect(payload).not.toHaveProperty("store");
    expect(JSON.stringify(payload)).not.toMatch(/PRIVATE_NOTE|PRIVATE_OTHER|first@example|second@example|Alpha|Beta|rowNumber|test-user|cookie|SYNTHETIC_PRIVATE/);
  });
  it("rejects unauthenticated requests before configuration checks, budgeting or inference", async () => {
    const infer = vi.fn(), limit = vi.fn(), handler = createInferenceHandler({ getUser: async () => null, environment: () => ({}), infer, limit });
    const response = await handler(request(fixtures()[0].request)); expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: "AUTH_REQUIRED" }); expect(infer).not.toHaveBeenCalled(); expect(limit).not.toHaveBeenCalled();
  });
  it.each(["https://evil.test", "null", "http://localhost:3001", ""])('rejects untrusted/missing origin "%s"', async origin => {
    const infer = vi.fn(), limit = vi.fn(), handler = createInferenceHandler({ getUser: async () => ({ id: "test-user" }), environment: () => environment, infer, limit });
    expect((await handler(request(fixtures()[0].request, { Origin: origin, "X-Forwarded-Host": "localhost:3000" }))).status).toBe(403);
    expect(infer).not.toHaveBeenCalled(); expect(limit).not.toHaveBeenCalled();
  });
  it("rejects cross-site fetches despite a matching supplied origin", async () => {
    const handler = createInferenceHandler({ getUser: async () => ({ id: "test-user" }), environment: () => environment, infer: vi.fn() });
    expect((await handler(request(fixtures()[0].request, { "Sec-Fetch-Site": "cross-site" }))).status).toBe(403);
  });
  it("requires configured opt-in, server-only key and shared production limits", async () => {
    expect(() => hostedConfiguration({})).toThrow(expect.objectContaining({ code: "HOSTED_CONFIGURATION" }));
    expect(() => hostedConfiguration({ ...environment, NODE_ENV: "production" })).toThrow();
    expect(() => hostedConfiguration({ ...cloud, AI_RATE_LIMIT_REDIS_REST_TOKEN: "" })).toThrow();
    expect(hostedConfiguration(cloud).model).toBe(GROQ_MODEL);
    for (const env of [{ ...environment, GROQ_API_KEY: "" }, { ...environment, AI_HOSTED_ENABLED: "false" }]) {
      const handler = createInferenceHandler({ getUser: async () => ({ id: "test-user" }), environment: () => env, infer: vi.fn() });
      expect((await handler(request(fixtures()[0].request))).status).toBe(503);
    }
  });
  it("rejects missing consent, injected prompts/records/identity and non-JSON before any egress", async () => {
    const infer = vi.fn(), limit = vi.fn(), handler = createInferenceHandler({ getUser: async () => ({ id: "test-user" }), environment: () => environment, infer, limit });
    for (const extra of [{ consent: false }, { prompt: "PRIVATE_PROMPT" }, { records: [{ value: "PRIVATE_VALUE" }] }, { userId: "another-user" }, { projectId: "other-project" }]) {
      const response = await handler(request({ ...fixtures()[0].request, ...extra })); expect(response.status).toBe(400);
      expect(JSON.stringify(await response.json())).not.toMatch(/PRIVATE|another-user|other-project/);
    }
    expect((await handler(request(fixtures()[0].request, { "Content-Type": "text/plain" }))).status).toBe(400);
    expect(infer).not.toHaveBeenCalled(); expect(limit).not.toHaveBeenCalled();
  });
  it("bounds streamed bytes even without Content-Length and preserves the feature metadata budget", async () => {
    const infer = vi.fn(), handler = createInferenceHandler({ getUser: async () => ({ id: "test-user" }), environment: () => environment, infer });
    expect((await handler(request({ huge: "x".repeat(8192) }))).status).toBe(413); expect(infer).not.toHaveBeenCalled();
    const body = fixtures()[1].request;
    const response = await handler(request(body, { "Content-Length": "9000" })); expect(response.status).toBe(413);
  });
  it("enforces the per-authenticated-user development budget without trusting body identity", async () => {
    const infer = vi.fn(async () => groundedKeyResponse), handler = createInferenceHandler({ getUser: async () => ({ id: "test-user" }), environment: () => environment, infer });
    const body = fixtures()[1].request;
    for (let i = 0; i < 5; i++) expect((await handler(request(body))).status).toBe(200);
    const response = await handler(request(body)); expect(response.status).toBe(429); expect(response.headers.get("retry-after")).toBe("60"); expect(infer).toHaveBeenCalledTimes(5);
  });
  it("uses atomic shared limits with only hashed identifiers; Redis errors fail closed", async () => {
    const fetcher = vi.fn(async () => json({ result: 1 })); vi.stubGlobal("fetch", fetcher);
    const limiter = createHostedRateLimiter(), config = hostedConfiguration(cloud);
    await limiter("PRIVATE_REAL_USER_ID", config, new AbortController().signal);
    const [url, options] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(cloud.AI_RATE_LIMIT_REDIS_REST_URL);
    const payload = JSON.parse(options.body as string); expect(payload[0]).toBe("EVAL"); expect(payload).toContain("5"); expect(payload).toContain("200");
    expect(options.body).not.toMatch(/PRIVATE_REAL_USER_ID|example.test|columns|issues|SYNTHETIC_PRIVATE_GROQ/);
    vi.stubGlobal("fetch", vi.fn(async () => json({ result: 0 })));
    await expect(limiter("test-user", config, new AbortController().signal)).rejects.toMatchObject({ code: "RATE_LIMITED" });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("PRIVATE_REDIS_ERROR")));
    await expect(limiter("test-user", config, new AbortController().signal)).rejects.toMatchObject({ code: "HOSTED_UNAVAILABLE" });
  });
  it("never contacts Groq when the shared budget is unavailable", async () => {
    const infer = vi.fn(), fetcher = vi.fn(async () => json({ error: "PRIVATE_TOKEN_ERROR" }, 401)); vi.stubGlobal("fetch", fetcher);
    const handler = createInferenceHandler({ getUser: async () => ({ id: "test-user" }), environment: () => cloud, infer });
    const response = await handler(request(fixtures()[0].request, { Origin: cloud.BETTER_AUTH_URL }));
    expect(response.status).toBe(503); expect(infer).not.toHaveBeenCalled(); expect(JSON.stringify(await response.json())).not.toContain("PRIVATE");
  });
  it.each([[429, "RATE_LIMITED"], [400, "HOSTED_CONFIGURATION"], [401, "HOSTED_CONFIGURATION"], [403, "HOSTED_CONFIGURATION"], [404, "HOSTED_CONFIGURATION"], [422, "INVALID_RESPONSE"], [500, "HOSTED_UNAVAILABLE"]])("maps Groq status %i without exposing its response", async (status, code) => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ error: "PRIVATE_UPSTREAM_KEY_OR_PROMPT" }, status as number)));
    const outcome = await inferWithGroq(fixtures()[1].request, hostedConfiguration(environment), new AbortController().signal).catch(error => error);
    expect(outcome).toMatchObject({ code }); expect(outcome).toBeInstanceOf(AiError);
    if (!(outcome instanceof AiError)) throw new Error("Expected fixed AI error");
    expect(outcome.message).not.toContain("PRIVATE");
  });
  it.each([401, 403, 503])("reports only fixed limiter diagnostics for HTTP %i and never calls Groq", async status => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ error: "PRIVATE_UPSTASH_TOKEN_AND_BODY" }, status)));
    const reportFailure = vi.fn(), infer = vi.fn();
    const handler = createInferenceHandler({ getUser: async () => ({ id: "PRIVATE_USER" }), environment: () => cloud, infer, reportFailure });
    const response = await handler(request(fixtures()[0].request, { Origin: cloud.BETTER_AUTH_URL }));
    const code = status === 503 ? "HOSTED_UNAVAILABLE" : "HOSTED_CONFIGURATION";
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ code, error: new AiError(code).message });
    expect(reportFailure).toHaveBeenCalledExactlyOnceWith({ stage: "rate-limit", code, service: "rate-limit", upstreamStatus: status });
    expect(infer).not.toHaveBeenCalled();
    expect(JSON.stringify(reportFailure.mock.calls)).not.toMatch(/PRIVATE|https:|Bearer|SYNTHETIC/);
  });
  it.each([400, 500])("distinguishes inference HTTP %i from limiter failure without leaking diagnostics to the browser", async status => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ error: "PRIVATE_GROQ_PROMPT_AND_KEY" }, status)));
    const reportFailure = vi.fn();
    const handler = createInferenceHandler({ getUser: async () => ({ id: "PRIVATE_USER" }), environment: () => environment, reportFailure });
    const response = await handler(request(fixtures()[1].request));
    const code = status === 400 ? "HOSTED_CONFIGURATION" : "HOSTED_UNAVAILABLE";
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ code, error: new AiError(code).message });
    expect(reportFailure).toHaveBeenCalledExactlyOnceWith({ stage: "inference", code, service: "groq", upstreamStatus: status });
    expect(JSON.stringify(reportFailure.mock.calls)).not.toMatch(/PRIVATE|https:|Bearer|SYNTHETIC/);
  });
  it("reports fixed authentication/configuration stages without logging exceptions or environment values", async () => {
    const reportFailure = vi.fn();
    const failedAuth = createInferenceHandler({ getUser: async () => { throw new Error("PRIVATE_DATABASE_URL"); }, environment: () => cloud, reportFailure });
    expect((await failedAuth(request(fixtures()[0].request))).status).toBe(503);
    expect(reportFailure).toHaveBeenLastCalledWith({ stage: "authentication", code: "HOSTED_UNAVAILABLE" });
    const failedConfig = createInferenceHandler({ getUser: async () => ({ id: "PRIVATE_USER" }), environment: () => ({}), reportFailure });
    expect((await failedConfig(request(fixtures()[0].request))).status).toBe(503);
    expect(reportFailure).toHaveBeenLastCalledWith({ stage: "configuration", code: "HOSTED_CONFIGURATION" });
    expect(JSON.stringify(reportFailure.mock.calls)).not.toMatch(/PRIVATE|https:|SYNTHETIC/);
  });
  it("keeps network exceptions private and diagnostic sink failures cannot bypass the limiter", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("PRIVATE_NETWORK_AND_URL")));
    const reportFailure = vi.fn(() => { throw new Error("PRIVATE_LOGGER_ERROR"); }), infer = vi.fn();
    const handler = createInferenceHandler({ getUser: async () => ({ id: "PRIVATE_USER" }), environment: () => cloud, infer, reportFailure });
    const response = await handler(request(fixtures()[0].request, { Origin: cloud.BETTER_AUTH_URL }));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ code: "HOSTED_UNAVAILABLE", error: new AiError("HOSTED_UNAVAILABLE").message });
    expect(reportFailure).toHaveBeenCalledExactlyOnceWith({ stage: "rate-limit", code: "HOSTED_UNAVAILABLE", service: "rate-limit" });
    expect(infer).not.toHaveBeenCalled();
  });
  it.each(["length", "tool_calls", "content_filter"])("rejects incomplete/refused completion %s", async reason => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ model: GROQ_MODEL, choices: [{ finish_reason: reason, message: { content: JSON.stringify({ result: groundedKeyResponse }) } }] })));
    await expect(inferWithGroq(fixtures()[1].request, hostedConfiguration(environment), new AbortController().signal)).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });
  it("enforces timeouts and propagates browser cancellation without publishing late inference", async () => {
    vi.useFakeTimers(); let upstreamSignal!: AbortSignal;
    const infer = vi.fn(async (_body, _config, signal: AbortSignal) => { upstreamSignal = signal; return new Promise(() => {}); });
    const handler = createInferenceHandler({ getUser: async () => ({ id: "test-user" }), environment: () => environment, infer, timeoutMs: 10 });
    const pending = handler(request(fixtures()[1].request)); await vi.advanceTimersByTimeAsync(11);
    const response = await pending; expect(response.status).toBe(504); expect(upstreamSignal.aborted).toBe(true);
    const controller = new AbortController(), cancelled = handler(request(fixtures()[1].request, {}, controller.signal));
    await vi.advanceTimersByTimeAsync(1); controller.abort(); expect((await cancelled).status).toBe(499);
  });
  it("uses fixed errors if authentication itself fails and never logs provider data", async () => {
    const logger = vi.spyOn(console, "error").mockImplementation(() => {});
    const handler = createInferenceHandler({ getUser: async () => { throw new Error("PRIVATE_AUTH_DATABASE" ); }, environment: () => environment });
    const response = await handler(request(fixtures()[1].request)); expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain("PRIVATE"); expect(logger).not.toHaveBeenCalled(); logger.mockRestore();
  });
});
