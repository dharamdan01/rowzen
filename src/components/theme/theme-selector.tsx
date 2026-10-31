"use client";

import { useId, useSyncExternalStore } from "react";
import { SunMoon } from "lucide-react";
import { Select } from "../ui/primitives";
import { normalizeThemePreference } from "../../lib/theme/preference";

function subscribe(onChange: () => void) {
  window.addEventListener("datarehearsal:theme-change", onChange);
  return () => window.removeEventListener("datarehearsal:theme-change", onChange);
}
function snapshot() { return normalizeThemePreference(document.documentElement.dataset.themePreference); }
function serverSnapshot() { return "system" as const; }
function hydratedSnapshot() { return true; }
function serverHydratedSnapshot() { return false; }
function persistenceSnapshot() {
  const value = document.documentElement.dataset.themePersistence;
  return value === "saved" || value === "unavailable" ? value : "";
}
function serverPersistenceSnapshot() { return ""; }

export default function ThemeSelector() {
  const id = useId();
  const preference = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  // Native selection must wait until React can persist the change before navigation.
  const hydrated = useSyncExternalStore(subscribe, hydratedSnapshot, serverHydratedSnapshot);
  const persistence = useSyncExternalStore(subscribe, persistenceSnapshot, serverPersistenceSnapshot);
  return <div className="inline-flex min-w-0 max-w-56 flex-col items-start">
  <label htmlFor={id} className="inline-flex shrink-0 items-center gap-2 text-muted-foreground">
    <SunMoon aria-hidden="true" className="size-4" />
    <span className="sr-only">Color theme</span>
    <Select id={id} value={preference} disabled={!hydrated} title="Color theme" aria-describedby={persistence === "unavailable" ? `${id}-status` : undefined} className="w-25 text-sm"
      onChange={event => window.dispatchEvent(new CustomEvent("datarehearsal:theme-select", { detail: event.target.value }))}>
      <option value="light">Light</option><option value="dark">Dark</option><option value="system">System</option>
    </Select>
  </label>
  <p id={`${id}-status`} role="status" aria-live="polite" className={persistence === "unavailable" ? "mt-1 max-w-56 text-xs leading-relaxed text-warning [overflow-wrap:anywhere]" : "sr-only"}>
    {persistence === "unavailable" ? "Appearance works in this tab. It could not be saved on this device." : persistence === "saved" ? "Appearance saved on this device." : ""}
  </p>
  </div>;
}
