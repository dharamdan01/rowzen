export type ThemePreference = "light" | "dark" | "system";

export function normalizeThemePreference(value: unknown): ThemePreference {
  return value === "light" || value === "dark" ? value : "system";
}

// Self-contained so the exact same runtime can execute in <head> before paint.
// Only an allowlisted appearance preference is stored; never workspace data.
export function initializeTheme() {
  const root = document.documentElement;
  if (root.dataset.themePreference) return;
  const key = "datarehearsal-theme";
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const normalize = (value: unknown) => value === "light" || value === "dark" ? value : "system";
  let preference: "light" | "dark" | "system" = "system";
  try { preference = normalize(window.localStorage.getItem(key)); } catch { /* Storage may be unavailable. */ }
  function apply() {
    root.dataset.themePreference = preference;
    root.dataset.theme = preference === "system" ? media.matches ? "dark" : "light" : preference;
    window.dispatchEvent(new Event("datarehearsal:theme-change"));
  }
  window.addEventListener("datarehearsal:theme-select", event => {
    preference = normalize((event as CustomEvent).detail);
    try {
      window.localStorage.setItem(key, preference);
      root.dataset.themePersistence = "saved";
    } catch {
      // The selected appearance still works, but must not look persisted.
      root.dataset.themePersistence = "unavailable";
    }
    apply();
  });
  window.addEventListener("storage", event => {
    if (event.key === key || event.key === null) {
      preference = normalize(event.newValue);
      root.dataset.themePersistence = "";
      apply();
    }
  });
  media.addEventListener("change", () => { if (preference === "system") apply(); });
  apply();
}

export const themeInitializationScript = `(${initializeTheme.toString()})();`;
