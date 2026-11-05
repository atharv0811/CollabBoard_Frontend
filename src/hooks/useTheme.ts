import { useSyncExternalStore } from "react";

export type ThemePreference = "light" | "dark" | "system";

/** Keep in sync with the inline script in index.html */
const STORAGE_KEY = "collabboard-theme";
const DEFAULT_THEME: ThemePreference = "dark";

const systemDarkQuery = window.matchMedia("(prefers-color-scheme: dark)");
const listeners = new Set<() => void>();

function isThemePreference(value: unknown): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

function readStoredTheme(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isThemePreference(stored)) return stored;
  } catch {
    // Storage can be unavailable (private mode, blocked cookies) — fall back to default.
  }
  return DEFAULT_THEME;
}

let currentTheme = readStoredTheme();

/** Toggle the `.dark` class on <html> based on the preference (and OS setting for "system"). */
function applyTheme() {
  const isDark = currentTheme === "dark" || (currentTheme === "system" && systemDarkQuery.matches);
  document.documentElement.classList.toggle("dark", isDark);
}

export function setTheme(theme: ThemePreference) {
  currentTheme = theme;
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Non-fatal: the theme still applies for this session.
  }
  applyTheme();
  listeners.forEach((listener) => listener());
}

// Follow live OS changes while "system" is selected.
systemDarkQuery.addEventListener("change", () => {
  if (currentTheme === "system") applyTheme();
});

applyTheme();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Current theme preference + setter. State lives at module level, so every
 * component shares it and it survives components unmounting (e.g. the
 * board menu closing).
 */
export function useTheme() {
  const theme = useSyncExternalStore(subscribe, () => currentTheme);
  return { theme, setTheme };
}
