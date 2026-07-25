import { CommunityError } from "./domain";
import type { CommunityBinaryScanReceipt } from "./scanner";
import type { SealedHoldPublicDerivativePort } from "./voyage-log-media";

/** The public seam exposes only opaque identifiers, never protected keys or URLs. */
export type HarborlightPublicMediaCandidate = Readonly<{
  sourceOpaqueId: string;
  subjectParticipantId?: string;
  detectedMediaType: "image/png" | "image/jpeg" | "image/webp";
  eligibility: "READY" | "QUARANTINED" | "UNAVAILABLE";
}>;
export type HarborlightPublicMediaSource = Readonly<{
  sourceOpaqueId: string;
  subjectParticipantId?: string;
  declaredMediaType: "image/png" | "image/jpeg" | "image/webp";
  bytes: Uint8Array;
  scannerReceipt: Pick<CommunityBinaryScanReceipt, "result" | "sha256">;
}>;
export interface SealedHoldPublicMediaPort extends SealedHoldPublicDerivativePort {
  listOwnerAuthorizedCandidates(input: {
    ownerAccountId: string;
    voyageLogId: string;
  }): Promise<readonly HarborlightPublicMediaCandidate[]>;
  readOwnerAuthorizedSource(input: {
    ownerAccountId: string;
    voyageLogId: string;
    sourceOpaqueId: string;
  }): Promise<HarborlightPublicMediaSource>;
}
class NotConnectedSealedHoldPublicMediaPort implements SealedHoldPublicMediaPort {
  private unavailable(): never {
    throw new CommunityError(
      "COMMUNITY_PUBLIC_MEDIA_PROVIDER_NOT_CONFIGURED",
      "Public-media selection is unavailable until the Sealed Hold provider is connected.",
    );
  }
  async listOwnerAuthorizedCandidates(): Promise<readonly HarborlightPublicMediaCandidate[]> {
    return this.unavailable();
  }
  async readOwnerAuthorizedSource(): Promise<HarborlightPublicMediaSource> {
    return this.unavailable();
  }
  async writePublicDerivative(): Promise<{ opaqueDerivativeReference: string }> {
    return this.unavailable();
  }
}
/** No filesystem fallback: Sealed Hold remains authoritative for protected media. */
export function getSealedHoldPublicMediaPort(): SealedHoldPublicMediaPort {
  return new NotConnectedSealedHoldPublicMediaPort();
}
