export const harborlightVoyageLogPublicationPurpose = "HARBORLIGHT_VOYAGE_LOG_PUBLICATION" as const;
export const voyageLogConsentStates = [
  "NOT_REQUIRED",
  "PENDING",
  "APPROVED",
  "DECLINED",
  "REVOKED",
  "EXPIRED",
] as const;
export const voyageLogConsentScopes = [
  "DISPLAY_NAME",
  "ALIAS",
  "AVATAR",
  "QUOTE",
  "PHOTO",
  "AUDIO",
  "OTHER_MEDIA",
] as const;
export type VoyageLogConsentState = (typeof voyageLogConsentStates)[number];
export type VoyageLogConsentScope = (typeof voyageLogConsentScopes)[number];
