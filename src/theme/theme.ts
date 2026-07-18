import { z } from "zod";

export const applicationThemes = ["verdant-depths", "moonlit-blue"] as const;
export type ApplicationTheme = (typeof applicationThemes)[number];
export type ThemePreferenceScope = "player" | "staff" | "anonymous";

export const themePreferenceInputSchema = z
  .object({
    theme: z.enum(applicationThemes),
    scope: z.enum(["player", "staff"]),
  })
  .strict();

export type StoredApplicationPreferences = {
  theme?: ApplicationTheme;
  [key: string]: unknown;
};

export function parseApplicationPreferences(value: string | null | undefined): StoredApplicationPreferences {
  try {
    const parsed = JSON.parse(value ?? "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const preferences = parsed as StoredApplicationPreferences;
    return applicationThemes.includes(preferences.theme as ApplicationTheme)
      ? preferences
      : { ...preferences, theme: undefined };
  } catch {
    return {};
  }
}

export function normalizeApplicationTheme(value: unknown): ApplicationTheme {
  return applicationThemes.includes(value as ApplicationTheme) ? (value as ApplicationTheme) : "verdant-depths";
}
