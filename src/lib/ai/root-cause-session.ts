import { createAiRequestSession } from "./session";
import { createConfiguredAiProvider } from "./providers/configured";
import { assertRootCauseCurrent, serializeRootCauseContext, validateRootCauseResponse, type RootCauseContext, type RootCauseResponse } from "./root-cause";
import type { AiRequestState } from "./session";

const stale: AiRequestState<RootCauseResponse> = Object.freeze({ status: "stale" });
/** Optional client-owned lifecycle. Retry is explicit; callers invalidate/setContext on workspace changes. */
export function createRootCauseSession(provider = createConfiguredAiProvider()) {
  const session = createAiRequestSession<RootCauseContext, RootCauseResponse>(provider.analyzeRootCause, serializeRootCauseContext, validateRootCauseResponse);
  let context: RootCauseContext | null = null;
  let disposed = false;
  return {
    ...session,
    setContext(next: RootCauseContext | null) { if (!disposed) { session.setContext(next); context = next; } },
    dispose() { disposed = true; context = null; session.dispose(); },
    getSnapshot(): AiRequestState<RootCauseResponse> {
      const state = session.getSnapshot();
      if (state.status === "error" && state.code === "STALE") return stale;
      if (state.status === "ready" && context) { try { assertRootCauseCurrent(context); } catch { return stale; } }
      return state;
    },
  };
}
