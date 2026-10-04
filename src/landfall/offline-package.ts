import { z } from "zod";
import { landfallId } from "@/landfall/schema";
import {
  isLandfallEd25519PublicKey,
  verifyLandfallEd25519,
  type LandfallEd25519PublicKey,
} from "./ed25519-public-verifier";

export const offlinePackageScopeSchema = z.strictObject({
  playerProfileId: landfallId,
  sessionId: landfallId,
  taleId: landfallId,
  publishedVersionId: landfallId,
  worldspaceId: landfallId,
});
export type OfflinePackageScope = z.infer<typeof offlinePackageScopeSchema>;
export const offlinePackageResourceSchema = z.strictObject({
  id: landfallId,
  kind: z.enum([
    "CHART",
    "ROUTE",
    "VECTOR_TILE",
    "RASTER_TILE",
    "STYLE",
    "OVERLAY",
    "FLOOR_PLAN",
    "ASSET",
    "ELEVATION",
  ]),
  bytes: z
    .number()
    .int()
    .positive()
    .max(1024 * 1024),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  mime: z.enum(["application/json", "application/vnd.mapbox-vector-tile", "image/png", "image/jpeg", "image/webp"]),
  attribution: z.string().max(1000),
  license: z.string().min(1).max(240),
  offlineRights: z.literal("ALLOWED"),
});
export type OfflinePackageResource = z.infer<typeof offlinePackageResourceSchema>;
export const offlinePackageManifestSchema = z
  .strictObject({
    version: z.literal(1),
    id: landfallId,
    keyId: landfallId,
    scope: offlinePackageScopeSchema,
    worldspaceKind: z.enum(["PHYSICAL", "VIRTUAL"]),
    revealedSequence: z.number().int().nonnegative(),
    issuedAt: z.number().int().nonnegative(),
    expiresAt: z.number().int().nonnegative(),
    resources: z.array(offlinePackageResourceSchema).min(1).max(1024),
    totalBytes: z
      .number()
      .int()
      .positive()
      .max(256 * 1024 * 1024),
  })
  .superRefine((manifest, context) => {
    if (new Set(manifest.resources.map((resource) => resource.id)).size !== manifest.resources.length)
      context.addIssue({ code: "custom", path: ["resources"], message: "Resource IDs must be unique." });
    if (manifest.resources.reduce((total, resource) => total + resource.bytes, 0) !== manifest.totalBytes)
      context.addIssue({ code: "custom", path: ["totalBytes"], message: "Manifest size must equal resource bytes." });
    if (manifest.expiresAt <= manifest.issuedAt || manifest.expiresAt - manifest.issuedAt > 86400000)
      context.addIssue({
        code: "custom",
        path: ["expiresAt"],
        message: "Package authorization must expire within one day.",
      });
  });
export type OfflinePackageManifest = z.infer<typeof offlinePackageManifestSchema>;
export type OfflinePackageState =
  | "NOT_AVAILABLE"
  | "AVAILABLE"
  | "QUEUED"
  | "DOWNLOADING"
  | "READY"
  | "PARTIAL"
  | "STALE"
  | "EXPIRED"
  | "CORRUPT"
  | "REVOKED"
  | "REMOVING"
  | "FAILED";
export const offlinePackageEnvelopeSchema = z.strictObject({
  manifest: offlinePackageManifestSchema,
  signature: z.string().regex(/^[A-Za-z0-9_-]{86}$/),
});
export type OfflinePackageEnvelope = z.infer<typeof offlinePackageEnvelopeSchema>;
export type OfflinePackageBinding = { scope: OfflinePackageScope; encryptionKey: CryptoKey; leaseExpiresAt: number };
export type EncryptedOfflinePackageRecord = {
  key: string;
  iv: number[];
  ciphertext: ArrayBuffer;
  storedBytes: number;
  updatedAt: number;
};
export interface LandfallPackageStorage {
  get(key: string): Promise<EncryptedOfflinePackageRecord | null>;
  put(record: EncryptedOfflinePackageRecord): Promise<void>;
  remove(key: string): Promise<void>;
  records(): Promise<EncryptedOfflinePackageRecord[]>;
  capacityBytes(): Promise<number>;
}
type StoredPackage = {
  envelope: OfflinePackageEnvelope;
  state: OfflinePackageState;
  resources: { id: string; key: string; bytes: number }[];
};
const encoder = new TextEncoder();
const hash = async (bytes: Uint8Array) =>
  Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes as BufferSource)), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
const scopeEqual = (a: OfflinePackageScope, b: OfflinePackageScope) =>
  Object.entries(a).every(([field, value]) => b[field as keyof OfflinePackageScope] === value);
export function offlineManifestPayload(manifest: OfflinePackageManifest): Uint8Array {
  return encoder.encode(JSON.stringify(offlinePackageManifestSchema.parse(manifest)));
}

/** Native/web storage adapters persist only authenticated ciphertext. Keys live in an actor-bound secure lease. */
export class LandfallOfflinePackageRepository {
  private generation = 0;
  private work: Promise<unknown> = Promise.resolve();
  constructor(
    private readonly storage: LandfallPackageStorage,
    private readonly trustedKeys: ReadonlyMap<string, LandfallEd25519PublicKey>,
    private readonly now = Date.now,
  ) {}
  install(
    input: unknown,
    binding: OfflinePackageBinding,
    fetchResource: (resource: OfflinePackageResource) => Promise<Uint8Array>,
    onProgress?: (value: { downloadedBytes: number; totalBytes: number }) => void,
  ): Promise<OfflinePackageState> {
    return this.serial(async () => {
      const envelope = await this.verify(input, binding);
      const key = await this.key(envelope.manifest.id, binding);
      const generation = this.generation;
      let stored: StoredPackage;
      try {
        stored = (await this.read(key, binding)) ?? { envelope, state: "AVAILABLE", resources: [] };
      } catch {
        await this.removeGroup(key);
        stored = { envelope, state: "CORRUPT", resources: [] };
      }
      if (JSON.stringify(stored.envelope) !== JSON.stringify(envelope)) {
        await this.removeGroup(key);
        stored = { envelope, state: "STALE", resources: [] };
      }
      await this.retain(key);
      const capacity = await this.storage.capacityBytes();
      const used = (await this.storage.records())
        .filter((record) => !record.key.startsWith(this.group(key)))
        .reduce((total, record) => total + record.storedBytes, 0);
      // Chunks are encrypted once as binary. Metadata updates never rewrite downloaded tile bytes.
      if (
        !Number.isFinite(capacity) ||
        used + envelope.manifest.totalBytes + 1024 * 1024 > Math.min(capacity, 512 * 1024 * 1024)
      )
        return "FAILED";
      for (const resource of envelope.manifest.resources) {
        this.assertLease(binding, generation);
        const existing = stored.resources.find((item) => item.id === resource.id);
        if (existing) {
          try {
            const bytes = await this.readBytes(existing.key, binding, 1024 * 1024 + 16);
            if (bytes && bytes.length === resource.bytes && (await hash(bytes)) === resource.sha256) continue;
          } catch {
            /* Refetch a corrupted resumable chunk; never treat it as ready. */
          }
        }
        stored.state = "DOWNLOADING";
        await this.write(key, stored, binding, generation);
        let bytes: Uint8Array;
        try {
          bytes = await fetchResource(resource);
        } catch {
          this.assertLease(binding, generation);
          stored.state = "PARTIAL";
          await this.write(key, stored, binding, generation);
          return "PARTIAL";
        }
        this.assertLease(binding, generation);
        if (bytes.length !== resource.bytes || (await hash(bytes)) !== resource.sha256) {
          stored.state = "CORRUPT";
          stored.resources = [];
          await this.removeGroup(key);
          await this.write(key, stored, binding, generation);
          return "CORRUPT";
        }
        const resourceKey = `${this.group(key)}:resource:${await hash(encoder.encode(resource.id))}`;
        await this.writeBytes(resourceKey, bytes, binding, generation);
        stored.resources = [
          ...stored.resources.filter((item) => item.id !== resource.id),
          { id: resource.id, key: resourceKey, bytes: bytes.length },
        ];
        stored.state = "PARTIAL";
        await this.write(key, stored, binding, generation);
        try {
          onProgress?.({
            downloadedBytes: stored.resources.reduce((total, value) => total + value.bytes, 0),
            totalBytes: envelope.manifest.totalBytes,
          });
        } catch {
          /* A presentation callback cannot change package verification or installation. */
        }
      }
      stored.state = "READY";
      await this.write(key, stored, binding, generation);
      return "READY";
    });
  }
  status(
    id: string,
    binding: OfflinePackageBinding,
    currentSequence?: number,
  ): Promise<{ state: OfflinePackageState; totalBytes: number; downloadedBytes: number; expiresAt: number | null }> {
    return this.serial(async () => {
      const empty = (state: OfflinePackageState) => ({ state, totalBytes: 0, downloadedBytes: 0, expiresAt: null });
      const key = await this.key(id, binding);
      if (binding.leaseExpiresAt <= this.now()) {
        await this.removeGroup(key);
        return empty("EXPIRED");
      }
      try {
        const stored = await this.read(key, binding);
        if (!stored) return empty("NOT_AVAILABLE");
        await this.verify(stored.envelope, binding);
        const manifest = stored.envelope.manifest;
        if (manifest.expiresAt <= this.now()) {
          await this.removeGroup(key);
          return empty("EXPIRED");
        }
        const intact = await this.resourcesIntact(stored, binding);
        const state = intact
          ? currentSequence !== undefined && currentSequence > manifest.revealedSequence
            ? "STALE"
            : stored.state === "DOWNLOADING"
              ? "PARTIAL"
              : stored.state
          : "CORRUPT";
        return {
          state,
          totalBytes: manifest.totalBytes,
          downloadedBytes: stored.resources.reduce((total, item) => total + item.bytes, 0),
          expiresAt: manifest.expiresAt,
        };
      } catch (error) {
        if (error instanceof Error && error.message === "LANDFALL_PACKAGE_EXPIRED") await this.removeGroup(key);
        return empty(error instanceof Error && error.message === "LANDFALL_PACKAGE_EXPIRED" ? "EXPIRED" : "CORRUPT");
      }
    });
  }
  resource(id: string, resourceId: string, binding: OfflinePackageBinding): Promise<Uint8Array | null> {
    return this.serial(async () => {
      this.assertLease(binding, this.generation);
      const stored = await this.read(await this.key(id, binding), binding);
      if (!stored || stored.state !== "READY") return null;
      await this.verify(stored.envelope, binding);
      if (!(await this.resourcesIntact(stored, binding))) throw new Error("LANDFALL_PACKAGE_CORRUPT");
      const item = stored.resources.find((resource) => resource.id === resourceId);
      return item ? this.readBytes(item.key, binding, 1024 * 1024 + 16) : null;
    });
  }
  remove(id: string, binding: OfflinePackageBinding) {
    return this.serial(async () => {
      await this.removeGroup(await this.key(id, binding));
    });
  }
  /** Logout/revocation invalidates in-flight work immediately, then removes only this repository's owned records. */
  revoke() {
    this.generation++;
    return this.serial(async () => {
      for (const record of await this.storage.records())
        if (record.key.startsWith("landfall-package:")) await this.storage.remove(record.key);
    });
  }
  private async verify(input: unknown, binding: OfflinePackageBinding): Promise<OfflinePackageEnvelope> {
    this.assertLease(binding, this.generation);
    const envelope = offlinePackageEnvelopeSchema.parse(input);
    const { manifest } = envelope;
    if (!scopeEqual(manifest.scope, binding.scope)) throw new Error("LANDFALL_PACKAGE_SCOPE_MISMATCH");
    if (manifest.issuedAt > this.now() + 1000 || manifest.expiresAt <= this.now())
      throw new Error("LANDFALL_PACKAGE_EXPIRED");
    const key = this.trustedKeys.get(manifest.keyId);
    if (!key || !isLandfallEd25519PublicKey(key)) throw new Error("LANDFALL_PACKAGE_SIGNER_UNAVAILABLE");
    const signature = Uint8Array.from(atob(envelope.signature.replaceAll("-", "+").replaceAll("_", "/")), (char) =>
      char.charCodeAt(0),
    );
    if (!(await verifyLandfallEd25519(key, signature, offlineManifestPayload(manifest))))
      throw new Error("LANDFALL_PACKAGE_SIGNATURE_INVALID");
    return envelope;
  }
  private async key(id: string, binding: OfflinePackageBinding) {
    landfallId.parse(id);
    offlinePackageScopeSchema.parse(binding.scope);
    return `landfall-package:${await hash(encoder.encode(JSON.stringify(binding.scope)))}:${await hash(encoder.encode(id))}:manifest`;
  }
  private assertLease(binding: OfflinePackageBinding, generation: number) {
    if (
      generation !== this.generation ||
      !Number.isFinite(this.now()) ||
      !Number.isFinite(binding.leaseExpiresAt) ||
      binding.leaseExpiresAt <= this.now() ||
      binding.leaseExpiresAt > this.now() + 86400000 ||
      binding.encryptionKey.algorithm.name !== "AES-GCM" ||
      binding.encryptionKey.type !== "secret"
    )
      throw new Error("LANDFALL_PACKAGE_LEASE_UNAVAILABLE");
  }
  private async resourcesIntact(stored: StoredPackage, binding: OfflinePackageBinding) {
    if (new Set(stored.resources.map((item) => item.id)).size !== stored.resources.length) return false;
    for (const item of stored.resources) {
      const manifest = stored.envelope.manifest.resources.find((resource) => resource.id === item.id);
      if (
        !manifest ||
        item.bytes !== manifest.bytes ||
        item.key !==
          `${this.group(await this.key(stored.envelope.manifest.id, binding))}:resource:${await hash(encoder.encode(item.id))}`
      )
        return false;
      const bytes = await this.readBytes(item.key, binding, 1024 * 1024 + 16);
      if (!bytes || bytes.length !== manifest.bytes || (await hash(bytes)) !== manifest.sha256) return false;
    }
    return stored.state !== "READY" || stored.resources.length === stored.envelope.manifest.resources.length;
  }
  private async read(key: string, binding: OfflinePackageBinding): Promise<StoredPackage | null> {
    const bytes = await this.readBytes(key, binding, 1024 * 1024);
    if (!bytes) return null;
    const stored: StoredPackage = JSON.parse(new TextDecoder().decode(bytes));
    stored.envelope = offlinePackageEnvelopeSchema.parse(stored.envelope);
    if (
      !Array.isArray(stored.resources) ||
      stored.resources.length > 1024 ||
      stored.resources.some(
        (item) =>
          typeof item.id !== "string" ||
          typeof item.key !== "string" ||
          !Number.isInteger(item.bytes) ||
          item.bytes <= 0 ||
          item.bytes > 1024 * 1024,
      )
    )
      throw new Error("LANDFALL_PACKAGE_CORRUPT");
    if (!scopeEqual(stored.envelope.manifest.scope, binding.scope)) throw new Error("LANDFALL_PACKAGE_SCOPE_MISMATCH");
    if (
      ![
        "NOT_AVAILABLE",
        "AVAILABLE",
        "QUEUED",
        "DOWNLOADING",
        "READY",
        "PARTIAL",
        "STALE",
        "EXPIRED",
        "CORRUPT",
        "REVOKED",
        "REMOVING",
        "FAILED",
      ].includes(stored.state)
    )
      throw new Error("LANDFALL_PACKAGE_CORRUPT");
    return stored;
  }
  private async write(key: string, value: StoredPackage, binding: OfflinePackageBinding, generation: number) {
    const bytes = encoder.encode(JSON.stringify(value));
    if (bytes.length > 1024 * 1024 - 16) throw new Error("LANDFALL_PACKAGE_METADATA_LIMIT");
    await this.writeBytes(key, bytes, binding, generation);
  }
  private async readBytes(
    key: string,
    binding: OfflinePackageBinding,
    maximumBytes: number,
  ): Promise<Uint8Array | null> {
    const record = await this.storage.get(key);
    if (!record) return null;
    if (record.key !== key || record.ciphertext.byteLength > maximumBytes || record.iv.length !== 12)
      throw new Error("LANDFALL_PACKAGE_CORRUPT");
    return new Uint8Array(
      await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: Uint8Array.from(record.iv), additionalData: encoder.encode(key) },
        binding.encryptionKey,
        record.ciphertext,
      ),
    );
  }
  private async writeBytes(key: string, bytes: Uint8Array, binding: OfflinePackageBinding, generation: number) {
    this.assertLease(binding, generation);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv, additionalData: encoder.encode(key) },
      binding.encryptionKey,
      bytes as BufferSource,
    );
    this.assertLease(binding, generation);
    await this.storage.put({ key, iv: [...iv], ciphertext, storedBytes: ciphertext.byteLength, updatedAt: this.now() });
  }
  private async retain(except: string) {
    const records = (await this.storage.records())
      .filter(
        (record) =>
          record.key.startsWith("landfall-package:") && record.key.endsWith(":manifest") && record.key !== except,
      )
      .sort((a, b) => a.updatedAt - b.updatedAt);
    for (const record of records.slice(0, Math.max(0, records.length - 3))) await this.removeGroup(record.key);
  }
  private group(key: string) {
    return key.replace(/:manifest$/, "");
  }
  private async removeGroup(key: string) {
    const prefix = `${this.group(key)}:`;
    for (const record of await this.storage.records())
      if (record.key.startsWith(prefix)) await this.storage.remove(record.key);
  }
  private serial<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.work.then(operation);
    this.work = result.catch(() => undefined);
    return result;
  }
}
