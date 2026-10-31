import type { KeyboardEvent } from "react";

/** Keep Tab at a modal's control boundaries; native dialogs still own inertness and Escape. */
export function trapDialogFocus(event: KeyboardEvent<HTMLDialogElement>) {
  if (event.key !== "Tab" || event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
  const controls = [...event.currentTarget.querySelectorAll<HTMLElement>("button, a[href], input, select, textarea, [tabindex]")]
    .filter(node => node.tabIndex >= 0 && !node.matches(":disabled, [hidden]") && node.getClientRects().length > 0 && getComputedStyle(node).visibility !== "hidden");
  const first = controls[0], last = controls[controls.length - 1];
  if (!first) { event.preventDefault(); event.currentTarget.focus(); return; }
  if (event.shiftKey && (document.activeElement === first || document.activeElement === event.currentTarget)) {
    event.preventDefault(); last.focus();
  } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === event.currentTarget)) {
    event.preventDefault(); first.focus();
  }
}
