import { describe, expect, it } from "vitest";
import { normalizeApplicationTheme, parseApplicationPreferences, themePreferenceInputSchema } from "@/theme/theme";

describe("application theme preferences", () => {
  it("defaults unknown values to Verdant Depths", () => {
    expect(normalizeApplicationTheme("sepia")).toBe("verdant-depths");
    expect(normalizeApplicationTheme(null)).toBe("verdant-depths");
  });

  it("preserves unrelated persisted preferences while rejecting an invalid theme", () => {
    expect(parseApplicationPreferences('{"theme":"moonlit-blue","density":"cozy"}')).toEqual({
      theme: "moonlit-blue",
      density: "cozy",
    });
    expect(parseApplicationPreferences('{"theme":"legacy","density":"cozy"}')).toEqual({
      theme: undefined,
      density: "cozy",
    });
    expect(parseApplicationPreferences("not-json")).toEqual({});
  });

  it("requires an authenticated persistence scope", () => {
    expect(themePreferenceInputSchema.safeParse({ theme: "verdant-depths", scope: "player" }).success).toBe(true);
    expect(themePreferenceInputSchema.safeParse({ theme: "moonlit-blue", scope: "anonymous" }).success).toBe(false);
  });
});
