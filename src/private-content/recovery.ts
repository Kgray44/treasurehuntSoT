import { sha256 } from "./core";
import type { PrivateObjectDescriptor, PrivateScanState } from "./contracts";

export type PrivateBackupManifest = {
  format: "forever-treasure-private-backup";
  version: 1;
  backupId: string;
  createdAt: string;
  canonicalDigest: string;
  objects: Array<Pick<PrivateObjectDescriptor, "key" | "sha256" | "byteLength">>;
  wrappedKeyMetadata: Array<{ provider: string; keyVersion: string; wrappedKeyDigest: string }>;
  manifestDigest: string;
};

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")} ]`.replace(", ]", "]");
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stable(object[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function canonicalBackupBody(manifest: Omit<PrivateBackupManifest, "manifestDigest">) {
  return stable({
    ...manifest,
    objects: [...manifest.objects].sort((a, b) => a.key.localeCompare(b.key)),
    wrappedKeyMetadata: [...manifest.wrappedKeyMetadata].sort((a, b) =>
      `${a.provider}:${a.keyVersion}`.localeCompare(`${b.provider}:${b.keyVersion}`),
    ),
  });
}

export function createPrivateBackupManifest(
  input: Omit<PrivateBackupManifest, "format" | "version" | "manifestDigest">,
): PrivateBackupManifest {
  const body = { ...input, format: "forever-treasure-private-backup" as const, version: 1 as const };
  return { ...body, manifestDigest: sha256(canonicalBackupBody(body)) };
}

/** Verifies the manifest before an isolated restore opens any referenced object. */
export function verifyPrivateBackupManifest(manifest: PrivateBackupManifest): boolean {
  if (
    manifest.format !== "forever-treasure-private-backup" ||
    manifest.version !== 1 ||
    !/^[a-f0-9]{64}$/.test(manifest.manifestDigest)
  )
    return false;
  const { manifestDigest, ...body } = manifest;
  return sha256(canonicalBackupBody(body)) === manifestDigest;
}

export type PrivateIntegrityObject = {
  object: Pick<PrivateObjectDescriptor, "key" | "sha256" | "byteLength">;
  exists: boolean;
  digestValid: boolean;
  scanState: PrivateScanState;
  keyVersion: string;
  knownKeyVersions: readonly string[];
  liveReferences: number;
  backupReferences: number;
  createdAt: Date;
  namespace: "objects" | "uploads" | "normalized" | "quarantine" | "backups";
};
export type PrivateIntegrityIssue =
  | "MISSING_OBJECT"
  | "CORRUPT_OBJECT"
  | "UNSAFE_AVAILABILITY"
  | "INVALID_SCAN_STATE"
  | "UNKNOWN_KEY_VERSION"
  | "ORPHAN";
export type PrivateIntegrityAction = {
  action: "QUARANTINE" | "DELETE_AFTER_GRACE" | "REVIEW";
  key: string;
  reason: PrivateIntegrityIssue;
};

/**
 * Computes a dry-run repair plan. Ambiguous objects are explicitly REVIEW-only;
 * deletion is allowed only for proven unreferenced stale objects outside backups.
 */
export function reconcilePrivateIntegrity(input: {
  objects: readonly PrivateIntegrityObject[];
  now?: Date;
  graceMs: number;
  dryRun?: boolean;
}) {
  const now = input.now ?? new Date();
  const issues: Array<{ key: string; issue: PrivateIntegrityIssue }> = [];
  const actions: PrivateIntegrityAction[] = [];
  for (const candidate of input.objects) {
    const add = (issue: PrivateIntegrityIssue, action: PrivateIntegrityAction["action"]) => {
      issues.push({ key: candidate.object.key, issue });
      actions.push({ key: candidate.object.key, reason: issue, action });
    };
    if (!candidate.exists) add("MISSING_OBJECT", "REVIEW");
    else if (!candidate.digestValid) add("CORRUPT_OBJECT", "QUARANTINE");
    if (candidate.scanState !== "CLEAN" && candidate.namespace === "objects") add("UNSAFE_AVAILABILITY", "QUARANTINE");
    if (["PENDING", "SCANNING"].includes(candidate.scanState)) add("INVALID_SCAN_STATE", "REVIEW");
    if (!candidate.knownKeyVersions.includes(candidate.keyVersion)) add("UNKNOWN_KEY_VERSION", "REVIEW");
    const orphan = candidate.liveReferences === 0 && candidate.backupReferences === 0;
    if (orphan) {
      const oldEnough = now.getTime() - candidate.createdAt.getTime() >= input.graceMs;
      add("ORPHAN", oldEnough && candidate.exists && candidate.digestValid ? "DELETE_AFTER_GRACE" : "REVIEW");
    }
  }
  return { dryRun: input.dryRun !== false, issues, actions };
}

export function planStalePrivateCleanup(input: {
  key: string;
  updatedAt: Date;
  now?: Date;
  expirationMs: number;
  kind: "upload" | "staging" | "multipart";
}) {
  const now = input.now ?? new Date();
  const expired = now.getTime() - input.updatedAt.getTime() >= input.expirationMs;
  return { key: input.key, kind: input.kind, expired, action: expired ? "DELETE_AFTER_GRACE" : "REVIEW" } as const;
}
