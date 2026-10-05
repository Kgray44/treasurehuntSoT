import { createHash, createPrivateKey, createPublicKey, sign, webcrypto } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  LandfallOfflinePackageRepository,
  offlineManifestPayload,
  type OfflinePackageBinding,
  type OfflinePackageEnvelope,
  type EncryptedOfflinePackageRecord,
  type LandfallPackageStorage,
} from "@/landfall/offline-package";

beforeEach(() => vi.stubGlobal("crypto", webcrypto));
async function fixture() {
  const signing = createPrivateKey({
    key: Buffer.concat([
      Buffer.from("302e020100300506032b657004220420", "hex"),
      createHash("sha256").update("SYNTHETIC-PACKAGE-TEST-ONLY").digest(),
    ]),
    format: "der",
    type: "pkcs8",
  });
  const publicKey = await crypto.subtle.importKey(
    "jwk",
    createPublicKey(signing).export({ format: "jwk" }) as JsonWebKey,
    "Ed25519",
    false,
    ["verify"],
  );
  const encryptionKey = await crypto.subtle.importKey("raw", new Uint8Array(32).fill(7), "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
  let now = 10000;
  const binding: OfflinePackageBinding = {
    scope: {
      playerProfileId: "synthetic-player",
      sessionId: "voyage",
      taleId: "tale",
      publishedVersionId: "edition",
      worldspaceId: "world",
    },
    encryptionKey,
    leaseExpiresAt: 20000,
  };
  const chunks = [new TextEncoder().encode('{"revealed":"chart"}'), new TextEncoder().encode('{"route":"released"}')];
  const manifest = {
    version: 1 as const,
    id: "region-1",
    keyId: "synthetic-package-key",
    scope: binding.scope,
    worldspaceKind: "VIRTUAL" as const,
    revealedSequence: 2,
    issuedAt: 1000,
    expiresAt: 19000,
    resources: chunks.map((bytes, index) => ({
      id: `resource-${index}`,
      kind: index === 0 ? ("CHART" as const) : ("ROUTE" as const),
      bytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      mime: "application/json" as const,
      attribution: "Synthetic authored data",
      license: "Synthetic fixture",
      offlineRights: "ALLOWED" as const,
    })),
    totalBytes: chunks.reduce((total, bytes) => total + bytes.length, 0),
  };
  const envelope: OfflinePackageEnvelope = {
    manifest,
    signature: sign(null, Buffer.from(offlineManifestPayload(manifest)), signing).toString("base64url"),
  };
  const records = new Map<string, EncryptedOfflinePackageRecord>();
  let capacity = 10 * 1024 * 1024;
  const storage: LandfallPackageStorage = {
    get: async (key) => records.get(key) ?? null,
    put: async (record) => {
      records.set(record.key, record);
    },
    remove: async (key) => {
      records.delete(key);
    },
    records: async () => [...records.values()],
    capacityBytes: async () => capacity,
  };
  const keys = new Map([[manifest.keyId, publicKey]]);
  const repository = new LandfallOfflinePackageRepository(storage, keys, () => now);
  return {
    repository,
    storage,
    keys,
    binding,
    envelope,
    chunks,
    records,
    setNow: (value: number) => {
      now = value;
    },
    setCapacity: (value: number) => {
      capacity = value;
    },
    now: () => now,
  };
}
describe("authorized offline region lifecycle", () => {
  it("reports verified bytes only and presentation errors cannot prevent installation", async () => {
    const f = await fixture();
    const progress: { downloadedBytes: number; totalBytes: number }[] = [];
    expect(
      await f.repository.install(
        f.envelope,
        f.binding,
        async (resource) => f.chunks[Number(resource.id.at(-1))],
        (value) => {
          progress.push(value);
          throw new Error("SYNTHETIC_PRESENTATION_FAILURE");
        },
      ),
    ).toBe("READY");
    expect(progress).toEqual([
      { downloadedBytes: f.chunks[0].length, totalBytes: f.envelope.manifest.totalBytes },
      { downloadedBytes: f.envelope.manifest.totalBytes, totalBytes: f.envelope.manifest.totalBytes },
    ]);
    const invalid = await fixture();
    const reported = vi.fn();
    expect(
      await invalid.repository.install(
        invalid.envelope,
        invalid.binding,
        async () => new Uint8Array([1, 2, 3]),
        reported,
      ),
    ).toBe("CORRUPT");
    expect(reported).not.toHaveBeenCalled();
  });
  it("downloads deterministically, survives repository restart and detects ciphertext tamper", async () => {
    const f = await fixture();
    expect(
      await f.repository.install(f.envelope, f.binding, async (resource) => f.chunks[Number(resource.id.at(-1))]),
    ).toBe("READY");
    expect((await f.repository.status("region-1", f.binding)).downloadedBytes).toBe(f.envelope.manifest.totalBytes);
    const restarted = new LandfallOfflinePackageRepository(f.storage, f.keys, f.now);
    expect([...(await restarted.resource("region-1", "resource-1", f.binding))!]).toEqual([...f.chunks[1]]);
    const stored = [...f.records.values()][0];
    expect(new TextDecoder().decode(stored.ciphertext)).not.toContain("revealed");
    new Uint8Array(stored.ciphertext)[0] ^= 1;
    expect((await restarted.status("region-1", f.binding)).state).toBe("CORRUPT");
  });
  it("resumes partial downloads without re-fetching verified chunks and never exposes partial content as ready", async () => {
    const f = await fixture();
    expect(
      await f.repository.install(f.envelope, f.binding, async (resource) => {
        if (resource.id === "resource-1") throw new Error("offline");
        return f.chunks[0];
      }),
    ).toBe("PARTIAL");
    expect(await f.repository.resource("region-1", "resource-0", f.binding)).toBeNull();
    const restarted = new LandfallOfflinePackageRepository(f.storage, f.keys, f.now);
    const requested: string[] = [];
    expect(
      await restarted.install(f.envelope, f.binding, async (resource) => {
        requested.push(resource.id);
        return f.chunks[1];
      }),
    ).toBe("READY");
    expect(requested).toEqual(["resource-1"]);
  });
  it("rejects cross-account scope, bad signatures, expired leases, storage exhaustion and changed revealed state", async () => {
    const f = await fixture();
    const crossAccount = { ...f.binding, scope: { ...f.binding.scope, playerProfileId: "other-player" } };
    await expect(f.repository.install(f.envelope, crossAccount, async () => f.chunks[0])).rejects.toThrow(
      "SCOPE_MISMATCH",
    );
    const tampered = structuredClone(f.envelope);
    tampered.manifest.revealedSequence++;
    await expect(f.repository.install(tampered, f.binding, async () => f.chunks[0])).rejects.toThrow(
      "SIGNATURE_INVALID",
    );
    f.setCapacity(100);
    expect(await f.repository.install(f.envelope, f.binding, async () => f.chunks[0])).toBe("FAILED");
    f.setCapacity(2000000);
    await f.repository.install(f.envelope, f.binding, async (resource) => f.chunks[Number(resource.id.at(-1))]);
    expect((await f.repository.status("region-1", f.binding, 3)).state).toBe("STALE");
    expect((await f.repository.status("region-1", crossAccount)).state).toBe("NOT_AVAILABLE");
    f.setNow(19001);
    expect((await f.repository.status("region-1", f.binding)).state).toBe("EXPIRED");
    f.setNow(20001);
    await expect(f.repository.resource("region-1", "resource-1", f.binding)).rejects.toThrow("LEASE_UNAVAILABLE");
  });
  it("removes only owned package records and cancels in-flight work on logout", async () => {
    const f = await fixture();
    let release: (value: Uint8Array) => void = () => undefined;
    let fetching: () => void = () => undefined;
    const started = new Promise<void>((resolve) => {
      fetching = resolve;
    });
    const download = f.repository.install(f.envelope, f.binding, async () => {
      fetching();
      return new Promise<Uint8Array>((resolve) => {
        release = resolve;
      });
    });
    await started;
    const revoked = f.repository.revoke();
    release(f.chunks[0]);
    await expect(download).rejects.toThrow("LEASE_UNAVAILABLE");
    await revoked;
    expect(f.records.size).toBe(0);
  });
});
