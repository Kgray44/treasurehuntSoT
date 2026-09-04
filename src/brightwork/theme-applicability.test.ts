import { describe, expect, it } from "vitest";
import { themeApplicability, themeApplicabilityForShell, themeApplicabilityNotice } from "./theme-applicability";

describe("Brightwork theme applicability", () => {
  it("keeps immersive routes truthful without disabling normal Light and Dark support", () => {
    expect(themeApplicabilityForShell("IMMERSIVE")).toBe(themeApplicability.themeLockedImmersive);
    expect(themeApplicabilityForShell("WORKSPACE_STANDARD")).toBe(themeApplicability.lightAndDark);
    expect(themeApplicabilityNotice(themeApplicability.themeLockedImmersive)).toMatch(/authored appearance/i);
    expect(themeApplicabilityNotice(themeApplicability.lightAndDark)).toBeNull();
  });
});
