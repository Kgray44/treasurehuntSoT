import type { ShellMode } from "@/navigation/types";

export const themeApplicability = {
  lightAndDark: "LIGHT_AND_DARK",
  themeLockedImmersive: "THEME_LOCKED_IMMERSIVE",
} as const;

export type ThemeApplicability = (typeof themeApplicability)[keyof typeof themeApplicability];

export function themeApplicabilityForShell(shellMode: ShellMode): ThemeApplicability {
  return shellMode === "IMMERSIVE" ? themeApplicability.themeLockedImmersive : themeApplicability.lightAndDark;
}

export function themeApplicabilityNotice(applicability: ThemeApplicability) {
  return applicability === themeApplicability.themeLockedImmersive
    ? "This immersive experience uses its authored appearance. Your appearance preference applies on standard product surfaces."
    : null;
}
