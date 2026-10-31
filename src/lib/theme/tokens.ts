/** Public presentation tokens only. Shared by the app stylesheet and standalone SVGs. */
export const themeTokens = {
  light: {
    background: "#fafafb",
    foreground: "#111827",
    surface: "#ffffff",
    sidebar: "#f3f4f6",
    "surface-muted": "#f3f4f6",
    "surface-hover": "#f9fafb",
    "muted-foreground": "#4b5563",
    border: "#e5e7eb",
    "control-border": "#6b7280",
    "control-border-hover": "#4b5563",
    primary: "#5145cd",
    "primary-hover": "#4438b0",
    "primary-foreground": "#ffffff",
    success: "#167347",
    "success-surface": "#effaf3",
    warning: "#9a5b00",
    "warning-surface": "#fffaeb",
    danger: "#b42318",
    "danger-surface": "#fff1f0",
    info: "#5145cd",
    "info-surface": "#f1efff",
    "focus-ring": "#5145cd",
    overlay: "rgb(17 24 39 / 0.3)",
    "shadow-color": "rgb(17 24 39 / 0.04)",
  },
  dark: {
    background: "#0b0d12",
    foreground: "#f4f5f7",
    surface: "#171a22",
    sidebar: "#11141b",
    "surface-muted": "#222630",
    "surface-hover": "#262b36",
    "muted-foreground": "#b5bac7",
    border: "#2a2e38",
    "control-border": "#788398",
    "control-border-hover": "#b5bac7",
    primary: "#a69bff",
    "primary-hover": "#b9b1ff",
    "primary-foreground": "#11121a",
    success: "#80d9a4",
    "success-surface": "#13291e",
    warning: "#f2ca7c",
    "warning-surface": "#302411",
    danger: "#ffaaa2",
    "danger-surface": "#321c22",
    info: "#a69bff",
    "info-surface": "#252039",
    "focus-ring": "#b9b1ff",
    overlay: "rgb(0 0 0 / 0.65)",
    "shadow-color": "rgb(0 0 0 / 0.16)",
  },
} as const;

export type ThemeToken = keyof typeof themeTokens.light;

// Static, trusted constants rendered in <head> before the existing preference script.
// Tailwind's @theme inline aliases consume these same variables; there is no second palette.
export const themeStyleSheet = (["light", "dark"] as const).map(theme => {
  const selector = theme === "light" ? ":root" : ':root[data-theme="dark"]';
  const variables = Object.entries(themeTokens[theme]).map(([name, value]) => `--${name}:${value};`).join("");
  return `${selector}{${variables}}`;
}).join("");
