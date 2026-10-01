import type { PlayerLandfallBootstrap } from "@/landfall/player-bootstrap";
import type { PlayerLandfallEvidence } from "@/landfall/server-evidence";
import type { PlayerJournalBlock } from "@/chronicle/journal-contract";
import { LandfallOfflineRepository, rememberOfflineLease, type OfflineAvailability } from "@/landfall/offline-store";

const repository = new LandfallOfflineRepository();
const restoredUrls = new Set<string>();
let cacheGeneration = 0;
if (typeof window !== "undefined")
  window.addEventListener("landfall-offline-cleared", () => {
    cacheGeneration++;
    releaseOfflineAssets();
  });
const binding = (sessionId: string, versionId: string, csrfToken: string) => ({ sessionId, versionId, csrfToken });
const passageKinds = new Set([
  "livingChart",
  "waypointJourney",
  "routeJourney",
  "locationObservation",
  "locationReveal",
  "locationChoice",
]);

async function authorizedAsset(url: string, bootstrap: PlayerLandfallBootstrap) {
  const parsed = new URL(url, location.origin);
  if (
    parsed.origin !== location.origin ||
    !parsed.pathname.startsWith("/api/media/") ||
    parsed.searchParams.get("session") !== bootstrap.sessionId ||
    parsed.searchParams.get("version") !== bootstrap.publishedVersionId
  )
    return null;
  const response = await fetch(parsed.href, { cache: "no-store", signal: AbortSignal.timeout(5_000) });
  const mime = response.headers.get("content-type")?.split(";")[0] ?? "";
  if (
    !response.ok ||
    !["image/png", "image/jpeg", "image/webp"].includes(mime) ||
    Number(response.headers.get("content-length")) > 4 * 1024 * 1024 ||
    !response.body
  )
    return null;
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > 4 * 1024 * 1024) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return { url, mime, bytes: Array.from(bytes) };
}

/** Only released server projection and explicitly authorized first-party map assets enter the durable store. */
export async function rememberRevealedChart(
  bootstrap: PlayerLandfallBootstrap,
  csrfToken: string,
  passages: PlayerJournalBlock[] = [],
) {
  const generation = cacheGeneration;
  const urls = [bootstrap.scene.imageUrl, ...bootstrap.scene.overlays.map((item) => item.imageUrl)]
    .filter((url): url is string => Boolean(url))
    .slice(0, 6);
  const assets: { url: string; mime: string; bytes: number[] }[] = [];
  let assetBytes = 0;
  for (const url of [...new Set(urls)]) {
    try {
      const asset = await authorizedAsset(url, bootstrap);
      if (asset && assetBytes + asset.bytes.length <= 4 * 1024 * 1024) {
        assets.push(asset);
        assetBytes += asset.bytes.length;
      }
    } catch {
      /* A partial asset cache never prevents the online Chart. */
    }
  }
  const availability: OfflineAvailability = {
    shell: navigator.serviceWorker?.controller ? "READY" : "ONLINE_REQUIRED",
    chart: "READY",
    firstPartyAssets: assets.length === new Set(urls).size ? "READY" : "PARTIAL",
    externalTiles: bootstrap.scene.renderer === "MAPLIBRE_STYLE" ? "ONLINE_REQUIRED" : "NOT_USED",
    pendingEvidence: (await repository.pending(binding(bootstrap.sessionId, bootstrap.publishedVersionId, csrfToken)))
      ? 1
      : 0,
    sequence: bootstrap.currentSequence,
    synchronizedAt: Date.now(),
  };
  if (generation !== cacheGeneration) throw new Error("LANDFALL_OFFLINE_ACCESS_CLEARED");
  await repository.remember(binding(bootstrap.sessionId, bootstrap.publishedVersionId, csrfToken), {
    bootstrap: { ...bootstrap, scene: { ...bootstrap.scene, currentPosition: null } },
    passages: passages.filter((item) => passageKinds.has(item.blockType)),
    assets,
    availability,
  });
  if (generation !== cacheGeneration) {
    await repository.clear();
    throw new Error("LANDFALL_OFFLINE_ACCESS_CLEARED");
  }
  rememberOfflineLease(binding(bootstrap.sessionId, bootstrap.publishedVersionId, csrfToken));
  return availability;
}

export async function restoreOfflineVoyage(sessionId: string, versionId: string, csrfToken: string) {
  const record = await repository.restore(binding(sessionId, versionId, csrfToken));
  if (!record) return null;
  const assets = new Map(
    record.assets.map((asset) => {
      const url = URL.createObjectURL(new Blob([new Uint8Array(asset.bytes)], { type: asset.mime }));
      restoredUrls.add(url);
      return [asset.url, url];
    }),
  );
  return {
    ...record,
    bootstrap: {
      ...record.bootstrap,
      scene: {
        ...record.bootstrap.scene,
        imageUrl: record.bootstrap.scene.imageUrl ? assets.get(record.bootstrap.scene.imageUrl) : undefined,
        overlays: record.bootstrap.scene.overlays.map((overlay) => ({
          ...overlay,
          imageUrl: overlay.imageUrl ? assets.get(overlay.imageUrl) : undefined,
        })),
      },
    },
  };
}
export function releaseOfflineAssets() {
  for (const url of restoredUrls) URL.revokeObjectURL(url);
  restoredUrls.clear();
}
export async function restoreRevealedChart(sessionId: string, versionId: string, csrfToken: string) {
  return (await restoreOfflineVoyage(sessionId, versionId, csrfToken))?.bootstrap ?? null;
}
export async function queueLandfallEvidence(
  sessionId: string,
  versionId: string,
  csrfToken: string,
  evidence: PlayerLandfallEvidence,
) {
  await repository.enqueue(binding(sessionId, versionId, csrfToken), evidence);
}
export function pendingLandfallEvidence(sessionId: string, versionId: string, csrfToken: string) {
  return repository.pending(binding(sessionId, versionId, csrfToken));
}
export function clearLandfallEvidence(sessionId: string, versionId: string, csrfToken: string) {
  return repository.clearEvidence(binding(sessionId, versionId, csrfToken));
}
