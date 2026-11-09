import { useSyncExternalStore } from "react";

export type ThemePreference = "light" | "dark" | "system";

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
  }
  return DEFAULT_THEME;
}

let currentTheme = readStoredTheme();

function applyTheme() {
  const isDark = currentTheme === "dark" || (currentTheme === "system" && systemDarkQuery.matches);
  document.documentElement.classList.toggle("dark", isDark);
}

export function setTheme(theme: ThemePreference) {
  currentTheme = theme;
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
  }
  applyTheme();
  listeners.forEach((listener) => listener());
}

systemDarkQuery.addEventListener("change", () => {
  if (currentTheme === "system") applyTheme();
});

applyTheme();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, () => currentTheme);
  return { theme, setTheme };
}
