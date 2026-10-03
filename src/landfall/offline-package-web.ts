import { z } from "zod";
import type { PlayerLandfallBootstrap } from "@/landfall/player-bootstrap";
import { rememberOfflineLease, type OfflineAvailability } from "@/landfall/offline-store";
import {
  persistNativeLandfallLease,
  restoreNativeLandfallLeases,
  removeNativeLandfallLease,
} from "@/landfall/native-private-store";
import { landfallNativeHost, readNativeLandfallPower } from "@/landfall/native-bridge";
import {
  LandfallOfflinePackageRepository,
  offlinePackageEnvelopeSchema,
  type EncryptedOfflinePackageRecord,
  type LandfallPackageStorage,
  type OfflinePackageBinding,
} from "@/landfall/offline-package";

const databaseName = "landfall-regions-v1";
const leasePrefix = "landfall-region-lease-v1:";
let generation = 0;
const clients = new Map<string, LandfallOfflinePackageRepository>();
const urls = new Set<string>();
async function operation<T>(mode: IDBTransactionMode, callback: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const openedAt = generation;
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => request.result.createObjectStore("regions", { keyPath: "key" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error("LANDFALL_REGION_STORAGE_UNAVAILABLE"));
    request.onblocked = () => reject(new Error("LANDFALL_REGION_STORAGE_BLOCKED"));
  });
  try {
    if (openedAt !== generation) throw new Error("LANDFALL_REGION_REVOKED");
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction("regions", mode);
      const request = callback(transaction.objectStore("regions"));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onerror = transaction.onabort = () => reject(new Error("LANDFALL_REGION_STORAGE_FAILED"));
    });
  } finally {
    database.close();
  }
}
const storage: LandfallPackageStorage = {
  get: async (key) =>
    (await operation<EncryptedOfflinePackageRecord | undefined>("readonly", (store) => store.get(key))) ?? null,
  put: async (record) => {
    await operation("readwrite", (store) => store.put(record));
  },
  remove: async (key) => {
    await operation("readwrite", (store) => store.delete(key));
  },
  records: () => operation<EncryptedOfflinePackageRecord[]>("readonly", (store) => store.getAll()),
  capacityBytes: async () => {
    const estimate = await navigator.storage?.estimate();
    return estimate?.quota === undefined
      ? 64 * 1024 * 1024
      : Math.max(0, Math.min(512 * 1024 * 1024, estimate.quota - (estimate.usage ?? 0)));
  },
};
const descriptorSchema = z.object({
  available: z.literal(true),
  envelope: offlinePackageEnvelopeSchema,
  verificationKey: z.object({
    id: z.string().min(1).max(128),
    jwk: z.object({ kty: z.literal("OKP"), crv: z.literal("Ed25519"), x: z.string().regex(/^[A-Za-z0-9_-]{43}$/) }),
  }),
  availability: z.object({ assets: z.enum(["READY", "PARTIAL"]), externalTiles: z.literal("ONLINE_REQUIRED") }),
});
type Descriptor = z.infer<typeof descriptorSchema>;
export type LandfallWebPackage = {
  descriptor: Descriptor;
  binding: OfflinePackageBinding;
  repository: LandfallOfflinePackageRepository;
  nativeDescriptorStored?: boolean;
};
async function open(descriptor: Descriptor, csrfToken: string): Promise<LandfallWebPackage> {
  const generationAtStart = generation;
  if (!csrfToken || descriptor.envelope.manifest.keyId !== descriptor.verificationKey.id)
    throw new Error("LANDFALL_REGION_IDENTITY_REQUIRED");
  const scope = descriptor.envelope.manifest.scope;
  const keyMaterial = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify([scope, csrfToken])),
  );
  const encryptionKey = await crypto.subtle.importKey("raw", keyMaterial, "AES-GCM", false, ["encrypt", "decrypt"]);
  const verificationKey = await crypto.subtle.importKey("jwk", descriptor.verificationKey.jwk, "Ed25519", false, [
    "verify",
  ]);
  if (generationAtStart !== generation) throw new Error("LANDFALL_REGION_REVOKED");
  const clientKey = `${descriptor.verificationKey.id}:${descriptor.verificationKey.jwk.x}`;
  let repository = clients.get(clientKey);
  if (!repository) {
    if (clients.size >= 16) throw new Error("LANDFALL_REGION_KEY_CAPACITY");
    repository = new LandfallOfflinePackageRepository(
      storage,
      new Map([[descriptor.verificationKey.id, verificationKey]]),
    );
    clients.set(clientKey, repository);
  }
  return {
    descriptor,
    repository,
    binding: { scope, encryptionKey, leaseExpiresAt: descriptor.envelope.manifest.expiresAt },
  };
}
/** Trust anchor is obtained only from the currently authenticated same-origin server, never package contents. */
export async function prepareLandfallRegion(sessionId: string, csrfToken: string) {
  const startedGeneration = generation;
  const response = await fetch(`/api/player/playthroughs/${encodeURIComponent(sessionId)}/landfall/package`, {
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error("LANDFALL_REGION_AUTHORIZATION_REQUIRED");
  const descriptor = descriptorSchema.parse(await response.json());
  if (startedGeneration !== generation) throw new Error("LANDFALL_REGION_REVOKED");
  if (descriptor.envelope.manifest.scope.sessionId !== sessionId) throw new Error("LANDFALL_REGION_SCOPE_MISMATCH");
  const client = await open(descriptor, csrfToken);
  if (startedGeneration !== generation) throw new Error("LANDFALL_REGION_REVOKED");
  sessionStorage.setItem(leasePrefix + sessionId, JSON.stringify(descriptor));
  client.nativeDescriptorStored = await persistNativeLandfallLease(
    leasePrefix + sessionId,
    JSON.stringify(descriptor),
    descriptor.envelope.manifest.expiresAt,
  );
  if (startedGeneration !== generation) throw new Error("LANDFALL_REGION_REVOKED");
  return client;
}
export async function restoreLandfallRegion(sessionId: string, publishedVersionId: string, csrfToken: string) {
  const startedGeneration = generation;
  try {
    if (!sessionStorage.getItem(leasePrefix + sessionId)) await restoreNativeLandfallLeases();
    const descriptor = descriptorSchema.parse(JSON.parse(sessionStorage.getItem(leasePrefix + sessionId) ?? "null"));
    if (
      descriptor.envelope.manifest.scope.sessionId !== sessionId ||
      descriptor.envelope.manifest.scope.publishedVersionId !== publishedVersionId ||
      descriptor.envelope.manifest.expiresAt <= Date.now()
    )
      return null;
    const client = await open(descriptor, csrfToken);
    client.nativeDescriptorStored = await persistNativeLandfallLease(
      leasePrefix + sessionId,
      JSON.stringify(descriptor),
      descriptor.envelope.manifest.expiresAt,
    );
    if (startedGeneration !== generation) return null;
    return client;
  } catch {
    return null;
  }
}
export async function downloadLandfallRegion(client: LandfallWebPackage) {
  if (landfallNativeHost()) {
    const power = await readNativeLandfallPower();
    if (!power || power.state !== "READY" || power.lowPower || power.thermalPressure)
      throw new Error("LANDFALL_DOWNLOAD_POWER_PAUSED");
  }
  return client.repository.install(client.descriptor.envelope, client.binding, async (resource) => {
    const manifest = client.descriptor.envelope.manifest;
    const query = new URLSearchParams({
      package: manifest.id,
      issuedAt: String(manifest.issuedAt),
      resource: resource.id,
    });
    const response = await fetch(
      `/api/player/playthroughs/${encodeURIComponent(manifest.scope.sessionId)}/landfall/package?${query}`,
      { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15_000) },
    );
    if (!response.ok || !response.body || Number(response.headers.get("content-length")) > resource.bytes)
      throw new Error("LANDFALL_REGION_RESOURCE_UNAVAILABLE");
    const reader = response.body.getReader();
    const output = new Uint8Array(resource.bytes);
    let offset = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (offset + value.length > output.length) {
        await reader.cancel();
        throw new Error("LANDFALL_REGION_RESOURCE_TOO_LARGE");
      }
      output.set(value, offset);
      offset += value.length;
    }
    if (offset !== output.length) throw new Error("LANDFALL_REGION_RESOURCE_INCOMPLETE");
    return output;
  });
}
/** Lease and signature are checked before released map resources are materialized into ephemeral object URLs. */
export async function restoreLandfallRegionChart(sessionId: string, publishedVersionId: string, csrfToken: string) {
  const client = await restoreLandfallRegion(sessionId, publishedVersionId, csrfToken);
  if (!client) return null;
  const manifest = client.descriptor.envelope.manifest;
  const status = await client.repository.status(manifest.id, client.binding);
  if (status.state !== "READY") return null;
  const bytes = await client.repository.resource(manifest.id, "released-chart", client.binding);
  if (!bytes) return null;
  const bootstrap = JSON.parse(new TextDecoder().decode(bytes)) as PlayerLandfallBootstrap;
  if (
    bootstrap.sessionId !== sessionId ||
    bootstrap.publishedVersionId !== publishedVersionId ||
    bootstrap.runtimeDefinition.worldspaces[0]?.id !== manifest.scope.worldspaceId
  )
    throw new Error("LANDFALL_REGION_SCOPE_MISMATCH");
  const images = new Map<string, string>();
  for (const item of manifest.resources.filter((resource) => resource.kind === "ASSET")) {
    const asset = await client.repository.resource(manifest.id, item.id, client.binding);
    if (!asset) continue;
    const url = URL.createObjectURL(new Blob([asset as BlobPart], { type: item.mime }));
    urls.add(url);
    images.set(item.id.slice("asset-".length), url);
  }
  const project = (scene: PlayerLandfallBootstrap["scene"]) => ({
    ...scene,
    currentPosition: null,
    imageUrl: scene.imageAssetId ? images.get(scene.imageAssetId) : undefined,
    overlays: scene.overlays.map((overlay) => ({ ...overlay, imageUrl: images.get(overlay.assetId) })),
  });
  const availability: OfflineAvailability = {
    shell: navigator.serviceWorker?.controller ? "READY" : "ONLINE_REQUIRED",
    chart: "READY",
    firstPartyAssets: client.descriptor.availability.assets,
    externalTiles: bootstrap.scene.renderer === "MAPLIBRE_STYLE" ? "ONLINE_REQUIRED" : "NOT_USED",
    pendingEvidence: 0,
    synchronizedAt: manifest.issuedAt,
    sequence: manifest.revealedSequence,
  };
  return {
    bootstrap: {
      ...bootstrap,
      scene: project(bootstrap.scene),
      availableMaps: bootstrap.availableMaps?.map((map) => ({ ...map, scene: project(map.scene) })),
    },
    passages: [],
    assets: [],
    availability,
  };
}
export async function extendLandfallRegionLease(client: LandfallWebPackage, csrfToken: string) {
  const restart = await rememberOfflineLease(
    { sessionId: client.binding.scope.sessionId, versionId: client.binding.scope.publishedVersionId, csrfToken },
    client.binding.leaseExpiresAt,
  );
  return landfallNativeHost() && !client.nativeDescriptorStored ? "UNAVAILABLE" : restart;
}
export async function removeLandfallRegionLease(sessionId: string) {
  for (const key of [leasePrefix + sessionId, "landfall-offline-lease-v2:" + sessionId]) {
    sessionStorage.removeItem(key);
    await removeNativeLandfallLease(key);
  }
}
export async function clearLandfallRegions() {
  generation++;
  for (const client of clients.values()) await client.revoke();
  clients.clear();
  await operation("readwrite", (store) => store.clear());
  for (let index = sessionStorage.length - 1; index >= 0; index--) {
    const key = sessionStorage.key(index);
    if (key?.startsWith(leasePrefix)) sessionStorage.removeItem(key);
  }
  for (const url of urls) URL.revokeObjectURL(url);
  urls.clear();
}
if (typeof window !== "undefined")
  window.addEventListener("landfall-offline-cleared", () => {
    void clearLandfallRegions().catch(() => undefined);
  });
