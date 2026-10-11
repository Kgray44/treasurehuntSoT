// @sounding-line-registration owner=project-crossdeck suite=unit.crossdeck contracts=crossdeck.phase2.continuity
import { beforeAll, afterAll, beforeEach, describe, it, expect, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { crossdeckFixture } from "./test-fixture";
import { createCommittedChangeBus } from "./notifications";
import { createCrossdeckRealtimeServer, STREAM_AUTHORIZATION_MS, REVISION_OBSERVATION_MS } from "./realtime-server";
import { createCrossdeckSyncService } from "./sync-service";

let f: Awaited<ReturnType<typeof crossdeckFixture>>;
let target: string;
beforeAll(async () => {
  f = await crossdeckFixture();
  const paired = await f.service.act(f.receiver, f.claim(await f.challenge()));
  if (!("surface" in paired) || !paired.surface) throw new Error("TARGET_MISSING");
  target = paired.surface.surfaceId;
}, 120000);
beforeEach(async () => {
  await f.db.accountSession.updateMany({ data: { revokedAt: null } });
  await f.db.crossdeckSurfaceSession.updateMany({ data: { revokedAt: null } });
  await f.db.crossdeckSurfaceSession.updateMany({ where: { surfaceId: target }, data: { role: "CHRONICLE_LENS" } });
  await f.db.playthroughMembership.updateMany({ data: { removedAt: null, status: "ACTIVE_MEMBER" } });
  await f.db.crossdeckDeck.deleteMany();
});
afterAll(async () => f?.cleanup());
const decode = (value?: Uint8Array) => new TextDecoder().decode(value);
async function setup() {
  const bus = createCommittedChangeBus();
  const server = createCrossdeckRealtimeServer(f.db, bus, f.now);
  const sync = createCrossdeckSyncService(f.db, f.now, undefined, (change) => bus.publish(change));
  await sync.read(f.actor, f.voyage.id, f.source);
  const abort = new AbortController();
  const reader = (await server.connect(f.receiver, f.voyage.id, target, abort.signal)).getReader();
  expect(decode((await reader.read()).value)).toContain('"revision":0');
  return { bus, server, sync, abort, reader };
}
async function focus(sync: ReturnType<typeof createCrossdeckSyncService>) {
  const snapshot = await sync.read(f.actor, f.voyage.id, f.source);
  return sync.command(f.actor, {
    messageId: randomUUID(),
    surfaceId: f.source,
    voyageId: f.voyage.id,
    sequence: snapshot.nextSequence,
    payloadSchemaVersion: 1,
    payload: { action: "focus", family: "MAP", targetId: target },
  });
}
describe("authorized committed revision streams", () => {
  it("notifies only after commit and never mutates progression", async () => {
    const s = await setup();
    const before = await f.counts();
    const received = s.reader.read();
    const result = await focus(s.sync);
    const event = decode((await received).value);
    expect(event).toContain(`"revision":${result.revision}`);
    expect((await f.db.crossdeckDeck.findFirstOrThrow()).revision).toBe(result.revision);
    expect(event).not.toContain(f.account.id);
    expect(event).not.toContain(f.member.id);
    expect(await f.counts()).toEqual(before);
    s.abort.abort();
    expect((await s.reader.read()).done).toBe(true);
    expect(s.server.connectionCount).toBe(0);
    expect(s.server.scopeCount).toBe(0);
    expect(s.bus.scopeCount).toBe(0);
  });
  it("publishes an observable committed revision, treats notifier failure as a hint failure and rolls back before publishing", async () => {
    const observations: Promise<number>[] = [];
    const notify = vi.fn(() => {
      observations.push(f.db.crossdeckDeck.findFirstOrThrow().then((row) => row.revision));
      throw new Error("synthetic notification outage");
    });
    const sync = createCrossdeckSyncService(f.db, f.now, undefined, notify);
    const committed = await focus(sync);
    expect(await Promise.all(observations)).toContain(committed.revision);
    notify.mockClear();
    const originalTransaction = f.db.$transaction.bind(f.db);
    const rollback = vi.spyOn(f.db, "$transaction").mockImplementationOnce((work: unknown) =>
      originalTransaction(async (tx) => {
        await (work as (txArg: typeof tx) => Promise<unknown>)(tx);
        throw new Error("synthetic post-write rollback");
      }),
    );
    await expect(
      sync.command(f.actor, {
        messageId: randomUUID(),
        surfaceId: f.source,
        voyageId: f.voyage.id,
        sequence: committed.nextSequence,
        payloadSchemaVersion: 1,
        payload: { action: "focus", family: "MAP", targetId: f.source },
      }),
    ).rejects.toThrow("synthetic post-write rollback");
    rollback.mockRestore();
    expect(notify).not.toHaveBeenCalled();
    expect((await f.db.crossdeckDeck.findFirstOrThrow()).revision).toBe(committed.revision);
  });
  it("emits no committed-change notification when a transaction fails or rolls back", async () => {
    const bus = createCommittedChangeBus();
    const changes = vi.fn();
    const stop = bus.subscribe(f.actor.accountId, f.voyage.id, changes);
    const sync = createCrossdeckSyncService(f.db, f.now, undefined, (c) => bus.publish(c));
    const transaction = vi.spyOn(f.db, "$transaction").mockRejectedValueOnce(new Error("synthetic rollback"));
    await expect(focus(sync)).rejects.toThrow("synthetic rollback");
    expect(changes).not.toHaveBeenCalled();
    transaction.mockRestore();
    await expect(
      sync.command(f.actor, {
        messageId: randomUUID(),
        surfaceId: f.source,
        voyageId: f.voyage.id,
        sequence: 99,
        payloadSchemaVersion: 1,
        payload: { action: "focus", family: "MAP", targetId: target },
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(changes).not.toHaveBeenCalled();
    expect(await f.db.crossdeckDeck.count()).toBe(0);
    stop();
  });
  it("recovers another process's committed change through one shared durable cursor without a local event", async () => {
    const s = await setup();
    const received = s.reader.read();
    const independentProcess = createCrossdeckSyncService(f.db, f.now, undefined, () => {});
    const result = await focus(independentProcess);
    const event = decode((await received).value);
    expect(event).toContain(`"revision":${result.revision}`);
    s.abort.abort();
  });
  for (const kind of ["session", "pairing", "membership"] as const)
    it(`ends a live stream after ${kind} revocation and rejects protected state`, async () => {
      const s = await setup();
      if (kind === "session")
        await f.db.accountSession.update({ where: { id: f.receiver.id }, data: { revokedAt: f.now() } });
      if (kind === "pairing")
        await f.db.crossdeckSurfaceSession.updateMany({ where: { surfaceId: target }, data: { revokedAt: f.now() } });
      if (kind === "membership")
        await f.db.playthroughMembership.update({ where: { id: f.member.id }, data: { removedAt: f.now() } });
      const started = Date.now();
      const event = decode((await s.reader.read()).value);
      expect(Date.now() - started).toBeLessThan(STREAM_AUTHORIZATION_MS + 1000);
      expect(event).toContain("crossdeck-ended");
      expect((await s.reader.read()).done).toBe(true);
      await expect(s.sync.read(f.receiver, f.voyage.id, target)).rejects.toMatchObject({ status: 403 });
      expect(s.server.connectionCount).toBe(0);
      expect(s.server.scopeCount).toBe(0);
    }, 15000);
  it("denies unauthorized accounts, session/surface mismatches and cross-Voyage subscriptions", async () => {
    const server = createCrossdeckRealtimeServer(f.db, createCommittedChangeBus(), f.now);
    const signal = new AbortController().signal;
    await expect(
      server.connect({ ...f.actor, accountId: "another-account" }, f.voyage.id, f.source, signal),
    ).rejects.toMatchObject({ status: 403 });
    await expect(server.connect(f.actor, f.voyage.id, target, signal)).rejects.toMatchObject({ status: 403 });
    await expect(server.connect(f.actor, "another-voyage", f.source, signal)).rejects.toMatchObject({ status: 403 });
    expect(server.connectionCount).toBe(0);
  });
  it("ends a stream when its role changes before the next content fetch", async () => {
    const s = await setup();
    await f.db.crossdeckSurfaceSession.updateMany({
      where: { surfaceId: target },
      data: { role: "SHARED_CREW_DISPLAY" },
    });
    expect(decode((await s.reader.read()).value)).toContain("crossdeck-ended");
    expect((await s.reader.read()).done).toBe(true);
    expect(s.server.connectionCount).toBe(0);
  }, 15000);
  it("restarts with current durable revision and bounds duplicate connections", async () => {
    const s = await setup();
    const result = await focus(s.sync);
    await s.reader.read();
    s.abort.abort();
    const restarted = createCrossdeckRealtimeServer(f.db, createCommittedChangeBus(), f.now);
    const first = (await restarted.connect(f.receiver, f.voyage.id, target, new AbortController().signal)).getReader();
    expect(decode((await first.read()).value)).toContain(`"revision":${result.revision}`);
    const second = (await restarted.connect(f.receiver, f.voyage.id, target, new AbortController().signal)).getReader();
    await second.read();
    await expect(
      restarted.connect(f.receiver, f.voyage.id, target, new AbortController().signal),
    ).rejects.toMatchObject({ status: 429 });
    await first.cancel();
    await second.cancel();
    expect(restarted.connectionCount).toBe(0);
    expect(restarted.scopeCount).toBe(0);
    expect(REVISION_OBSERVATION_MS).toBe(1000);
  });
});
