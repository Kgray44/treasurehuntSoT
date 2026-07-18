"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { normalizeApplicationTheme, type ApplicationTheme, type ThemePreferenceScope } from "@/theme/theme";

type ThemeStatus = "ready" | "loading" | "saving" | "saved" | "local" | "error";

type ThemeContextValue = {
  theme: ApplicationTheme;
  scope: ThemePreferenceScope;
  status: ThemeStatus;
  message: string;
  setTheme: (theme: ApplicationTheme) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);
const storageKey = "forever-treasure:application-theme";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const scope = scopeForPath(pathname);
  const [theme, setThemeState] = useState<ApplicationTheme>("verdant-depths");
  const [csrfToken, setCsrfToken] = useState("");
  const [status, setStatus] = useState<ThemeStatus>("loading");
  const [message, setMessage] = useState("Loading your application theme.");

  useEffect(() => {
    const local = normalizeApplicationTheme(localStorage.getItem(storageKey));
    queueMicrotask(() => setThemeState(local));
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = "dark";
    const themeColor = theme === "moonlit-blue" ? "#061020" : "#061612";
    let themeColorMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!themeColorMeta) {
      themeColorMeta = document.createElement("meta");
      themeColorMeta.name = "theme-color";
      document.head.appendChild(themeColorMeta);
    }
    themeColorMeta.content = themeColor;
  }, [theme]);

  useEffect(() => {
    if (scope === "anonymous") {
      queueMicrotask(() => {
        setCsrfToken("");
        setStatus("local");
        setMessage("Theme changes on this public screen are saved in this browser.");
      });
      return;
    }
    const controller = new AbortController();
    queueMicrotask(() => {
      setStatus("loading");
      setMessage("Loading your saved application theme.");
    });
    void fetch(`/api/preferences/theme?scope=${scope}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const body = (await response.json()) as { theme?: ApplicationTheme; csrfToken?: string; error?: string };
        if (!response.ok) throw new Error(body.error ?? "Theme preference unavailable.");
        const saved = normalizeApplicationTheme(body.theme);
        setThemeState(saved);
        localStorage.setItem(storageKey, saved);
        setCsrfToken(body.csrfToken ?? "");
        setStatus("ready");
        setMessage("Your saved application theme is active.");
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setCsrfToken("");
        setStatus("local");
        setMessage(
          error instanceof Error
            ? `${error.message} Using this browser's preference.`
            : "Using this browser's preference.",
        );
      });
    return () => controller.abort();
  }, [scope]);

  const setTheme = useCallback(
    async (next: ApplicationTheme) => {
      setThemeState(next);
      localStorage.setItem(storageKey, next);
      if (scope === "anonymous" || !csrfToken) {
        setStatus("local");
        setMessage("Theme saved in this browser.");
        return;
      }
      setStatus("saving");
      setMessage("Saving your application theme.");
      try {
        const response = await fetch("/api/preferences/theme", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken },
          body: JSON.stringify({ theme: next, scope }),
        });
        const body = (await response.json()) as { error?: string };
        if (!response.ok) throw new Error(body.error ?? "The theme could not be saved.");
        setStatus("saved");
        setMessage("Theme saved to your application profile.");
      } catch (error) {
        setStatus("error");
        setMessage(
          `${error instanceof Error ? error.message : "The theme could not be saved."} This browser still uses your selection.`,
        );
      }
    },
    [csrfToken, scope],
  );

  const value = useMemo(() => ({ theme, scope, status, message, setTheme }), [message, scope, setTheme, status, theme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useApplicationTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useApplicationTheme must be used within ThemeProvider.");
  return value;
}

function scopeForPath(pathname: string): ThemePreferenceScope {
  if (pathname.startsWith("/player")) return "player";
  if (pathname.startsWith("/captain") || pathname.startsWith("/studio") || pathname.startsWith("/quartermaster"))
    return "staff";
  return "anonymous";
}
