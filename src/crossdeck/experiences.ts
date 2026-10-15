import type { SurfaceRole } from "./contracts";

export const roleNames: Record<SurfaceRole, string> = {
  PRIMARY_STORY: "Chronicle",
  CHRONICLE_LENS: "Chronicle Lens",
  CHART: "Voyage Chart",
  JOURNAL: "Journal companion",
  ARTIFACT_VIEWER: "Artifact viewer",
  SHARED_CREW_DISPLAY: "Crew display",
  AMBIENT: "Atmosphere",
  CAPTAIN_AUXILIARY: "Captain companion",
  CREATOR_PREVIEW: "Creator preview",
  ACCESSIBILITY_COMPANION: "Accessibility companion",
};
export const companionHref = (voyage: string) => `/devices/companion?voyage=${encodeURIComponent(voyage)}`;
export type ExperienceAvailability = { lens: boolean; chart: boolean; artifacts: boolean };
export type ExperienceProfile = {
  role: SurfaceRole;
  title: string;
  description: string;
  available: boolean;
  reason?: string;
  advanced?: boolean;
};
/** Human purposes project the retained domain taxonomy; a label never grants a consumer or hardware capability. */
export function experienceProfiles(available: ExperienceAvailability): ExperienceProfile[] {
  return [
    {
      role: "CHRONICLE_LENS",
      title: "Chronicle Lens",
      description: "Explore this passage’s spatial clues. Guided View works without a camera.",
      available: available.lens,
      reason: available.lens ? undefined : "No spatial moment has been released in this Chronicle yet.",
    },
    {
      role: "CHART",
      title: "Voyage Chart",
      description: "Keep your course, places and current objective close at hand.",
      available: available.chart,
      reason: available.chart ? undefined : "This Chronicle has no released Living Chart.",
    },
    {
      role: "JOURNAL",
      title: "Journal companion",
      description: "Read released passages and receive views alongside your main screen.",
      available: true,
    },
    {
      role: "PRIMARY_STORY",
      title: "Continue the Chronicle",
      description: "Open the full Chronicle on this device, with the same Voyage progress.",
      available: true,
    },
    {
      role: "ARTIFACT_VIEWER",
      title: "Artifact viewer",
      description: "Give a released artifact its own space to inspect and read.",
      available: available.artifacts,
      reason: available.artifacts ? undefined : "An artifact will be available after it is released in your Voyage.",
      advanced: true,
    },
    {
      role: "SHARED_CREW_DISPLAY",
      title: "Crew display",
      description: "Show only views deliberately shared with the crew. Private notes stay private.",
      available: true,
      advanced: true,
    },
    {
      role: "AMBIENT",
      title: "Atmosphere",
      description: "A dedicated ambient presentation is not available yet.",
      available: false,
      reason: "Use the Chronicle’s existing presentation controls.",
      advanced: true,
    },
    {
      role: "CAPTAIN_AUXILIARY",
      title: "Captain companion",
      description: "A dedicated Captain device experience is not available yet.",
      available: false,
      reason: "Captain tools remain in the authorized Captain workspace.",
      advanced: true,
    },
    {
      role: "ACCESSIBILITY_COMPANION",
      title: "Accessibility companion",
      description: "A separate assistive device mode is not available yet.",
      available: false,
      reason: "The Journal companion includes accessible reading controls.",
      advanced: true,
    },
    {
      role: "CREATOR_PREVIEW",
      title: "Creator preview",
      description: "Authoring devices require a future explicit preview-session policy.",
      available: false,
      reason: "Use the existing Creator preview in Studio.",
      advanced: true,
    },
  ];
}
