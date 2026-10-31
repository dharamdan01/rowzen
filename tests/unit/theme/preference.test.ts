
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";
import { normalizeThemePreference, themeInitializationScript } from "../../../src/lib/theme/preference";
import { themeStyleSheet } from "../../../src/lib/theme/tokens";

function browser(saved: string | null = null, dark = false, blocked = false) {
  const data: Record<string, string> = saved === null ? {} : { "datarehearsal-theme": saved };
  const root = { dataset: {} as Record<string, string> };
  const media = Object.assign(new EventTarget(), { matches: dark });
  const setItem = vi.fn((key: string, value: string) => { if (blocked) throw new Error("Unavailable"); data[key] = value; });
  const window = Object.assign(new EventTarget(), { matchMedia: () => media, localStorage: {
    getItem: (key: string) => { if (blocked) throw new Error("Unavailable"); return data[key] ?? null; }, setItem,
  } });
  const context = { window, document: { documentElement: root }, Event };
  runInNewContext(themeInitializationScript, context);
  const select = (detail: unknown) => window.dispatchEvent(Object.assign(new Event("datarehearsal:theme-select"), { detail }));
  const storage = (key: string | null, newValue: string | null) => window.dispatchEvent(Object.assign(new Event("storage"), { key, newValue }));
  return { root, media, window, data, select, storage, setItem, context };
}

describe("pre-paint theme preference", () => {
  it.each([null, "system", "unknown"])("follows system for %s without persisting defaults", saved => {
    const b = browser(saved, true); expect(b.root.dataset).toMatchObject({ theme: "dark", themePreference: "system" });
    b.media.matches = false; b.media.dispatchEvent(new Event("change")); expect(b.root.dataset.theme).toBe("light");
    expect(b.setItem).not.toHaveBeenCalled();
  });
  it.each(["light", "dark"])("keeps explicit %s despite system changes", saved => {
    const b = browser(saved, saved !== "dark"); expect(b.root.dataset.theme).toBe(saved);
    b.media.matches = !b.media.matches; b.media.dispatchEvent(new Event("change")); expect(b.root.dataset.theme).toBe(saved);
  });
  it("stores only the selected appearance preference and resumes system observation", () => {
    const b = browser(null, true); b.select("light"); expect(b.data).toEqual({ "datarehearsal-theme": "light" });
    b.select("system"); expect(b.root.dataset.theme).toBe("dark");
    b.select({ csv: "not a preference" }); expect(b.root.dataset.themePreference).toBe("system");
  });
  it("handles cross-tab changes/removal and ignores unrelated storage", () => {
    const b = browser("light", true); b.storage("another-key", "dark"); expect(b.root.dataset.theme).toBe("light");
    b.storage("datarehearsal-theme", "dark"); expect(b.root.dataset.theme).toBe("dark");
    b.storage(null, null); expect(b.root.dataset.themePreference).toBe("system"); expect(b.root.dataset.theme).toBe("dark");
  });
  it("remains usable when storage is blocked and is idempotent", () => {
    const b = browser(null, false, true); b.select("dark"); expect(b.root.dataset.theme).toBe("dark");
    runInNewContext(themeInitializationScript, b.context); b.select("light"); expect(b.setItem).toHaveBeenCalledTimes(2);
  });
  it("reports only actual preference persistence and clears stale feedback on cross-tab changes", () => {
    const saved = browser(); saved.select("dark");
    expect(saved.root.dataset.themePersistence).toBe("saved");
    saved.storage("datarehearsal-theme", "light");
    expect(saved.root.dataset.themePersistence).toBe("");
    const blocked = browser(null, false, true); blocked.select("dark");
    expect(blocked.root.dataset.theme).toBe("dark");
    expect(blocked.root.dataset.themePersistence).toBe("unavailable");
    expect(blocked.data).toEqual({});
  });
  it("normalizes untrusted persisted values", () => {
    expect(normalizeThemePreference("dark")).toBe("dark"); expect(normalizeThemePreference("light")).toBe("light");
    expect(normalizeThemePreference("DARK")).toBe("system"); expect(normalizeThemePreference(null)).toBe("system");
  });
});

function luminance(hex: string) {
  const channels = hex.match(/[a-f\d]{2}/gi)!.map(value => parseInt(value, 16) / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
}
function contrast(a: string, b: string) { const x = luminance(a), y = luminance(b); return (Math.max(x,y) + .05) / (Math.min(x,y) + .05); }
const css = themeStyleSheet;
for (const theme of ["light", "dark"]) {
  const block = theme === "light" ? css.match(/:root\{([^}]+)\}/)![1] : css.match(/:root\[data-theme="dark"\]\{([^}]+)\}/)![1];
  const tokens = Object.fromEntries([...block.matchAll(/--([\w-]+):(#[a-f\d]{6});/gi)].map(m => [m[1],m[2]]));
  it(`${theme} semantic text, controls and focus meet AA contrast thresholds`, () => {
    for (const surface of ["background","surface","sidebar","surface-muted","surface-hover"]) {
      for (const text of ["foreground","muted-foreground","primary"]) expect(contrast(tokens[text],tokens[surface]), `${text} on ${surface}`).toBeGreaterThanOrEqual(4.5);
      for (const text of ["control-border","focus-ring"]) expect(contrast(tokens[text],tokens[surface]), `${text} on ${surface}`).toBeGreaterThanOrEqual(3);
    }
    for (const status of ["success","warning","danger","info"]) expect(contrast(tokens[status],tokens[`${status}-surface`]), status).toBeGreaterThanOrEqual(4.5);
    for (const background of ["primary","primary-hover"]) expect(contrast(tokens["primary-foreground"],tokens[background]), background).toBeGreaterThanOrEqual(4.5);
  });
}
