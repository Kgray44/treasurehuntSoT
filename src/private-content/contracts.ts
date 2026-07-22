import type { Readable } from "node:stream";

/**
 * Phase 2 contracts are deliberately private-content scoped.  Chronicle,
 * Wayfarer, Harborlight, and Lanternwake retain their respective ownership.
 */
export const PRIVATE_STREAMING_PACKAGE_VERSION = 2 as const;
export const PRIVATE_CONTRACT_VERSION = 1 as const;

export const privateOperationStates = [
  "CREATED",
  "RECEIVING",
  "UPLOAD_PAUSED",
  "UPLOADED",
  "AUTHENTICATING",
  "PLAN_READY",
  "AWAITING_CONFIRMATION",
  "QUEUED",
  "NORMALIZING",
  "SCANNING_ASSETS",
  "QUARANTINED",
  "MATERIALIZING_CONTENT",
  "FINALIZING_ASSETS",
  "COMPLETED",
  "CANCEL_REQUESTED",
  "CANCELLED",
  "RETRYABLE_FAILURE",
  "FAILED",
] as const;
export type PrivateOperationState = (typeof privateOperationStates)[number];

export const privateScanStates = [
  "PENDING",
  "SCANNING",
  "CLEAN",
  "SUSPICIOUS",
  "MALICIOUS",
  "FAILED",
  "NOT_CONFIGURED",
] as const;
export type PrivateScanState = (typeof privateScanStates)[number];

export type PrivateObjectNamespace = "uploads" | "normalized" | "objects" | "quarantine" | "backups";
export type PrivateObjectDescriptor = {
  key: string;
  sha256: string;
  byteLength: number;
  mediaType?: string;
  metadata?: Record<string, string>;
};
export type PrivateWriteOptions = {
  expectedSha256?: string;
  contentLength?: number;
  metadata?: Record<string, string>;
  signal?: AbortSignal;
};

/** Production providers must keep every namespace private and immutable on promotion. */
export interface PrivateStorageProvider {
  readonly name: string;
  readonly supportsMultipart: boolean;
  readonly supportsSignedRead: boolean;
  put(
    namespace: PrivateObjectNamespace,
    key: string,
    body: Readable,
    options: PrivateWriteOptions,
  ): Promise<PrivateObjectDescriptor>;
  read(object: PrivateObjectDescriptor, range?: { start: number; end?: number }): Promise<Readable>;
  exists(object: Pick<PrivateObjectDescriptor, "key" | "sha256">): Promise<boolean>;
  promote(
    source: PrivateObjectDescriptor,
    destination: { namespace: PrivateObjectNamespace; key: string },
  ): Promise<PrivateObjectDescriptor>;
  moveToQuarantine(object: PrivateObjectDescriptor, reason: string): Promise<PrivateObjectDescriptor>;
  remove(object: PrivateObjectDescriptor): Promise<void>;
  beginMultipart(input: { key: string; expectedBytes?: number }): Promise<{ uploadId: string }>;
  uploadPart(input: {
    uploadId: string;
    partNumber: number;
    body: Readable;
    expectedSha256: string;
  }): Promise<{ etag: string; byteLength: number }>;
  completeMultipart(input: {
    uploadId: string;
    parts: Array<{ partNumber: number; etag: string }>;
  }): Promise<PrivateObjectDescriptor>;
  abortMultipart(uploadId: string): Promise<void>;
}

export type PrivateScanResult = {
  state: Exclude<PrivateScanState, "PENDING" | "SCANNING">;
  provider: string;
  providerVersion?: string;
  safeCode?: string;
};
export interface PrivateScannerProvider {
  readonly name: string;
  health(): Promise<{ configured: boolean; healthy: boolean }>;
  scan(input: { object: PrivateObjectDescriptor; mediaType: string; signal?: AbortSignal }): Promise<PrivateScanResult>;
}

export type WrappedPrivateDataKey = {
  provider: string;
  keyVersion: string;
  wrappedKey: string;
  algorithm: "AES-256-GCM";
};
export interface PrivateKeyProvider {
  readonly name: string;
  health(): Promise<{ configured: boolean; healthy: boolean; keyVersion?: string }>;
  wrap(dataKey: Buffer): Promise<WrappedPrivateDataKey>;
  unwrap(wrapped: WrappedPrivateDataKey): Promise<Buffer>;
  rewrap(wrapped: WrappedPrivateDataKey): Promise<WrappedPrivateDataKey>;
}

export const privateJobTypes = [
  "PRIVATE_UPLOAD_VERIFY",
  "PRIVATE_PACKAGE_INSPECT",
  "PRIVATE_PACKAGE_NORMALIZE",
  "PRIVATE_IMPORT_MATERIALIZE",
  "PRIVATE_ASSET_VALIDATE",
  "PRIVATE_ASSET_SCAN",
  "PRIVATE_ASSET_FINALIZE",
  "PRIVATE_EXPORT_BUILD",
  "PRIVATE_BACKUP_BUILD",
  "PRIVATE_BACKUP_VERIFY",
  "PRIVATE_RESTORE_VERIFY",
  "PRIVATE_KEY_REWRAP",
  "PRIVATE_INTEGRITY_RECONCILE",
  "PRIVATE_STAGING_CLEANUP",
  "PRIVATE_UPLOAD_CLEANUP",
  "PRIVATE_ORPHAN_CLEANUP",
  "PRIVATE_QUARANTINE_RETENTION",
] as const;
export type PrivateJobType = (typeof privateJobTypes)[number];
export type PrivateJobPayload = {
  schemaVersion: typeof PRIVATE_CONTRACT_VERSION;
  aggregateId: string;
  correlationId: string;
};

export const privateOperationTransitions: Readonly<Record<PrivateOperationState, readonly PrivateOperationState[]>> = {
  CREATED: ["RECEIVING", "CANCELLED", "FAILED"],
  RECEIVING: ["UPLOAD_PAUSED", "UPLOADED", "CANCEL_REQUESTED", "RETRYABLE_FAILURE", "FAILED"],
  UPLOAD_PAUSED: ["RECEIVING", "CANCEL_REQUESTED", "CANCELLED", "FAILED"],
  UPLOADED: ["AUTHENTICATING", "CANCEL_REQUESTED", "FAILED"],
  AUTHENTICATING: ["PLAN_READY", "RETRYABLE_FAILURE", "FAILED"],
  PLAN_READY: ["AWAITING_CONFIRMATION", "QUEUED", "CANCELLED", "FAILED"],
  AWAITING_CONFIRMATION: ["QUEUED", "CANCELLED", "FAILED"],
  QUEUED: ["NORMALIZING", "CANCEL_REQUESTED", "RETRYABLE_FAILURE", "FAILED"],
  NORMALIZING: ["SCANNING_ASSETS", "MATERIALIZING_CONTENT", "RETRYABLE_FAILURE", "FAILED"],
  SCANNING_ASSETS: ["MATERIALIZING_CONTENT", "QUARANTINED", "RETRYABLE_FAILURE", "FAILED"],
  QUARANTINED: ["RETRYABLE_FAILURE", "FAILED"],
  MATERIALIZING_CONTENT: ["FINALIZING_ASSETS", "RETRYABLE_FAILURE", "FAILED"],
  FINALIZING_ASSETS: ["COMPLETED", "RETRYABLE_FAILURE", "FAILED"],
  COMPLETED: [],
  CANCEL_REQUESTED: ["CANCELLED", "RETRYABLE_FAILURE", "FAILED"],
  CANCELLED: [],
  RETRYABLE_FAILURE: ["QUEUED", "CANCEL_REQUESTED", "FAILED"],
  FAILED: [],
};

export function canTransitionPrivateOperation(from: PrivateOperationState, to: PrivateOperationState) {
  return privateOperationTransitions[from].includes(to);
}
