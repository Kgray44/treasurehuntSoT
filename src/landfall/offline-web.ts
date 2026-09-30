import type { PlayerLandfallBootstrap } from "@/landfall/player-bootstrap";
import type { PlayerLandfallEvidence } from "@/landfall/server-evidence";

const maxAge = 30 * 60_000;
const prefix = "landfall-revealed-v1:";
const queued = new Map<string, { evidence: PlayerLandfallEvidence; at: number }>();

async function key(sessionId: string, versionId: string, csrfToken: string): Promise<string | null> {
  if (!csrfToken || typeof crypto === "undefined" || !crypto.subtle) return null;
  const input = new TextEncoder().encode(`${sessionId}:${versionId}:${csrfToken}`);
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", input));
  return prefix + Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Tab storage contains only the server's released, version-pinned projection. */
export async function rememberRevealedChart(bootstrap: PlayerLandfallBootstrap, csrfToken: string) {
  if (typeof sessionStorage === "undefined") return;
  const storageKey = await key(bootstrap.sessionId, bootstrap.publishedVersionId, csrfToken);
  if (!storageKey) return;
  const serialized = JSON.stringify({ at: Date.now(), bootstrap });
  if (serialized.length > 512 * 1024) return;
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const existing = sessionStorage.key(i);
      if (existing?.startsWith(prefix) && existing !== storageKey) sessionStorage.removeItem(existing);
    }
    sessionStorage.setItem(storageKey, serialized);
  } catch {
    /* Storage may be disabled or full; the live Chart still works. */
  }
}

export async function restoreRevealedChart(sessionId: string, versionId: string, csrfToken: string) {
  if (typeof sessionStorage === "undefined") return null;
  const storageKey = await key(sessionId, versionId, csrfToken);
  if (!storageKey) return null;
  try {
    const stored = sessionStorage.getItem(storageKey);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as { at: number; bootstrap: PlayerLandfallBootstrap };
    if (
      !Number.isFinite(parsed.at) ||
      Date.now() - parsed.at > maxAge ||
      parsed.bootstrap.sessionId !== sessionId ||
      parsed.bootstrap.publishedVersionId !== versionId
    ) {
      sessionStorage.removeItem(storageKey);
      return null;
    }
    return parsed.bootstrap;
  } catch {
    sessionStorage.removeItem(storageKey);
    return null;
  }
}

/** Sensor evidence remains in memory only and is bounded to one pending submission per session. */
export function queueLandfallEvidence(
  sessionId: string,
  versionId: string,
  csrfToken: string,
  evidence: PlayerLandfallEvidence,
) {
  const identity = `${sessionId}:${versionId}:${csrfToken}`;
  queued.set(identity, { evidence, at: Date.now() });
  while (queued.size > 4) queued.delete(queued.keys().next().value!);
}

export function pendingLandfallEvidence(sessionId: string, versionId: string, csrfToken: string) {
  const identity = `${sessionId}:${versionId}:${csrfToken}`;
  const entry = queued.get(identity);
  if (!entry) return null;
  if (Date.now() - entry.at > maxAge) {
    queued.delete(identity);
    return null;
  }
  return entry.evidence;
}

export function clearLandfallEvidence(sessionId: string, versionId: string, csrfToken: string) {
  queued.delete(`${sessionId}:${versionId}:${csrfToken}`);
}
