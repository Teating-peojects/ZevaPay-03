"use client";

import * as React from "react";
import {
  readStored,
  subscribeToStored,
  writeStored,
} from "@/lib/stored-state";

/**
 * Theme provider.
 *
 * The active theme is stored in `localStorage` under `zp-theme` and applied
 * by toggling the `dark` class on `<html>`. A small inline script in the
 * root layout applies the stored theme before paint so the page never
 * flashes the wrong colours.
 */

export type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "zp-theme";

/** Reads the stored theme, defaulting to the OS preference. */
function readStoredTheme(): Theme {
  const stored = readStored(STORAGE_KEY, "system");
  if (stored === "light" || stored === "dark" || stored === "system") {
    return stored;
  }
  return "system";
}

/** Resolves "system" to the concrete theme the OS is asking for. */
function resolveTheme(theme: Theme): "light" | "dark" {
  if (theme !== "system") return theme;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

/** Puts the theme onto the document element. */
function applyTheme(theme: Theme) {
  const root = document.documentElement;
  const resolved = resolveTheme(theme);
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;
}

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

/** Subscribes to changes of the stored theme. */
function subscribe(listener: () => void): () => void {
  return subscribeToStored(STORAGE_KEY, listener);
}

/** The current theme, read from storage. */
function getSnapshot(): Theme {
  return readStoredTheme();
}

/** The theme the server rendered with. */
function getServerSnapshot(): Theme {
  return "system";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // The theme lives in localStorage, so it is read through an external store
  // rather than copied into state inside an effect.
  const theme = React.useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  // While the theme is "system", follow the OS when it changes.
  React.useEffect(() => {
    if (theme !== "system") return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");

    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = React.useCallback((next: Theme) => {
    applyTheme(next);
    writeStored(STORAGE_KEY, next);
  }, []);

  const toggleTheme = React.useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  const value = React.useMemo(
    () => ({ theme, setTheme, toggleTheme }),
    [theme, setTheme, toggleTheme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

/** Reads the active theme. Falls back to light when no provider is present. */
export function useTheme(): ThemeContextValue {
  const context = React.useContext(ThemeContext);
  if (!context) {
    return {
      theme: "light",
      setTheme: () => {},
      toggleTheme: () => {},
    };
  }
  return context;
}

/**
 * Inline script that applies the stored theme before the first paint.
 *
 * Kept as a string so it can be injected into the <head> of the root
 * layout. It must not depend on anything outside `document`.
 */
export const themeInitScript = `
(function () {
  try {
    var stored = window.localStorage.getItem("${STORAGE_KEY}");
    var prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    var dark = stored ? stored === "dark" : prefersDark;
    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.style.colorScheme = dark ? "dark" : "light";
  } catch (error) {}
})();
`;
