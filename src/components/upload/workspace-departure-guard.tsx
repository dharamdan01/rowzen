"use client";

import { useEffect } from "react";
import { registerWorkspaceTraversal } from "../../lib/browser/workspace-history";
import { departureApprovedEvent, departureRequestEvent, workspaceDepartureMessage } from "../../lib/browser/workspace-departure";

type IndexedWindow = Window & { navigation?: { currentEntry?: { index: number } } };
const pageKey = (url: string) => { const parsed = new URL(url); return parsed.origin + parsed.pathname + parsed.search; };

export default function WorkspaceDepartureGuard({ active }: { active: boolean }) {
  useEffect(() => {
    if (!active) return;
    let allowNextUnload = false;
    let previousUrl = window.location.href;
    const currentIndex = () => (window as IndexedWindow).navigation?.currentEntry?.index;
    let previousIndex = currentIndex();
    let restoringHistory = false;
    const confirm = () => window.confirm(workspaceDepartureMessage);
    const approveUnload = () => { allowNextUnload = true; };
    const requestDeparture = (event: Event) => { if (!confirm()) event.preventDefault(); };
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (allowNextUnload) { allowNextUnload = false; return; }
      event.preventDefault();
      event.returnValue = "";
    };
    const click = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!anchor || anchor.download || (anchor.target && anchor.target !== "_self")) return;
      const destination = new URL(anchor.href);
      if (destination.origin !== window.location.origin || pageKey(destination.href) === pageKey(window.location.href)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!confirm()) return;
      // Once data loss is approved, a full departure avoids a second SPA prompt
      // and lets the native unload listener consume the one-time approval.
      approveUnload();
      window.location.assign(destination.href);
    };
    const popState = (event: PopStateEvent) => {
      const index = currentIndex();
      if (restoringHistory) {
        restoringHistory = false;
        event.stopImmediatePropagation();
        return;
      }
      if (pageKey(window.location.href) === pageKey(previousUrl)) {
        previousUrl = window.location.href; previousIndex = index; return;
      }
      // Read browser-owned indices; never mutate Next's history state or add
      // sentinel entries. Without indexed history, native unload is the fallback.
      if (previousIndex !== undefined && index !== undefined && previousIndex !== index && !confirm()) {
        event.stopImmediatePropagation();
        restoringHistory = true;
        window.history.go(previousIndex - index);
        return;
      }
      previousUrl = window.location.href; previousIndex = index;
    };
    window.addEventListener("beforeunload", beforeUnload);
    const unregisterTraversal = registerWorkspaceTraversal(popState);
    window.addEventListener(departureRequestEvent, requestDeparture);
    window.addEventListener(departureApprovedEvent, approveUnload);
    document.addEventListener("click", click, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      unregisterTraversal();
      window.removeEventListener(departureRequestEvent, requestDeparture);
      window.removeEventListener(departureApprovedEvent, approveUnload);
      document.removeEventListener("click", click, true);
    };
  }, [active]);

  if (!active) return null;
  return <aside role="note" aria-label="Browser-local CSV session" className="rounded-lg border border-warning bg-warning-surface p-3 text-sm text-foreground">
    CSV data, local settings and corrections stay in this tab. Leaving or refreshing discards them. Saved validation summaries do not contain your CSV data or restore this workspace.
  </aside>;
}
