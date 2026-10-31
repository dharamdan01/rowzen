import { afterEach, describe, expect, it, vi } from "vitest";
import { createHostedProvider } from "../../../src/lib/ai/providers/hosted";
import { schemaFixture, schemaAnswer, schemaWireAnswer } from "../../fixtures/ai-schema-mapping";
import { rootCauseFixture, groundedKeyResponse } from "../../fixtures/ai-root-cause";
import { repairCandidateFixture } from "../../fixtures/repair-candidates";
import { createRootCauseSession } from "../../../src/lib/ai/root-cause-session";
import { createSmartRepairSession } from "../../../src/lib/ai/smart-repair-session";
import { readLocalRepairCandidate } from "../../../src/lib/corrections/repair-candidates";
import { AiError } from "../../../src/lib/ai/contracts";

const json = (result: unknown, status = 200) => new Response(JSON.stringify(result), { status, headers: { "Content-Type": "application/json" } });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
describe("hosted client transport and unchanged local verification (mocked HTTP)", () => {
  it("uses same-origin credentials and existing metadata for all three features", async () => {
    const mapping = schemaFixture(), root = rootCauseFixture(), repair = repairCandidateFixture();
    const responses = [schemaWireAnswer(schemaAnswer), groundedKeyResponse, repair.recommendation];
    const fetcher = vi.fn(async () => json({ result: responses.shift() })); vi.stubGlobal("fetch", fetcher);
    const provider = createHostedProvider();
    await expect(provider.suggestSchemaMapping(mapping.context, { consent: true })).resolves.toEqual(schemaAnswer);
    await expect(provider.analyzeRootCause(root.context, { consent: true })).resolves.toEqual(groundedKeyResponse);
    await expect(provider.selectRepairStrategy(repair.context, { consent: true })).resolves.toEqual(repair.recommendation);
    expect(fetcher).toHaveBeenCalledTimes(3);
    for (const [url, options] of fetcher.mock.calls as unknown as [string, RequestInit][]) {
      expect(url).toBe("/api/ai/inference");
      expect(options).toMatchObject({ method: "POST", credentials: "same-origin", mode: "same-origin", redirect: "error", cache: "no-store" });
      expect(JSON.parse(options.body as string)).toHaveProperty("consent", true);
      expect(options.body).not.toMatch(/PRIVATE_|first@example|second@example|Alpha|Beta|rowNumber|expectedValue|Authorization|GROQ_API_KEY/);
    }
  });
  it("requires consent and a real sealed context before any network request", async () => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    const provider = createHostedProvider(), context = schemaFixture().context;
    await expect(provider.suggestSchemaMapping(context, { consent: false })).rejects.toMatchObject({ code: "CONSENT_REQUIRED" });
    await expect(provider.suggestSchemaMapping({ ...context }, { consent: true })).rejects.toMatchObject({ code: "INVALID_CONTEXT" });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each([[401, "AUTH_REQUIRED"], [429, "RATE_LIMITED"], [503, "HOSTED_CONFIGURATION"]])("maps HTTP %i to a fixed error without displaying provider text", async (status, code) => {
    const fetcher = vi.fn(async () => json({ code, error: "PRIVATE_KEY_ERROR" }, status as number)); vi.stubGlobal("fetch", fetcher);
    const error = await createHostedProvider().analyzeRootCause(rootCauseFixture().context, { consent: true }).catch(error => error);
    expect(error).toMatchObject({ code }); expect(error.message).not.toContain("PRIVATE"); expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("does not fall back to Ollama or retry an unavailable hosted provider", async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error("PRIVATE_UPSTREAM")); vi.stubGlobal("fetch", fetcher);
    await expect(createHostedProvider().analyzeRootCause(rootCauseFixture().context, { consent: true })).rejects.toMatchObject({ code: "HOSTED_UNAVAILABLE" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("rejects model schema/semantic hallucinations with the original validators", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ result: { ...groundedKeyResponse, explanations: [{ ...groundedKeyResponse.explanations[0], cause: "REFERENCE_REVIEW" }] } })));
    await expect(createHostedProvider().analyzeRootCause(rootCauseFixture().context, { consent: true })).rejects.toMatchObject({ code: "INVALID_RESPONSE", diagnostic: "UNSUPPORTED_CLAIM" });
  });
  it("keeps repair resolution and deterministic What-if browser-local", async () => {
    const fixture = repairCandidateFixture(); vi.stubGlobal("fetch", vi.fn(async () => json({ result: fixture.recommendation })));
    const session = createSmartRepairSession(createHostedProvider()); session.setContext(fixture.context); await session.run(true);
    const state = session.getSnapshot(); expect(state.status).toBe("ready");
    if (state.status !== "ready") throw new Error("Missing plan");
    expect(state.result.resolution.outcome).toBe("ACTIONABLE_CANDIDATE");
    if (state.result.resolution.outcome !== "ACTIONABLE_CANDIDATE") throw new Error("Missing local candidate");
    expect(readLocalRepairCandidate(state.result.resolution.candidate).edit).toMatchObject({ expectedValue: "yes", value: "true" });
    expect(state.result.verification?.outcome).toBe("PREVIEW_READY");
    expect(fixture.getSnapshot().corrections.undoStack).toHaveLength(0);
  });
  it("does not publish a delayed response after a context change", async () => {
    let finish!: (value: Response) => void;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(resolve => { finish = resolve; })));
    const session = createRootCauseSession(createHostedProvider()); session.setContext(rootCauseFixture().context);
    const pending = session.run(true); session.setContext(rootCauseFixture().context);
    finish(json({ result: groundedKeyResponse })); await pending;
    expect(session.getSnapshot().status).toBe("stale");
  });
  it("enforces timeout and cancellation even if fetch ignores its signal", async () => {
    vi.useFakeTimers(); vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));
    const pending = createHostedProvider({ timeoutMs: 10 }).analyzeRootCause(rootCauseFixture().context, { consent: true });
    const timeout = expect(pending).rejects.toMatchObject({ code: "HOSTED_TIMEOUT" }); await vi.advanceTimersByTimeAsync(11); await timeout;
    const controller = new AbortController(); const cancelled = createHostedProvider().analyzeRootCause(rootCauseFixture().context, { consent: true, signal: controller.signal });
    const result = expect(cancelled).rejects.toEqual(new AiError("CANCELLED")); controller.abort(); await result;
  });
  it("rejects oversized or malformed successful responses", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ result: "x".repeat(129 * 1024) })));
    await expect(createHostedProvider().analyzeRootCause(rootCauseFixture().context, { consent: true })).rejects.toMatchObject({ code: "RESPONSE_TOO_LARGE" });
    vi.stubGlobal("fetch", vi.fn(async () => new Response("not JSON", { headers: { "Content-Type": "application/json" } })));
    await expect(createHostedProvider().analyzeRootCause(rootCauseFixture().context, { consent: true })).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });
});
