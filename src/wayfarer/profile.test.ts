import { describe, expect, it } from "vitest";
import {
  defaultPreferences,
  normalizeHandle,
  preferenceV1Schema,
  resolvePreferences,
  validateBiography,
} from "@/wayfarer/profile";

describe("Wayfarer Phase 2 profile contracts", () => {
  it("normalizes safe public handles and rejects reserved or unsafe forms", () => {
    expect(normalizeHandle("  Sea-Farer  ")).toBe("sea-farer");
    expect(() => normalizeHandle("admin")).toThrow("Choose a handle");
    expect(() => normalizeHandle("étoile")).toThrow("Choose a handle");
    expect(() => normalizeHandle("a--b")).not.toThrow();
  });
  it("does not accept oversized biographies", () => {
    expect(validateBiography("A safe public biography")).toBe("A safe public biography");
    expect(() => validateBiography("x".repeat(1001))).toThrow("1,000");
  });
  it("validates the typed V1 preference contract", () => {
    expect(preferenceV1Schema.parse(defaultPreferences)).toEqual(defaultPreferences);
    expect(() => preferenceV1Schema.parse({ ...defaultPreferences, version: 2 })).toThrow();
  });
  it("makes browser accessibility outrank Chronicle/account preferences without mutating defaults", () => {
    const resolved = resolvePreferences({
      account: defaultPreferences,
      chronicleOverride: { motion: "FULL", textScale: 1.5 },
      browser: { reducedMotion: true, forcedColors: true, textScale: 1.8 },
    });
    expect(resolved.experience.motion).toBe("REDUCED");
    expect(resolved.experience.contrast).toBe("HIGH");
    expect(resolved.experience.textScale).toBe(1.8);
    expect(defaultPreferences.experience.motion).toBe("SYSTEM");
  });
});
