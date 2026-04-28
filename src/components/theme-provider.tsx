"use client";

import * as React from "react";

export type Theme = "light" | "dark" | "system";

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
}

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  enableSystem?: boolean;
  attribute?: "class";
  disableTransitionOnChange?: boolean;
}

const STORAGE_KEY = "theme";

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

// useLayoutEffect fires synchronously before the browser paints, preventing
// the theme flash. It can't run on the server, so we fall back to useEffect
// there (Next.js SSR for "use client" components).
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;

function resolveTheme(theme: Theme, enableSystem: boolean): "light" | "dark" {
  if (theme === "light") return "light";
  if (theme === "dark") return "dark";
  if (!enableSystem || typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function ThemeProvider({
  children,
  defaultTheme = "system",
  enableSystem = true,
  attribute = "class",
}: ThemeProviderProps) {
  const [theme, setThemeState] = React.useState<Theme>(defaultTheme);

  // On first client render, sync state with localStorage before paint so the
  // context value matches what the blocking <script> already applied to <html>.
  useIsomorphicLayoutEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    const next =
      saved === "light" || saved === "dark" || saved === "system"
        ? (saved as Theme)
        : defaultTheme;
    setThemeState(next);
  }, [defaultTheme]);

  // Derive resolvedTheme inline — no separate state needed, no extra render.
  const resolvedTheme = resolveTheme(theme, enableSystem);

  // Keep the <html> class in sync with resolvedTheme. useLayoutEffect ensures
  // this runs before paint so there is no flash when the theme changes.
  useIsomorphicLayoutEffect(() => {
    if (attribute !== "class") return;
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(resolvedTheme);
  }, [attribute, resolvedTheme]);

  // Re-resolve and re-apply when the OS dark-mode preference changes.
  React.useEffect(() => {
    if (!enableSystem || theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      const next = media.matches ? "dark" : "light";
      document.documentElement.classList.remove("light", "dark");
      document.documentElement.classList.add(next);
    };
    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  }, [theme, enableSystem]);

  const setTheme = React.useCallback((next: Theme) => {
    setThemeState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  }, []);

  const value = React.useMemo<ThemeContextValue>(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = React.useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
