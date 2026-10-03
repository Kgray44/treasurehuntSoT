import type { PlayerLandfallBootstrap } from "@/landfall/player-bootstrap";
import { playerLandfallEvidenceSchema, type PlayerLandfallEvidence } from "@/landfall/player-evidence-contract";
import type { PlayerJournalBlock } from "@/chronicle/journal-contract";
import { persistNativeLandfallLease, restoreNativeLandfallLeases } from "@/landfall/native-private-store";
import { landfallNativeHost } from "@/landfall/native-bridge";

export const landfallOfflineLimits = {
  schemaVersion: 2,
  voyages: 4,
  chartBytes: 512 * 1024,
  chartTtlMs: 30 * 60_000,
  outboxItems: 1,
  outboxBytes: 48 * 1024,
  outboxTtlMs: 90_000,
  assetCount: 6,
  assetBytes: 4 * 1024 * 1024,
} as const;
const databaseName = "landfall-offline-v2";
const leasePrefix = "landfall-offline-lease-v2:";
const identityKey = "landfall-offline-identity-v2";
let storageGeneration = 0;

type Binding = { sessionId: string; versionId: string; csrfToken: string };
export type OfflineLease = Binding & { expiresAt: number };
export type OfflineAvailability = {
  restart?: "TAB_ONLY" | "NATIVE_PREPARED" | "UNAVAILABLE";
  shell: "READY" | "ONLINE_REQUIRED";
  chart: "READY" | "STALE";
  firstPartyAssets: "READY" | "PARTIAL";
  externalTiles: "ONLINE_REQUIRED" | "NOT_USED";
  pendingEvidence: number;
  synchronizedAt: number;
  sequence: number;
};
type RecordEnvelope = {
  key: string;
  kind: "chart" | "outbox";
  expiresAt: number;
  createdAt: number;
  iv: number[];
  ciphertext: ArrayBuffer;
};
type ChartRecord = {
  bootstrap: PlayerLandfallBootstrap;
  passages: PlayerJournalBlock[];
  assets: { url: string; mime: string; bytes: number[] }[];
  availability: OfflineAvailability;
};

export interface LandfallOfflineStorage {
  all(): Promise<RecordEnvelope[]>;
  put(record: RecordEnvelope): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
}

function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => request.result.createObjectStore("records", { keyPath: "key" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("LANDFALL_STORAGE_BLOCKED"));
  });
}
async function transaction<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const generation = storageGeneration;
  const db = await database();
  try {
    if (generation !== storageGeneration) throw new Error("LANDFALL_OFFLINE_ACCESS_CLEARED");
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction("records", mode);
      const request = operation(tx.objectStore("records"));
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
export const browserLandfallStorage: LandfallOfflineStorage = {
  all: () => transaction("readonly", (store) => store.getAll()),
  put: async (record) => {
    await transaction("readwrite", (store) => store.put(record));
  },
  delete: async (key) => {
    await transaction("readwrite", (store) => store.delete(key));
  },
  clear: async () => {
    await transaction("readwrite", (store) => store.clear());
  },
};

async function bindingKey(binding: Binding) {
  if (!binding.csrfToken) throw new Error("LANDFALL_OFFLINE_IDENTITY_REQUIRED");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(binding)));
  const key = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  const encryption = await crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
  return { key, encryption };
}

/** Encrypted, short-lived delivery records. No location sample is stored in the chart or permanent history. */
export class LandfallOfflineRepository {
  constructor(
    private readonly storage: LandfallOfflineStorage = browserLandfallStorage,
    private readonly now = Date.now,
  ) {}
  private async evict() {
    const records = (await this.storage.all()).sort((a, b) => a.createdAt - b.createdAt || a.key.localeCompare(b.key));
    const charts = records.filter((record) => record.kind === "chart" && record.expiresAt > this.now());
    const expired = records.filter((record) => record.expiresAt <= this.now());
    for (const record of [...expired, ...charts.slice(0, Math.max(0, charts.length - landfallOfflineLimits.voyages))]) {
      await this.storage.delete(record.key);
      if (record.kind === "chart") await this.storage.delete(record.key.replace("chart:", "outbox:"));
    }
  }
  private async write(binding: Binding, kind: RecordEnvelope["kind"], value: unknown, ttl: number, maxBytes: number) {
    const generation = storageGeneration;
    const bytes = new TextEncoder().encode(
      JSON.stringify({ schemaVersion: 2, sessionId: binding.sessionId, versionId: binding.versionId, value }),
    );
    if (bytes.byteLength > maxBytes) throw new Error("LANDFALL_OFFLINE_QUOTA");
    const { key, encryption } = await bindingKey(binding);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const createdAt = this.now();
    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv, additionalData: new TextEncoder().encode(`${kind}:${key}`) },
      encryption,
      bytes,
    );
    if (generation !== storageGeneration) throw new Error("LANDFALL_OFFLINE_ACCESS_CLEARED");
    await this.storage.put({
      key: `${kind}:${key}`,
      kind,
      createdAt,
      expiresAt: createdAt + ttl,
      iv: Array.from(iv),
      ciphertext,
    });
    await this.evict();
  }
  private async read<T>(binding: Binding, kind: RecordEnvelope["kind"]): Promise<T | null> {
    await this.evict();
    const { key, encryption } = await bindingKey(binding);
    const record = (await this.storage.all()).find((item) => item.key === `${kind}:${key}`);
    if (!record || record.expiresAt <= this.now()) return null;
    try {
      const bytes = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: new Uint8Array(record.iv), additionalData: new TextEncoder().encode(record.key) },
        encryption,
        record.ciphertext,
      );
      const parsed = JSON.parse(new TextDecoder().decode(bytes));
      if (
        parsed.schemaVersion !== 2 ||
        parsed.sessionId !== binding.sessionId ||
        parsed.versionId !== binding.versionId
      )
        throw new Error("LANDFALL_OFFLINE_IDENTITY_MISMATCH");
      return parsed.value as T;
    } catch {
      await this.storage.delete(record.key);
      return null;
    }
  }
  async remember(binding: Binding, chart: ChartRecord) {
    if (chart.bootstrap.sessionId !== binding.sessionId || chart.bootstrap.publishedVersionId !== binding.versionId)
      throw new Error("LANDFALL_OFFLINE_IDENTITY_MISMATCH");
    // Asset bytes have a separate bounded budget; chart data is checked without assets first.
    if (
      new TextEncoder().encode(JSON.stringify({ ...chart, assets: [] })).byteLength > landfallOfflineLimits.chartBytes
    )
      throw new Error("LANDFALL_OFFLINE_QUOTA");
    const assets = chart.assets.slice(0, landfallOfflineLimits.assetCount);
    if (assets.reduce((sum, item) => sum + item.bytes.length, 0) > landfallOfflineLimits.assetBytes)
      throw new Error("LANDFALL_OFFLINE_QUOTA");
    await this.write(
      binding,
      "chart",
      { ...chart, assets },
      landfallOfflineLimits.chartTtlMs,
      landfallOfflineLimits.chartBytes + landfallOfflineLimits.assetBytes * 4,
    );
  }
  restore(binding: Binding) {
    return this.read<ChartRecord>(binding, "chart");
  }
  async enqueue(binding: Binding, input: PlayerLandfallEvidence) {
    if (
      input.method === "LANDMARK" ||
      input.method === "WATCHGLASS" ||
      input.method === "EVIDENCE_BUNDLE" ||
      input.sources ||
      input.watchglassReceipt ||
      input.landmarkReceipt ||
      input.contextualEvidence?.length
    )
      throw new Error("LANDFALL_CONTEXT_REQUIRES_FRESH_ONLINE_VERIFICATION");
    const evidence = playerLandfallEvidenceSchema.parse(input);
    // Zod produces owned values. Only accepted position delivery survives offline;
    // optional motion, course and elevation hints remain foreground-only.
    for (const observation of evidence.observations ?? []) {
      delete observation.provenance;
      if (observation.kind !== "PHYSICAL_POSITION") continue;
      delete observation.headingDegrees;
      delete observation.speedMetersPerSecond;
      delete observation.altitudeMeters;
      delete observation.altitudeAccuracyMeters;
    }
    if (evidence.sessionId !== binding.sessionId || evidence.publishedVersionId !== binding.versionId)
      throw new Error("LANDFALL_OFFLINE_IDENTITY_MISMATCH");
    const prior = await this.pending(binding);
    if (prior && prior.evidenceId !== evidence.evidenceId) throw new Error("LANDFALL_OFFLINE_OUTBOX_FULL");
    if (prior) return; // Retrying never extends delivery retention.
    if (
      evidence.observations?.some(
        (sample) => this.now() - Date.parse(sample.observedAt) > landfallOfflineLimits.outboxTtlMs,
      )
    )
      throw new Error("LANDFALL_OFFLINE_EVIDENCE_EXPIRED");
    await this.write(binding, "outbox", evidence, landfallOfflineLimits.outboxTtlMs, landfallOfflineLimits.outboxBytes);
  }
  async pending(binding: Binding) {
    const value = await this.read<PlayerLandfallEvidence>(binding, "outbox");
    if (!value) return null;
    const parsed = playerLandfallEvidenceSchema.safeParse(value);
    if (
      !parsed.success ||
      parsed.data.sessionId !== binding.sessionId ||
      parsed.data.publishedVersionId !== binding.versionId
    ) {
      await this.clearEvidence(binding);
      return null;
    }
    return parsed.data;
  }
  async clearEvidence(binding: Binding) {
    const { key } = await bindingKey(binding);
    await this.storage.delete(`outbox:${key}`);
  }
  async clear() {
    storageGeneration++;
    await this.storage.clear();
  }
}

export async function rememberOfflineLease(
  binding: Binding,
  regionExpiresAt?: number,
): Promise<NonNullable<OfflineAvailability["restart"]>> {
  const expiresAt = regionExpiresAt ?? Date.now() + landfallOfflineLimits.chartTtlMs;
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= Date.now() || expiresAt > Date.now() + 86400_000)
    throw new Error("LANDFALL_OFFLINE_LEASE_INVALID");
  const value = JSON.stringify({ ...binding, expiresAt });
  sessionStorage.setItem(leasePrefix + binding.sessionId, value);
  if (!landfallNativeHost()) return "TAB_ONLY";
  const identity = await persistNativeLandfallLease(identityKey, binding.csrfToken, expiresAt);
  const lease = await persistNativeLandfallLease(leasePrefix + binding.sessionId, value, expiresAt);
  return identity && lease ? "NATIVE_PREPARED" : "UNAVAILABLE";
}
export function offlineLease(sessionId: string): OfflineLease | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(leasePrefix + sessionId) ?? "null");
    if (
      !value ||
      value.sessionId !== sessionId ||
      typeof value.csrfToken !== "string" ||
      typeof value.versionId !== "string" ||
      value.expiresAt <= Date.now()
    )
      return null;
    return value;
  } catch {
    return null;
  }
}
export async function clearLandfallOfflineData() {
  for (let i = sessionStorage.length - 1; i >= 0; i--) {
    const key = sessionStorage.key(i);
    if (key?.startsWith(leasePrefix) || key?.startsWith("landfall-revealed-v1:") || key === identityKey)
      sessionStorage.removeItem(key);
  }
  window.dispatchEvent(new Event("landfall-offline-cleared"));
  if (typeof indexedDB !== "undefined") await new LandfallOfflineRepository().clear().catch(() => undefined);
}
export async function bindLandfallOfflineIdentity(csrfToken: string) {
  await restoreNativeLandfallLeases();
  const previous = sessionStorage.getItem(identityKey);
  if (previous && previous !== csrfToken) await clearLandfallOfflineData();
  sessionStorage.setItem(identityKey, csrfToken);
}
