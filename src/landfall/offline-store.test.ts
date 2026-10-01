import { webcrypto } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  LandfallOfflineRepository,
  landfallOfflineLimits,
  type LandfallOfflineStorage,
} from "@/landfall/offline-store";
import { landfallFixture, physicalObservation } from "@/landfall/fixtures";
import { projectPlayerLandfallBootstrap } from "@/landfall/player-bootstrap";

const binding = { sessionId: "session-1", versionId: "version-1", csrfToken: "synthetic-session-csrf" };
const bootstrap = projectPlayerLandfallBootstrap(
  {
    sessionId: "session-1",
    publishedVersionId: "version-1",
    taleId: "fixture-tale",
    currentSequence: 4,
    definition: landfallFixture,
  },
  { chapterId: null, blockId: null, releasedAssets: [] },
);
const availability = {
  shell: "READY" as const,
  chart: "READY" as const,
  firstPartyAssets: "READY" as const,
  externalTiles: "ONLINE_REQUIRED" as const,
  pendingEvidence: 0,
  synchronizedAt: 1000,
  sequence: 4,
};
const chart = { bootstrap, passages: [], assets: [], availability };
const evidence = {
  schemaVersion: 1 as const,
  sessionId: "session-1",
  publishedVersionId: "version-1",
  worldspaceId: "town",
  waypointId: "town-arrival",
  evidenceId: "queued-evidence",
  expectedSequence: 4,
  idempotencyKey: "synthetic-queued-idempotency",
  method: "PLAYER_FALLBACK" as const,
};

describe("durable session-bound Landfall offline store", () => {
  let storage: LandfallOfflineStorage;
  let clock: number;
  beforeEach(() => {
    vi.stubGlobal("crypto", webcrypto);
    clock = Date.parse("2026-09-30T12:00:00.000Z");
    const records = new Map<string, Awaited<ReturnType<LandfallOfflineStorage["all"]>>[number]>();
    storage = {
      all: async () => structuredClone([...records.values()]),
      put: async (record) => {
        records.set(record.key, structuredClone(record));
      },
      delete: async (key) => {
        records.delete(key);
      },
      clear: async () => {
        records.clear();
      },
    };
  });
  it("restores an encrypted released chart after the repository instance is replaced", async () => {
    await new LandfallOfflineRepository(storage, () => clock).remember(binding, chart);
    const durable = await storage.all();
    expect(JSON.stringify(durable)).not.toMatch(/town-arrival|csrf|latitude|longitude/);
    const restored = await new LandfallOfflineRepository(storage, () => clock).restore(binding);
    expect(restored).toEqual(chart);
    expect(JSON.stringify(restored)).not.toContain("isle-region");
    expect(restored?.bootstrap.scene.currentPosition).toBeUndefined();
  });
  it("rejects transient landmark receipts and sensor context before writing the outbox", async () => {
    const store = new LandfallOfflineRepository(storage, () => clock);
    for (const input of [
      { ...evidence, method: "LANDMARK" as const },
      { ...evidence, method: "WATCHGLASS" as const, watchglassReceipt: "synthetic-certified-receipt" },
      { ...evidence, watchglassReceipt: "synthetic-certified-receipt" },
      { ...evidence, landmarkReceipt: "synthetic-expiring-receipt" },
      {
        ...evidence,
        contextualEvidence: [
          {
            kind: "HEADING" as const,
            id: "heading",
            sessionId: binding.sessionId,
            publishedVersionId: binding.versionId,
            worldspaceId: "town",
            observedAt: new Date(clock).toISOString(),
            degrees: 90,
            accuracyDegrees: 10,
          },
        ],
      },
    ])
      await expect(store.enqueue(binding, input)).rejects.toThrow("REQUIRES_FRESH_ONLINE_VERIFICATION");
    expect(await storage.all()).toEqual([]);
  });
  it.each([
    { csrfToken: "another-account-session" },
    { sessionId: "another-voyage" },
    { versionId: "another-edition" },
  ])("rejects identity mismatch %j", async (different) => {
    const store = new LandfallOfflineRepository(storage, () => clock);
    await store.remember(binding, chart);
    await store.enqueue(binding, evidence);
    expect(await store.restore({ ...binding, ...different })).toBeNull();
    expect(await store.pending({ ...binding, ...different })).toBeNull();
  });
  it("expires chart and outbox and removes both ciphertext records", async () => {
    const store = new LandfallOfflineRepository(storage, () => clock);
    await store.remember(binding, chart);
    await store.enqueue(binding, evidence);
    clock += landfallOfflineLimits.outboxTtlMs;
    expect(await store.pending(binding)).toBeNull();
    expect(await store.restore(binding)).not.toBeNull();
    clock += landfallOfflineLimits.chartTtlMs;
    expect(await store.restore(binding)).toBeNull();
    expect(await storage.all()).toEqual([]);
  });
  it("durably retains delivery identity and sequence without extending expiry on retry", async () => {
    const store = new LandfallOfflineRepository(storage, () => clock);
    await store.enqueue(binding, evidence);
    clock += 1000;
    await store.enqueue(binding, evidence);
    expect(await new LandfallOfflineRepository(storage, () => clock).pending(binding)).toEqual(evidence);
    expect((await storage.all())[0].expiresAt).toBe(clock - 1000 + landfallOfflineLimits.outboxTtlMs);
    await expect(store.enqueue(binding, { ...evidence, evidenceId: "second-item" })).rejects.toThrow("OUTBOX_FULL");
    await store.clearEvidence(binding);
    expect(await store.pending(binding)).toBeNull();
  });
  it("bounds physical delivery samples, encrypts them and deletes after acknowledgement", async () => {
    const store = new LandfallOfflineRepository(storage, () => clock);
    const samples = [physicalObservation("queued-evidence", new Date(clock).toISOString())];
    await store.enqueue(binding, { ...evidence, method: "FOREGROUND_LOCATION", observations: samples });
    expect(JSON.stringify(await storage.all())).not.toMatch(/latitude|longitude|WGS84/);
    expect((await store.pending(binding))?.observations).toEqual(samples);
    await store.clearEvidence(binding);
    expect(await storage.all()).toEqual([]);
    await expect(
      store.enqueue(binding, {
        ...evidence,
        method: "FOREGROUND_LOCATION",
        observations: Array.from({ length: 21 }, () => samples[0]),
      }),
    ).rejects.toThrow();
  });
  it("restores accepted position delivery without persisting foreground hints or mutating the input", async () => {
    const sample = physicalObservation("queued-evidence", new Date(clock).toISOString());
    if (sample.kind !== "PHYSICAL_POSITION") throw new Error("physical fixture required");
    const input = {
      ...evidence,
      method: "FOREGROUND_LOCATION" as const,
      observations: [
        {
          ...sample,
          headingDegrees: 90,
          speedMetersPerSecond: 2,
          altitudeMeters: 30,
          altitudeAccuracyMeters: 1,
          provenance: { independentEvidenceRef: "transient-root", contextEvidenceRefs: ["context-prior"] },
        },
      ],
    };
    const before = structuredClone(input);
    await new LandfallOfflineRepository(storage, () => clock).enqueue(binding, input);
    const durable = await storage.all();
    expect(durable).toHaveLength(1);
    expect(JSON.stringify(durable)).not.toMatch(
      /latitude|longitude|headingDegrees|speedMetersPerSecond|altitudeMeters|altitudeAccuracyMeters/,
    );
    const restored = await new LandfallOfflineRepository(storage, () => clock).pending(binding);
    expect(restored).toEqual({ ...evidence, method: "FOREGROUND_LOCATION", observations: [sample] });
    expect(JSON.stringify(restored)).not.toMatch(/transient-root|context-prior|provenance/);
    expect(JSON.stringify(restored)).not.toMatch(
      /headingDegrees|speedMetersPerSecond|altitudeMeters|altitudeAccuracyMeters/,
    );
    expect(input).toEqual(before);
    expect(durable[0].expiresAt).toBe(clock + landfallOfflineLimits.outboxTtlMs);
  });
  it("evicts the oldest Voyage deterministically and removes its outbox", async () => {
    const store = new LandfallOfflineRepository(storage, () => clock);
    for (let i = 0; i < 5; i++) {
      const sessionId = `session-${i}`;
      await store.remember({ ...binding, sessionId }, { ...chart, bootstrap: { ...bootstrap, sessionId } });
      if (i === 0) await store.enqueue({ ...binding, sessionId }, { ...evidence, sessionId });
      clock++;
    }
    expect(await store.restore({ ...binding, sessionId: "session-0" })).toBeNull();
    expect(await store.pending({ ...binding, sessionId: "session-0" })).toBeNull();
    expect((await storage.all()).filter((record) => record.kind === "chart")).toHaveLength(4);
  });
  it("fails closed on ciphertext corruption, storage quota and invalid source binding", async () => {
    const store = new LandfallOfflineRepository(storage, () => clock);
    await store.remember(binding, chart);
    const record = (await storage.all())[0];
    new Uint8Array(record.ciphertext)[0] ^= 1;
    await storage.put(record);
    expect(await store.restore(binding)).toBeNull();
    await expect(
      store.remember(binding, {
        ...chart,
        passages: [{ configuration: { body: "x".repeat(landfallOfflineLimits.chartBytes) } }] as never,
      }),
    ).rejects.toThrow("QUOTA");
    await expect(store.enqueue(binding, { ...evidence, sessionId: "wrong-voyage" })).rejects.toThrow(
      "IDENTITY_MISMATCH",
    );
  });
  it("explicit clearing revokes all cached chart, assets and delivery records", async () => {
    const store = new LandfallOfflineRepository(storage, () => clock);
    await store.remember(binding, chart);
    await store.enqueue(binding, evidence);
    await store.clear();
    expect(await store.restore(binding)).toBeNull();
    expect(await store.pending(binding)).toBeNull();
  });
  it("clearing while encryption is in flight prevents late cache resurrection", async () => {
    const store = new LandfallOfflineRepository(storage, () => clock);
    const pendingWrite = store.remember(binding, chart);
    const rejection = expect(pendingWrite).rejects.toThrow("ACCESS_CLEARED");
    await store.clear();
    await rejection;
    expect(await storage.all()).toEqual([]);
  });
});
