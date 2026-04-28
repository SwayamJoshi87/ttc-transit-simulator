"use client";

import * as React from "react";

export type Theme = "light" | "dark" | "system";

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: Theme, origin?: { x: number; y: number }) => void;
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

function resolveTheme(theme: Theme, enableSystem: boolean): "light" | "dark" {
  if (theme === "light") return "light";
  if (theme === "dark") return "dark";
  if (!enableSystem) return "light";
  if (typeof window === "undefined") return "light";
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
  const [resolvedTheme, setResolvedTheme] = React.useState<"light" | "dark">(
    "light",
  );

  React.useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    const nextTheme =
      saved === "light" || saved === "dark" || saved === "system"
        ? saved
        : defaultTheme;
    setThemeState(nextTheme);
  }, [defaultTheme]);

  React.useEffect(() => {
    const update = () => {
      const nextResolved = resolveTheme(theme, enableSystem);
      setResolvedTheme(nextResolved);
      if (attribute === "class") {
        const root = document.documentElement;
        root.classList.remove("light", "dark");
        root.classList.add(nextResolved);
      }
    };

    update();

    if (!enableSystem || theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => update();
    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  }, [theme, enableSystem, attribute]);

  const setTheme = React.useCallback(
    (nextTheme: Theme, origin?: { x: number; y: number }) => {
      const nextResolved = resolveTheme(nextTheme, enableSystem);
      window.localStorage.setItem(STORAGE_KEY, nextTheme);

      const doApply = () => {
        if (attribute === "class") {
          const root = document.documentElement;
          root.classList.remove("light", "dark");
          root.classList.add(nextResolved);
        }
        setThemeState(nextTheme);
        setResolvedTheme(nextResolved);
      };

      if (
        origin &&
        typeof document !== "undefined" &&
        "startViewTransition" in document
      ) {
        document.documentElement.style.setProperty(
          "--theme-x",
          `${origin.x}px`,
        );
        document.documentElement.style.setProperty(
          "--theme-y",
          `${origin.y}px`,
        );
        (
          document as Document & {
            startViewTransition: (cb: () => void) => unknown;
          }
        ).startViewTransition(doApply);
      } else {
        doApply();
      }
    },
    [enableSystem, attribute],
  );

  const value = React.useMemo<ThemeContextValue>(
    () => ({
      theme,
      resolvedTheme,
      setTheme,
    }),
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
