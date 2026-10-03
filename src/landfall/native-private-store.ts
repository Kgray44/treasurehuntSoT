import { landfallNativeHost, landfallNativeRequest } from "@/landfall/native-bridge";

const allowed = (key: string) =>
  /^landfall-offline-identity-v2(?::chunk:[0-9]{1,3})?$/.test(key) ||
  /^landfall-(offline-lease-v2|region-lease-v1):[A-Za-z0-9._:-]{1,160}$/.test(key);
const CHUNK_CHARS = 5000;
const MAX_BYTES = 512 * 1024;
let generation = 0;
let work: Promise<unknown> = Promise.resolve();
if (typeof window !== "undefined")
  window.addEventListener("landfall-offline-cleared", () => {
    generation++;
  });
const hash = async (bytes: Uint8Array) =>
  Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes as BufferSource)), (value) =>
    value.toString(16).padStart(2, "0"),
  ).join("");
const assertGeneration = (expected: number) => {
  if (generation !== expected) throw new Error("LANDFALL_NATIVE_LEASE_REVOKED");
};
function serialized<T>(run: () => Promise<T>): Promise<T> {
  const result = work.then(run);
  work = result.catch(() => undefined);
  return result;
}

/** Only bounded authorization metadata crosses this bridge; map/resource bytes stay encrypted in IndexedDB. */
export function persistNativeLandfallLease(key: string, value: string, expiresAt: number): Promise<boolean> {
  if (!landfallNativeHost()) return Promise.resolve(false);
  if (!allowed(key) || !Number.isSafeInteger(expiresAt) || expiresAt <= Date.now() || expiresAt > Date.now() + 86400000)
    return Promise.resolve(false);
  const expected = generation;
  const run = async () => {
    try {
      const bytes = new TextEncoder().encode(value);
      if (bytes.length === 0 || bytes.length > MAX_BYTES) return false;
      const digest = await hash(bytes);
      assertGeneration(expected);
      const encoded = btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(""));
      const chunks = Math.ceil(encoded.length / CHUNK_CHARS);
      if (chunks > 120) return false;
      // Commit metadata last. A process interrupted during chunk writes cannot
      // restore a partial descriptor or substitute its own verification key.
      const put = async (name: string, content: string) => {
        assertGeneration(expected);
        const result = (await landfallNativeRequest("PRIVATE_STORE_PUT", { key: name, value: content, expiresAt })) as {
          accepted?: unknown;
        };
        if (result?.accepted !== true) throw new Error("LANDFALL_NATIVE_LEASE_STORAGE_UNAVAILABLE");
      };
      for (let index = 0; index < chunks; index++)
        await put(`${key}:chunk:${index}`, encoded.slice(index * CHUNK_CHARS, (index + 1) * CHUNK_CHARS));
      await put(key, JSON.stringify({ version: 1, chunks, sha256: digest, expiresAt }));
      assertGeneration(expected);
      // A smaller replacement must not leave old chunks consuming the bounded
      // native record budget. Remove only this lease's numbered surplus chunks.
      const reply = (await landfallNativeRequest("PRIVATE_STORE_LIST")) as { keys?: unknown };
      if (Array.isArray(reply?.keys) && reply.keys.length <= 128) {
        for (const name of reply.keys) {
          if (typeof name !== "string" || !name.startsWith(`${key}:chunk:`) || !allowed(name)) continue;
          const index = name.slice(`${key}:chunk:`.length);
          if (/^[0-9]+$/.test(index) && Number(index) >= chunks) {
            assertGeneration(expected);
            await landfallNativeRequest("PRIVATE_STORE_DELETE", { key: name });
          }
        }
      }
      assertGeneration(expected);
      return true;
    } catch {
      return false;
    }
  };
  return serialized(run);
}

export async function removeNativeLandfallLease(key: string) {
  if (!landfallNativeHost() || !allowed(key)) return;
  return serialized(async () => {
    const reply = (await landfallNativeRequest("PRIVATE_STORE_LIST")) as { keys?: unknown };
    if (!Array.isArray(reply?.keys) || reply.keys.length > 128) return;
    for (const name of reply.keys)
      if (typeof name === "string" && (name === key || (name.startsWith(`${key}:chunk:`) && allowed(name))))
        await landfallNativeRequest("PRIVATE_STORE_DELETE", { key: name });
  });
}

/** Restore encrypted native leases before checking actor changes or opening the offline shell. */
export async function restoreNativeLandfallLeases(): Promise<void> {
  if (!landfallNativeHost()) return;
  const expected = generation;
  return serialized(async () => {
    try {
      assertGeneration(expected);
      const reply = (await landfallNativeRequest("PRIVATE_STORE_LIST")) as { keys?: unknown };
      if (!Array.isArray(reply?.keys) || reply.keys.length > 128) return;
      for (const key of reply.keys) {
        if (typeof key !== "string" || !allowed(key) || /:chunk:[0-9]+$/.test(key)) continue;
        try {
          const get = async (name: string) => {
            assertGeneration(expected);
            const value = (await landfallNativeRequest("PRIVATE_STORE_GET", { key: name })) as { value?: unknown };
            return typeof value?.value === "string" && value.value.length <= 8192 ? value.value : null;
          };
          const metaText = await get(key);
          if (!metaText) continue;
          const meta = JSON.parse(metaText);
          if (
            meta?.version !== 1 ||
            !Number.isInteger(meta.chunks) ||
            meta.chunks < 1 ||
            meta.chunks > 120 ||
            !/^[a-f0-9]{64}$/.test(meta.sha256) ||
            !Number.isSafeInteger(meta.expiresAt) ||
            meta.expiresAt <= Date.now() ||
            meta.expiresAt > Date.now() + 86400000
          )
            continue;
          let encoded = "";
          let complete = true;
          for (let index = 0; index < meta.chunks; index++) {
            const chunk = await get(`${key}:chunk:${index}`);
            if (!chunk || !/^[A-Za-z0-9+/=]{1,5000}$/.test(chunk)) {
              complete = false;
              break;
            }
            encoded += chunk;
          }
          if (!complete) continue;
          const bytes = Uint8Array.from(atob(encoded), (value) => value.charCodeAt(0));
          if (bytes.length > MAX_BYTES || (await hash(bytes)) !== meta.sha256) continue;
          assertGeneration(expected);
          sessionStorage.setItem(key, new TextDecoder("utf-8", { fatal: true }).decode(bytes));
        } catch {
          // A corrupt descriptor cannot suppress another independently valid lease.
          assertGeneration(expected);
        }
      }
    } catch {
      /* A lost, expired or corrupt native lease never grants offline access. */
    }
  });
}
