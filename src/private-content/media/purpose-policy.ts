import {
  protectedMediaFailure,
  type ProtectedMediaAudience,
  type ProtectedMediaAuthority,
  type ProtectedMediaConsentScope,
  type ProtectedMediaKind,
  type ProtectedMediaPurpose,
} from "./contracts";

export type ProtectedMediaPurposePolicy = Readonly<{
  authority: ProtectedMediaAuthority;
  audiences: readonly ProtectedMediaAudience[];
  kinds: readonly ProtectedMediaKind[];
  derivativeRequired: boolean;
  consentScopes: readonly ProtectedMediaConsentScope[];
  publicMetadata: "NONE" | "SAFE";
  cacheControl: "private, no-store" | "public, max-age=60, must-revalidate";
}>;

const imageOnly = ["IMAGE"] as const;
const privateKinds = ["IMAGE", "AUDIO", "VIDEO", "DOCUMENT", "MODEL_3D"] as const;
const noConsent: readonly ProtectedMediaConsentScope[] = [];
const mediaConsent = ["PHOTO", "GENERAL_MEDIA"] as const;

export const protectedMediaPurposePolicies: Readonly<Record<ProtectedMediaPurpose, ProtectedMediaPurposePolicy>> = {
  MEMORY_PRIVATE: {
    authority: "WAYFARER",
    audiences: ["OWNER"],
    kinds: privateKinds,
    derivativeRequired: false,
    consentScopes: noConsent,
    publicMetadata: "NONE",
    cacheControl: "private, no-store",
  },
  KEEPSAKE_PRIVATE: {
    authority: "WAYFARER",
    audiences: ["OWNER"],
    kinds: privateKinds,
    derivativeRequired: false,
    consentScopes: mediaConsent,
    publicMetadata: "NONE",
    cacheControl: "private, no-store",
  },
  KEEPSAKE_CREW: {
    authority: "WAYFARER",
    audiences: ["CREW"],
    kinds: privateKinds,
    derivativeRequired: false,
    consentScopes: mediaConsent,
    publicMetadata: "NONE",
    cacheControl: "private, no-store",
  },
  ARTIFACT_CABINET_PRIVATE: {
    authority: "WAYFARER",
    audiences: ["OWNER"],
    kinds: privateKinds,
    derivativeRequired: false,
    consentScopes: noConsent,
    publicMetadata: "NONE",
    cacheControl: "private, no-store",
  },
  DISPLAY_CASE_UNLISTED: {
    authority: "WAYFARER",
    audiences: ["UNLISTED"],
    kinds: imageOnly,
    derivativeRequired: true,
    consentScopes: mediaConsent,
    publicMetadata: "SAFE",
    cacheControl: "private, no-store",
  },
  DISPLAY_CASE_PUBLIC: {
    authority: "WAYFARER",
    audiences: ["PUBLIC"],
    kinds: imageOnly,
    derivativeRequired: true,
    consentScopes: mediaConsent,
    publicMetadata: "SAFE",
    cacheControl: "public, max-age=60, must-revalidate",
  },
  VOYAGE_LOG_DRAFT: {
    authority: "HARBORLIGHT",
    audiences: ["OWNER"],
    kinds: privateKinds,
    derivativeRequired: false,
    consentScopes: noConsent,
    publicMetadata: "NONE",
    cacheControl: "private, no-store",
  },
  VOYAGE_LOG_CREW: {
    authority: "HARBORLIGHT",
    audiences: ["CREW"],
    kinds: privateKinds,
    derivativeRequired: false,
    consentScopes: mediaConsent,
    publicMetadata: "NONE",
    cacheControl: "private, no-store",
  },
  VOYAGE_LOG_UNLISTED: {
    authority: "HARBORLIGHT",
    audiences: ["UNLISTED"],
    kinds: imageOnly,
    derivativeRequired: true,
    consentScopes: mediaConsent,
    publicMetadata: "SAFE",
    cacheControl: "private, no-store",
  },
  VOYAGE_LOG_COMMUNITY: {
    authority: "HARBORLIGHT",
    audiences: ["PUBLIC"],
    kinds: imageOnly,
    derivativeRequired: true,
    consentScopes: mediaConsent,
    publicMetadata: "SAFE",
    cacheControl: "public, max-age=60, must-revalidate",
  },
  CREATOR_PREVIEW: {
    authority: "SEALED_HOLD",
    audiences: ["AUTHENTICATED"],
    kinds: privateKinds,
    derivativeRequired: false,
    consentScopes: noConsent,
    publicMetadata: "NONE",
    cacheControl: "private, no-store",
  },
};

export function requireProtectedMediaPurposePolicy(input: {
  purpose: ProtectedMediaPurpose;
  audience: ProtectedMediaAudience;
  kind: ProtectedMediaKind;
  authority: ProtectedMediaAuthority;
  derivativeId?: string;
}) {
  const policy = protectedMediaPurposePolicies[input.purpose];
  if (
    !policy ||
    policy.authority !== input.authority ||
    !policy.audiences.includes(input.audience) ||
    !policy.kinds.includes(input.kind) ||
    (policy.derivativeRequired && !input.derivativeId)
  )
    throw protectedMediaFailure("PROTECTED_MEDIA_PURPOSE_FORBIDDEN");
  if (!policy.derivativeRequired && ["UNLISTED", "PUBLIC"].includes(input.audience))
    throw protectedMediaFailure("PROTECTED_MEDIA_DERIVATIVE_REQUIRED");
  return policy;
}
