import { createHash } from "node:crypto";

export const PROTECTED_MEDIA_CONTRACT_VERSION = 1 as const;

export const protectedMediaKinds = ["IMAGE", "AUDIO", "VIDEO", "DOCUMENT", "MODEL_3D", "OTHER"] as const;
export type ProtectedMediaKind = (typeof protectedMediaKinds)[number];
export const protectedMediaPurposes = [
  "MEMORY_PRIVATE",
  "KEEPSAKE_PRIVATE",
  "KEEPSAKE_CREW",
  "ARTIFACT_CABINET_PRIVATE",
  "DISPLAY_CASE_UNLISTED",
  "DISPLAY_CASE_PUBLIC",
  "VOYAGE_LOG_DRAFT",
  "VOYAGE_LOG_CREW",
  "VOYAGE_LOG_UNLISTED",
  "VOYAGE_LOG_COMMUNITY",
  "CREATOR_PREVIEW",
] as const;
export type ProtectedMediaPurpose = (typeof protectedMediaPurposes)[number];
export const protectedMediaAudiences = ["OWNER", "CREW", "AUTHENTICATED", "UNLISTED", "PUBLIC"] as const;
export type ProtectedMediaAudience = (typeof protectedMediaAudiences)[number];
export const protectedMediaDerivativeStates = [
  "REQUESTED",
  "QUEUED",
  "PROCESSING",
  "VERIFYING",
  "BLOCKED_SOURCE_SCAN",
  "BLOCKED_DERIVATIVE_SCAN",
  "BLOCKED_CONSENT",
  "READY",
  "FAILED",
  "WITHDRAWN",
  "SUPERSEDED",
] as const;
export type ProtectedMediaDerivativeState = (typeof protectedMediaDerivativeStates)[number];
export const protectedMediaGrantStates = ["ACTIVE", "REVOKED", "EXPIRED", "INVALIDATED"] as const;
export type ProtectedMediaGrantState = (typeof protectedMediaGrantStates)[number];
export const protectedMediaConsentAuthorities = ["WAYFARER", "HARBORLIGHT", "SEALED_HOLD_TEST"] as const;
export type ProtectedMediaConsentAuthority = (typeof protectedMediaConsentAuthorities)[number];
export const protectedMediaConsentStates = ["PENDING", "GRANTED", "DENIED", "REVOKED", "EXPIRED", "STALE"] as const;
export type ProtectedMediaConsentState = (typeof protectedMediaConsentStates)[number];
export const protectedMediaConsentScopes = [
  "DISPLAY_NAME",
  "AVATAR",
  "QUOTE",
  "PHOTO",
  "AUDIO",
  "VIDEO",
  "GENERAL_MEDIA",
] as const;
export type ProtectedMediaConsentScope = (typeof protectedMediaConsentScopes)[number];
export const protectedMediaSubjectKinds = [
  "WAYFARER_MEMORY",
  "WAYFARER_KEEPSAKE",
  "WAYFARER_ARTIFACT_RECORD",
  "WAYFARER_DISPLAY_CASE",
  "HARBORLIGHT_VOYAGE_LOG",
  "HARBORLIGHT_VOYAGE_LOG_DRAFT",
  "CREATOR_PREVIEW",
] as const;
export type ProtectedMediaSubjectKind = (typeof protectedMediaSubjectKinds)[number];
export type ProtectedMediaAuthority = "WAYFARER" | "HARBORLIGHT" | "SEALED_HOLD";

export const protectedMediaWithdrawalReasons = [
  "OWNER_WITHDRAWN",
  "PARTICIPANT_CONSENT_REVOKED",
  "SOURCE_QUARANTINED",
  "DERIVATIVE_QUARANTINED",
  "SOURCE_CORRUPT",
  "DERIVATIVE_CORRUPT",
  "PRIVACY_RECLASSIFIED",
  "SUBJECT_REMOVED",
  "PUBLICATION_REVISED",
  "MODERATION_QUARANTINED",
  "GRANT_EXPIRED",
  "DERIVATIVE_SUPERSEDED",
  "ADMINISTRATIVE_SECURITY_ACTION",
] as const;
export type ProtectedMediaWithdrawalReason = (typeof protectedMediaWithdrawalReasons)[number];

export type ProtectedMediaConsentAssertion = Readonly<{
  id: string;
  authority: ProtectedMediaConsentAuthority;
  authorityRecordOpaqueId: string;
  authorityRevision: string;
  subjectOpaqueId: string;
  subjectParticipantOpaqueId?: string;
  consumingAggregateKind: ProtectedMediaSubjectKind;
  consumingAggregateOpaqueId: string;
  purpose: ProtectedMediaPurpose;
  scopes: readonly ProtectedMediaConsentScope[];
  state: ProtectedMediaConsentState;
  sourceProtectedMediaId: string;
  sourceChecksum: string;
  requestedTransformationPolicy: string;
  derivativeId?: string;
  derivativeChecksum?: string;
  validFrom: Date;
  validUntil?: Date;
  revokedAt?: Date;
  sourceWatermark: string;
  assertionDigest: string;
}>;

export type ProtectedMediaAssociation = Readonly<{
  id: string;
  protectedMediaId: string;
  authority: ProtectedMediaAuthority;
  subjectKind: ProtectedMediaSubjectKind;
  subjectOpaqueId: string;
  purpose: ProtectedMediaPurpose;
  role: string;
  ordinal: number;
  ownerAccountId: string;
  sourceRevision: string;
  removedAt?: Date;
}>;

export type ProtectedMediaDerivative = Readonly<{
  id: string;
  sourceProtectedMediaId: string;
  sourcePrivateAssetObjectId: string;
  sourceChecksum: string;
  transformationPolicy: string;
  transformationPolicyVersion: number;
  purpose: ProtectedMediaPurpose;
  mediaKind: ProtectedMediaKind;
  outputMediaType: string;
  outputByteLength: number;
  outputChecksum: string;
  width?: number;
  height?: number;
  storageNamespace: "derivatives";
  storageOpaqueReference: string;
  scanState: string;
  state: ProtectedMediaDerivativeState;
  operationId: string;
  withdrawnAt?: Date;
}>;

export type ProtectedMediaGrant = Readonly<{
  id: string;
  protectedMediaId: string;
  derivativeId?: string;
  associationId: string;
  purpose: ProtectedMediaPurpose;
  audience: ProtectedMediaAudience;
  consumingAuthority: ProtectedMediaAuthority;
  consumingAggregateKind: ProtectedMediaSubjectKind;
  consumingAggregateOpaqueId: string;
  authorizationRevision: string;
  consentAssertionId?: string;
  state: ProtectedMediaGrantState;
  activeFrom: Date;
  expiresAt?: Date;
  revokedAt?: Date;
}>;

export class ProtectedMediaError extends Error {
  constructor(
    readonly code: string,
    message = "The protected-media request could not be completed.",
  ) {
    super(message);
    this.name = "ProtectedMediaError";
  }
}

export function protectedMediaFailure(code: string, message?: string): ProtectedMediaError {
  return new ProtectedMediaError(code, message);
}

export function isProtectedMediaPurpose(value: string): value is ProtectedMediaPurpose {
  return (protectedMediaPurposes as readonly string[]).includes(value);
}

/** Canonical JSON is deliberately small and deterministic for consent receipts. */
export function stableProtectedMediaJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableProtectedMediaJson).join(",")}]`;
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableProtectedMediaJson(object[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function protectedMediaDigest(value: unknown): string {
  return createHash("sha256").update(stableProtectedMediaJson(value)).digest("hex");
}
