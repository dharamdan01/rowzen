import { createAiRequestSession, type AiRequestState } from "./session";
import type { AiRunOptions } from "./providers/ollama";
import { createConfiguredAiProvider } from "./providers/configured";
import { serializeSmartRepairContext, assertSmartRepairCurrent, type SmartRepairContext } from "./smart-repair";
import type { SmartRepairRecommendation } from "./smart-repair-contracts";
import { invalidateSmartRepairPlan, prepareSmartRepairPlan, validateSmartRepairPlan, type SmartRepairPlan } from "./smart-repair-plan";

type RepairProvider = { selectRepairStrategy: (context: SmartRepairContext, options: AiRunOptions) => Promise<SmartRepairRecommendation> };
const stale: AiRequestState<SmartRepairPlan> = Object.freeze({ status: "stale" });
const cancelled: AiRequestState<SmartRepairPlan> = Object.freeze({ status: "cancelled" });

/** Shared request lifecycle plus local resolution/verification. No global mutation lock or automatic retries. */
export function createSmartRepairSession(provider: RepairProvider = createConfiguredAiProvider()) {
  const session = createAiRequestSession<SmartRepairContext, SmartRepairPlan>(
    async (context, options) => prepareSmartRepairPlan(context, await provider.selectRepairStrategy(context, options), options.signal),
    serializeSmartRepairContext, validateSmartRepairPlan,
  );
  let context: SmartRepairContext | null = null;
  let disposed = false;
  const listeners = new Set<() => void>();
  const notify = () => { for (const listener of listeners) listener(); };
  const unsubscribe = session.subscribe(notify);
  const invalidateReady = (reason: "STALE" | "CANCELLED") => {
    const state = session.getSnapshot();
    if (state.status === "ready") invalidateSmartRepairPlan(state.result, reason);
  };
  return {
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    getSnapshot(): AiRequestState<SmartRepairPlan> {
      const state = session.getSnapshot();
      if (state.status === "error" && state.code === "STALE") return stale;
      if (state.status === "ready" && context) {
        try { assertSmartRepairCurrent(context); validateSmartRepairPlan(context, state.result); }
        catch (error) { return error instanceof Error && "code" in error && error.code === "CANCELLED" ? cancelled : stale; }
      }
      return state;
    },
    setContext(next: SmartRepairContext | null) {
      if (disposed || next === context) return;
      if (next) serializeSmartRepairContext(next);
      invalidateReady("STALE"); context = next; session.setContext(next);
    },
    async run(consent: boolean) {
      if (disposed || session.getSnapshot().status === "loading") return;
      invalidateReady("STALE"); await session.run(consent);
    },
    cancel() { if (!disposed) { invalidateReady("CANCELLED"); session.cancel(); notify(); } },
    dispose() { if (!disposed) { invalidateReady("STALE"); context = null; disposed = true; session.dispose(); unsubscribe(); listeners.clear(); } },
  };
}
