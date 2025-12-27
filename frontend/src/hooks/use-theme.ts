import { useEffect, useState } from "react";

export type ThemePreference = "system" | "light" | "dark";

const THEME_KEY = "theme";

function getInitialPreference(): ThemePreference {
  if (typeof window === "undefined") return "system";

  const stored = localStorage.getItem(THEME_KEY);
  if (stored === "light" || stored === "dark") {
    return stored;
  }
  return "system";
}

function applyTheme(preference: ThemePreference) {
  const root = document.documentElement;
  root.classList.remove("dark");

  if (preference === "dark") {
    root.classList.add("dark");
  } else if (preference === "system") {
    if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      root.classList.add("dark");
    }
  }
  // "light" = no .dark class, :root values apply
}

export function useTheme() {
  const [preference, setPreferenceState] = useState<ThemePreference>(getInitialPreference);

  // Apply theme and persist to localStorage
  useEffect(() => {
    applyTheme(preference);

    if (preference === "system") {
      localStorage.removeItem(THEME_KEY);
    } else {
      localStorage.setItem(THEME_KEY, preference);
    }
  }, [preference]);

  // Listen to system preference changes when in system mode
  useEffect(() => {
    if (preference !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handler = (e: MediaQueryListEvent) => {
      document.documentElement.classList.toggle("dark", e.matches);
    };

    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, [preference]);

  const setPreference = (newPreference: ThemePreference) => {
    setPreferenceState(newPreference);
  };

  const cycleTheme = () => {
    setPreferenceState((prev) => {
      if (prev === "system") return "light";
      if (prev === "light") return "dark";
      return "system";
    });
  };

  return { preference, setPreference, cycleTheme };
}
