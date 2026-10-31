import { z } from "zod";
import { AiError, aiErrorMessages, type AiErrorCode } from "../contracts";
import { serializeAiContext, validateAiAcknowledgement, type AiContext } from "../context";
import { serializeSchemaMappingContext, decodeSchemaMappingResponse, type SchemaMappingContext } from "../schema-mapping";
import { serializeRootCauseContext, validateRootCauseResponse, type RootCauseContext } from "../root-cause";
import { serializeSmartRepairContext, validateSmartRepairRecommendation, type SmartRepairContext } from "../smart-repair";
import type { AiRunOptions } from "./ollama";
import { parseHostedRequest, type AiFeature } from "./hosted-contracts";
import { readBoundedJson } from "./bounded-json";

const envelope = z.object({ result: z.unknown() }).strict();
/** Same-origin authenticated proxy. Only existing privacy-reviewed serializers are sent. */
export function createHostedProvider({ timeoutMs = 50_000 }: { timeoutMs?: number } = {}) {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 10 || timeoutMs > 120_000) throw new AiError("UNSAFE_PROVIDER");
  async function request<T>(feature: AiFeature, serialize: () => string, validate: (value: unknown) => T, options: AiRunOptions): Promise<T> {
    if (options.consent !== true) throw new AiError("CONSENT_REQUIRED");
    const body = parseHostedRequest({ feature, consent: true, metadata: JSON.parse(serialize()) });
    const controller = new AbortController();
    const abort = () => controller.abort(new AiError("CANCELLED"));
    if (options.signal?.aborted) abort();
    options.signal?.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(() => controller.abort(new AiError("HOSTED_TIMEOUT")), timeoutMs);
    // Promise.race also enforces cancellation when a transport ignores AbortSignal.
    let rejectAbort!: (error: unknown) => void;
    const aborted = new Promise<never>((_, reject) => { rejectAbort = reject; });
    const reject = () => rejectAbort(controller.signal.reason);
    controller.signal.addEventListener("abort", reject, { once: true });
    const perform = async () => {
      controller.signal.throwIfAborted(); options.onPhase?.("generating");
      let response: Response;
      try { response = await fetch("/api/ai/inference", { method: "POST", credentials: "same-origin", mode: "same-origin",
        redirect: "error", cache: "no-store", signal: controller.signal,
        headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(body) }); }
      catch { controller.signal.throwIfAborted(); throw new AiError("HOSTED_UNAVAILABLE"); }
      if (!response.ok) {
        let code: AiErrorCode = response.status === 401 ? "AUTH_REQUIRED" : response.status === 429 ? "RATE_LIMITED" : "HOSTED_UNAVAILABLE";
        try {
          const error = z.object({ code: z.string() }).passthrough().parse(await readBoundedJson(response, controller.signal, 2048));
          if (Object.hasOwn(aiErrorMessages, error.code)) code = error.code as AiErrorCode;
        } catch { /* Never display untrusted server/provider prose. */ }
        throw new AiError(code);
      }
      const parsed = envelope.safeParse(await readBoundedJson(response, controller.signal));
      if (!parsed.success) throw new AiError("INVALID_RESPONSE", "RESPONSE_ENVELOPE");
      controller.signal.throwIfAborted(); return validate(parsed.data.result);
    };
    try { controller.signal.throwIfAborted(); return await Promise.race([perform(), aborted]); }
    catch (error) { if (controller.signal.aborted) throw controller.signal.reason; throw error instanceof AiError ? error : new AiError("INVALID_RESPONSE"); }
    finally { clearTimeout(timer); options.signal?.removeEventListener("abort", abort); controller.signal.removeEventListener("abort", reject); }
  }
  return Object.freeze({
    id: "groq-hosted" as const,
    // The foundation diagnostic is local-only; never ship a second unreviewed payload shape.
    async run(context: AiContext, options: AiRunOptions) {
      if (!options.consent) throw new AiError("CONSENT_REQUIRED");
      serializeAiContext(context); validateAiAcknowledgement(context, { schemaVersion: 1, abstained: true, acknowledgedFactIds: [] });
      throw new AiError("HOSTED_CONFIGURATION");
    },
    suggestSchemaMapping: (context: SchemaMappingContext, options: AiRunOptions) => request("schema-mapping", () => serializeSchemaMappingContext(context), value => decodeSchemaMappingResponse(context, value), options),
    analyzeRootCause: (context: RootCauseContext, options: AiRunOptions) => request("root-cause", () => serializeRootCauseContext(context), value => validateRootCauseResponse(context, value), options),
    selectRepairStrategy: (context: SmartRepairContext, options: AiRunOptions) => request("smart-repair", () => serializeSmartRepairContext(context), value => validateSmartRepairRecommendation(context, value), options),
  });
}
