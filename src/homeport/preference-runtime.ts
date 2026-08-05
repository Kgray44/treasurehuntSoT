export type RuntimePreferences = {
  experience: {
    motion: "FULL" | "GENTLE" | "REDUCED" | "SYSTEM";
    textScale: number;
    theme: "SYSTEM" | "LIGHT" | "DARK" | "HIGH_CONTRAST";
    contrast: "SYSTEM" | "STANDARD" | "HIGH";
  };
};

export const preferenceRuntimeEvent = "voyagewright-preferences-changed";
export const preferenceRuntimeChannel = "voyagewright-preferences";

export const defaultRuntimePreferences: RuntimePreferences = {
  experience: { motion: "SYSTEM", textScale: 1, theme: "SYSTEM", contrast: "SYSTEM" },
};

function matches(query: string) {
  return typeof window !== "undefined" && window.matchMedia(query).matches;
}

export function accountPreferenceCacheKey(accountId: string) {
  return `voyagewright-preferences:${accountId}`;
}

export function applyRuntimePreferences(preferences: RuntimePreferences) {
  const root = document.documentElement;
  const systemDark = matches("(prefers-color-scheme: dark)");
  const systemHighContrast = matches("(prefers-contrast: more)") || matches("(forced-colors: active)");
  const theme =
    preferences.experience.theme === "HIGH_CONTRAST"
      ? "high-contrast"
      : preferences.experience.theme === "SYSTEM"
        ? systemDark
          ? "dark"
          : "light"
        : preferences.experience.theme.toLowerCase();
  const contrast =
    preferences.experience.contrast === "SYSTEM"
      ? systemHighContrast
        ? "high"
        : "standard"
      : preferences.experience.contrast.toLowerCase();
  const textScale = Math.min(2, Math.max(0.8, Number(preferences.experience.textScale) || 1));
  const productMotion =
    preferences.experience.motion === "REDUCED"
      ? "reduced"
      : preferences.experience.motion === "GENTLE"
        ? "gentle"
        : "full";

  root.dataset.voyageTheme = theme;
  root.dataset.voyageContrast = contrast;
  root.dataset.motionPreference = preferences.experience.motion.toLowerCase();
  root.style.setProperty("--account-text-scale", String(textScale));
  try {
    localStorage.setItem("forever-motion", productMotion);
  } catch {
    // Runtime preferences still apply when storage is unavailable or blocked.
  }
  window.dispatchEvent(new CustomEvent(preferenceRuntimeEvent, { detail: { productMotion } }));
}

export function publishRuntimePreferences(accountId: string, preferences: RuntimePreferences) {
  const payload = JSON.stringify(preferences);
  try {
    localStorage.setItem(accountPreferenceCacheKey(accountId), payload);
  } catch {
    // The server remains authoritative; this cache only improves reload timing.
  }
  applyRuntimePreferences(preferences);
  if (typeof BroadcastChannel !== "undefined") {
    const channel = new BroadcastChannel(preferenceRuntimeChannel);
    channel.postMessage({ type: "preferences-updated", accountId, preferences });
    channel.close();
  }
}
