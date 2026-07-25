import type { ProtectedMediaConsentAssertion, ProtectedMediaDerivativeState, ProtectedMediaPurpose } from "./contracts";

export interface SealedHoldPublicDerivativePort {
  requestPublicDerivative(
    input: Readonly<{
      ownerAccountId: string;
      sourceOpaqueId: string;
      voyageLogId: string;
      subjectParticipantId?: string;
      visibility: "CREW" | "UNLISTED" | "COMMUNITY";
      consentAssertion: ProtectedMediaConsentAssertion;
      transformationPolicy: "sealed-hold-public-image-v1";
      idempotencyKey: string;
    }>,
  ): Promise<{
    operationId: string;
    derivativeOpaqueId: string;
    state: ProtectedMediaDerivativeState;
    sourceChecksum: string;
    derivativeChecksum?: string;
  }>;
  resolvePublicDerivative(
    input: Readonly<{
      derivativeOpaqueId: string;
      voyageLogId: string;
      purpose: ProtectedMediaPurpose;
      publicationRevision: string;
    }>,
  ): Promise<{ derivativeOpaqueId: string; checksum: string }>;
  withdrawPublicDerivative(
    input: Readonly<{
      derivativeOpaqueId: string;
      voyageLogId: string;
      reasonCode: string;
      publicationRevision: string;
    }>,
  ): Promise<{ derivativeOpaqueId: string; withdrawn: boolean }>;
}

export function harborlightPurposeForVisibility(
  visibility: "CREW" | "UNLISTED" | "COMMUNITY",
): "VOYAGE_LOG_CREW" | "VOYAGE_LOG_UNLISTED" | "VOYAGE_LOG_COMMUNITY" {
  return visibility === "CREW"
    ? "VOYAGE_LOG_CREW"
    : visibility === "UNLISTED"
      ? "VOYAGE_LOG_UNLISTED"
      : "VOYAGE_LOG_COMMUNITY";
}
