/**
 * Cross-project consumer contracts.  These are intentionally narrow so the
 * Phase 2 implementations can be replaced during four-project convergence.
 */
export type CreatorIdentityProjection = {
  accountId: string;
  displayName: string;
  publicHandle?: string;
  suspended: boolean;
};
export interface CommunityCreatorIdentityPort {
  getCreatorIdentity(accountId: string): Promise<CreatorIdentityProjection>;
  getPublicCreatorIdentity(
    accountId: string,
  ): Promise<Pick<CreatorIdentityProjection, "accountId" | "displayName" | "publicHandle">>;
  assertCreatorCapability(accountId: string): Promise<void>;
}
export type ChronicleSourceProjection = {
  id: string;
  taleId: string;
  checksum: string;
  content: Record<string, unknown>;
};
export interface CommunityChronicleSourcePort {
  getPublishedSource(versionId: string): Promise<ChronicleSourceProjection | null>;
  createStudioDraft(input: {
    accountId: string;
    sourceVersionId: string;
    logicalIds: Record<string, string>;
  }): Promise<{ draftId: string }>;
}
export interface CommunityPackageSafetyPort {
  inspectFile(input: {
    path: string;
    bytes: Uint8Array;
    mediaType: string;
  }): Promise<{ clean: boolean; reason?: string }>;
  assertSafeRelativePath(path: string): void;
}
export interface CommunityAssetStoragePort {
  stageObject(input: {
    packageId: string;
    path: string;
    bytes: Uint8Array;
  }): Promise<{ key: string; checksum: string }>;
  finalizeImmutableObject(input: { stagedKey: string; releaseId: string }): Promise<{ key: string; checksum: string }>;
  quarantineObject(input: { key: string; reason: string }): Promise<void>;
  verifyObject(input: { key: string; checksum: string }): Promise<boolean>;
}
export interface CommunityScannerPort {
  requestScan(input: { packageId: string; checksum: string }): Promise<{ scanId: string }>;
  getScanResult(scanId: string): Promise<{ status: "CLEAN" | "SUSPICIOUS" | "MALICIOUS" | "PENDING"; reason?: string }>;
}
export interface CommunityAnimationPort {
  presentCommittedReceipt(input: { receiptId: string; kind: "PUBLICATION" | "INSTALL" }): Promise<void>;
}
