let traversalHandler: ((event: PopStateEvent) => void) | null = null;

/** Installed before hydration so a cancelled traversal cannot reach router listeners. */
export function installWorkspaceHistoryBridge(): () => void {
  const listener = (event: PopStateEvent) => traversalHandler?.(event);
  window.addEventListener("popstate", listener, true);
  return () => window.removeEventListener("popstate", listener, true);
}

export function registerWorkspaceTraversal(handler: (event: PopStateEvent) => void): () => void {
  traversalHandler = handler;
  return () => { if (traversalHandler === handler) traversalHandler = null; };
}
