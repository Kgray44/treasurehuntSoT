export const themeBootstrapScript = String.raw`(() => {
  const root = document.documentElement;
  const safe = { theme: "DARK", contrast: "SYSTEM", textScale: 1, motion: "SYSTEM" };
  try {
    const stored = JSON.parse(localStorage.getItem("voyagewright-theme-bootstrap-v1") || "null");
    if (stored && ["SYSTEM", "LIGHT", "DARK", "HIGH_CONTRAST"].includes(stored.theme)) safe.theme = stored.theme;
    if (stored && ["SYSTEM", "STANDARD", "HIGH"].includes(stored.contrast)) safe.contrast = stored.contrast;
    if (stored && ["SYSTEM", "FULL", "GENTLE", "REDUCED"].includes(stored.motion)) safe.motion = stored.motion;
    if (stored && Number.isFinite(stored.textScale)) safe.textScale = Math.min(2, Math.max(0.8, stored.textScale));
  } catch {}
  const dark = matchMedia("(prefers-color-scheme: dark)").matches;
  const high = matchMedia("(prefers-contrast: more)").matches || matchMedia("(forced-colors: active)").matches;
  root.dataset.voyageTheme = safe.theme === "HIGH_CONTRAST" ? "high-contrast" : safe.theme === "SYSTEM" ? (dark ? "dark" : "light") : safe.theme.toLowerCase();
  root.dataset.voyageContrast = safe.contrast === "SYSTEM" ? (high ? "high" : "standard") : safe.contrast.toLowerCase();
  root.dataset.motionPreference = safe.motion.toLowerCase();
  root.style.setProperty("--account-text-scale", String(safe.textScale));
})();`;
