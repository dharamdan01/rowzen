export const workspaceDepartureMessage = "Leave this workspace? CSV data, local settings and corrections will be lost. Saved validation summaries do not contain your CSV data or restore this workspace.";
export const departureRequestEvent = "data-rehearsal:request-departure";
export const departureApprovedEvent = "data-rehearsal:approved-unload";

/** Ask before destructive actions such as sign-out, before sending any request. */
export function requestWorkspaceDeparture(): boolean {
  return window.dispatchEvent(new Event(departureRequestEvent, { cancelable: true }));
}

/** Only call immediately before a previously approved full-document departure. */
export function approveWorkspaceUnload(): void {
  window.dispatchEvent(new Event(departureApprovedEvent));
}
