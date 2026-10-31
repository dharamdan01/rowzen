"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { Button, Spinner } from "../ui/primitives";
import type { AiSession, AiRequestState } from "../../lib/ai/session";
import { hostedAi } from "../../lib/ai/providers/configured";

const idle: AiRequestState = Object.freeze({ status: "idle" });
/** Presentation only; the caller must obtain fresh, snapshot-scoped consent on Retry. */
type StatusSession = Pick<AiSession, "subscribe" | "cancel"> & { getSnapshot: () => AiRequestState<unknown> };
export default function AiRequestStatus({ session, onRetry, readyMessage = "Local model connection check completed. This does not validate data or approve changes.", retryDisabled = false, showStale = true, loadingMessage, showSpinner = true }: {
  session: StatusSession; onRetry: () => void; readyMessage?: string; retryDisabled?: boolean; showStale?: boolean; loadingMessage?: string; showSpinner?: boolean;
}) {
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot, () => idle);
  const restoreFocus = useRef(false);
  const retry = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (restoreFocus.current && state.status === "cancelled") { restoreFocus.current = false; retry.current?.focus(); }
  }, [state.status]);
  if (state.status === "idle") return null;
  return <div className="min-w-0 space-y-2 rounded-lg border-l-2 border-border pl-3 text-sm">
    {state.status === "loading" && <div className="flex flex-wrap items-center justify-between gap-2"><p role="status" className="flex items-center gap-2 text-muted-foreground">{showSpinner && <Spinner />}{loadingMessage ?? (hostedAi ? "Waiting for hosted AI..." : state.phase === "checking-model" ? "Checking the local model..." : "Waiting for the local model...")}</p><Button type="button" onClick={() => { restoreFocus.current = true; session.cancel(); }}>Cancel AI request</Button></div>}
    {state.status === "error" && <><p role="alert" className="text-danger">{state.message}</p><Button type="button" disabled={retryDisabled} onClick={onRetry}>{hostedAi ? "Retry hosted AI" : "Retry local AI"}</Button></>}
    {state.status === "cancelled" && <><p role="status">{hostedAi ? "Hosted AI" : "Local model"} request cancelled. Your data is unchanged.</p><Button ref={retry} type="button" disabled={retryDisabled} onClick={onRetry}>{hostedAi ? "Retry hosted AI" : "Retry local AI"}</Button></>}
    {state.status === "stale" && showStale && <p role="status">The workspace changed. Previous AI output was discarded; request a fresh check.</p>}
    {state.status === "ready" && <p role="status">{readyMessage}</p>}
  </div>;
}
