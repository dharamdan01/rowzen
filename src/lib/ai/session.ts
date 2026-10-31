import { AiError, safeAiError, sameAiVersion, type AiAcknowledgement, type AiErrorCode, type AiVersion } from "./contracts";
import { serializeAiContext, validateAiAcknowledgement, type AiContext } from "./context";
import type { AiPhase, AiProvider, AiRunOptions } from "./providers/ollama";

export type AiRequestState<Result = AiAcknowledgement> =
  | Readonly<{ status: "idle" }>
  | Readonly<{ status: "loading"; phase: AiPhase }>
  | Readonly<{ status: "ready"; version: AiVersion; result: Result }>
  | Readonly<{ status: "error"; code: AiErrorCode; message: string }>
  | Readonly<{ status: "cancelled" | "stale" }>;

/** In-memory observable owner: no persistence, credentials, automatic retries or mutations. */
export function createAiSession(provider: AiProvider) {
  return createAiRequestSession<AiContext, AiAcknowledgement>(provider.run, serializeAiContext, validateAiAcknowledgement);
}

/** Shared lifecycle; feature adapters retain their own sealed contexts and strict validators. */
export function createAiRequestSession<Context extends { version: AiVersion }, Result>(
  run: (context: Context, options: AiRunOptions) => Promise<Result>,
  serialize: (context: Context) => string,
  validate: (context: Context, value: unknown) => Result,
) {
  let context: Context | null = null;
  let state: AiRequestState<Result> = Object.freeze({ status: "idle" });
  let current: { controller: AbortController; context: Context } | null = null;
  let disposed = false;
  const listeners = new Set<() => void>();
  const publish = (next: AiRequestState<Result>) => { state = Object.freeze(next); for (const listener of listeners) listener(); };
  const stop = (status: "cancelled" | "stale") => { const request = current; current = null; request?.controller.abort(); publish({ status }); };
  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    setContext(next: Context | null) {
      if (disposed) return;
      if (next) serialize(next);
      if (next === context) return;
      const hadContext = context !== null;
      context = next;
      if (current || hadContext) stop("stale"); else publish({ status: "idle" });
    },
    async run(consent: boolean): Promise<void> {
      if (disposed) return;
      if (current) return;
      if (consent !== true) { const error = new AiError("CONSENT_REQUIRED"); publish({ status: "error", code: error.code, message: error.message }); return; }
      if (!context) { const error = new AiError("INVALID_CONTEXT"); publish({ status: "error", code: error.code, message: error.message }); return; }
      const request = { controller: new AbortController(), context };
      current = request; publish({ status: "loading", phase: "checking-model" });
      try {
        const result = await run(request.context, { consent, signal: request.controller.signal,
          onPhase: phase => { if (current === request) publish({ status: "loading", phase }); } });
        if (disposed || current !== request) return;
        if (context !== request.context || !sameAiVersion(context.version, request.context.version)) { publish({ status: "stale" }); return; }
        publish({ status: "ready", version: context.version, result: validate(context, result) });
      } catch (error) {
        if (disposed || current !== request) return;
        const safe = safeAiError(error);
        if (safe.code === "CANCELLED") publish({ status: "cancelled" });
        else publish({ status: "error", code: safe.code, message: safe.message });
      } finally { if (current === request) current = null; }
    },
    cancel() { if (current) stop("cancelled"); },
    dispose() { disposed = true; current?.controller.abort(); current = null; context = null; publish({ status: "idle" }); listeners.clear(); },
  };
}
export type AiSession = ReturnType<typeof createAiSession>;
