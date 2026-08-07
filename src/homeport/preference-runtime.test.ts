import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  accountPreferenceCacheKey,
  applyRuntimePreferences,
  preferenceRuntimeEvent,
  publishRuntimePreferences,
  type RuntimePreferences,
} from "./preference-runtime";

const preferences = (patch: Partial<RuntimePreferences["experience"]> = {}): RuntimePreferences => ({
  experience: {
    motion: "SYSTEM",
    textScale: 1,
    theme: "SYSTEM",
    contrast: "SYSTEM",
    ...patch,
  },
});

describe("Project Homeport observable preference effects", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.stubGlobal(
      "matchMedia",
      vi.fn(
        (query: string) =>
          ({
            matches: query.includes("color-scheme: dark"),
            media: query,
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
          }) as MediaQueryList,
      ),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.documentElement.removeAttribute("data-voyage-theme");
    document.documentElement.removeAttribute("data-voyage-contrast");
    document.documentElement.removeAttribute("data-motion-preference");
    document.documentElement.style.removeProperty("--account-text-scale");
  });

  it("homeport.owner-correction.round1.preference-effects changes theme, contrast, text scale, and motion consumers", () => {
    const observed = vi.fn();
    window.addEventListener(preferenceRuntimeEvent, observed);
    applyRuntimePreferences(preferences({ theme: "LIGHT", contrast: "HIGH", textScale: 1.35, motion: "REDUCED" }));
    expect(document.documentElement.dataset.voyageTheme).toBe("light");
    expect(document.documentElement.dataset.voyageContrast).toBe("high");
    expect(document.documentElement.dataset.motionPreference).toBe("reduced");
    expect(document.documentElement.style.getPropertyValue("--account-text-scale")).toBe("1.35");
    expect(window.localStorage.getItem("forever-motion")).toBe("reduced");
    expect(observed).toHaveBeenCalledOnce();
    window.removeEventListener(preferenceRuntimeEvent, observed);
  });

  it("resolves SYSTEM theme against the browser and bounds unsafe text-scale values", () => {
    applyRuntimePreferences(preferences({ textScale: 20 }));
    expect(document.documentElement.dataset.voyageTheme).toBe("dark");
    expect(document.documentElement.style.getPropertyValue("--account-text-scale")).toBe("2");
  });

  it("homeport.owner-correction.round1.preference-persistence stores only the account-scoped validated payload", () => {
    const value = preferences({ theme: "DARK", motion: "GENTLE" });
    publishRuntimePreferences("account-1", value);
    expect(JSON.parse(window.localStorage.getItem(accountPreferenceCacheKey("account-1")) ?? "null")).toEqual(value);
    expect(document.documentElement.dataset.voyageTheme).toBe("dark");
    expect(window.localStorage.getItem("forever-motion")).toBe("gentle");
  });

  it("homeport.owner-correction.round1.preference-failure still applies preferences when browser storage is blocked", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Storage blocked", "SecurityError");
    });
    expect(() =>
      publishRuntimePreferences("account-1", preferences({ theme: "HIGH_CONTRAST", textScale: 1.2 })),
    ).not.toThrow();
    expect(document.documentElement.dataset.voyageTheme).toBe("high-contrast");
    expect(document.documentElement.style.getPropertyValue("--account-text-scale")).toBe("1.2");
  });
});
