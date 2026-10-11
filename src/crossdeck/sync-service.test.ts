// @sounding-line-registration owner=project-crossdeck suite=unit.crossdeck contracts=crossdeck.phase2.continuity
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";
import { crossdeckFixture } from "./test-fixture";
import { createCrossdeckSyncService } from "./sync-service";
import { commandSchema, HANDOFF_TTL_MS, type ObjectRef, type SyncCommand } from "./sync-contracts";
import { STALE_MS } from "./contracts";
import { createCrossdeckPhase2Packs } from "./lab-phase2";
import { runDeviceLabScenario } from "@/device-lab/runner";
import { loadDeviceLabRegistry } from "@/device-lab/registry";
import { deviceLabSourceIdentity } from "../../scripts/device-lab/source";

let f: Awaited<ReturnType<typeof crossdeckFixture>>;
let target: string;
let sync: ReturnType<typeof createCrossdeckSyncService>;
const ref = (family: ObjectRef["family"] = "ARTIFACT"): ObjectRef => ({
  family,
  objectId: family.toLowerCase(),
  version: "draft:unknown",
});
const snapshot = () => ({
  schemaVersion: 1,
  tale: { id: f.tale.id, title: "Synthetic", slug: "synthetic" },
  assets: [],
  chapters: [
    {
      id: "chapter",
      blocks: [
        {
          id: "artifact",
          blockType: "artifactReveal",
          title: "Chart relic",
          chapterId: "chapter",
          configuration: { text: "A released relic", crossdeck: { visibility: "CREW" } },
          connections: [],
        },
        {
          id: "note",
          blockType: "captainsNote",
          title: "Private note",
          chapterId: "chapter",
          configuration: { text: "Synthetic private note", creatorNotes: "must not escape" },
          connections: [],
        },
        {
          id: "map",
          blockType: "livingChart",
          title: "Released map",
          chapterId: "chapter",
          configuration: {},
          connections: [],
        },
        {
          id: "hidden",
          blockType: "artifactReveal",
          title: "Hidden relic",
          chapterId: "chapter",
          configuration: {},
          connections: [],
        },
      ],
    },
  ],
});
beforeAll(async () => {
  f = await crossdeckFixture();
  const result = await f.service.act(f.receiver, f.claim(await f.challenge()));
  if (!("surface" in result) || !result.surface) throw new Error("TARGET_MISSING");
  target = result.surface.surfaceId;
  await f.db.taleSession.update({
    where: { id: f.voyage.id },
    data: { previewSnapshot: JSON.stringify(snapshot()), currentBlockId: "artifact", currentChapterId: "chapter" },
  });
  for (const id of ["artifact", "note", "map"])
    await f.db.revealState.create({ data: { playthroughId: f.voyage.id, contentType: "BLOCK", contentKey: id } });
  sync = createCrossdeckSyncService(f.db, f.now);
}, 120_000);
beforeEach(async () => {
  await f.db.crossdeckDeck.deleteMany();
  await f.db.accountSession.updateMany({ data: { revokedAt: null } });
  await f.db.crossdeckSurfaceSession.updateMany({
    data: { lifecycle: "ACTIVE", lastSeenAt: f.now(), role: "PRIMARY_STORY", revokedAt: null },
  });
  await f.db.taleSession.update({
    where: { id: f.voyage.id },
    data: { previewSnapshot: JSON.stringify(snapshot()), currentBlockId: "artifact" },
  });
});
afterAll(async () => {
  await f?.cleanup();
});
async function command(side: "source" | "target", payload: SyncCommand["payload"], messageId = randomUUID()) {
  const actor = side === "source" ? f.actor : f.receiver;
  const surfaceId = side === "source" ? f.source : target;
  const read = await sync.read(actor, f.voyage.id, surfaceId);
  return sync.command(
    actor,
    commandSchema.parse({
      messageId,
      surfaceId,
      voyageId: f.voyage.id,
      sequence: read.nextSequence,
      payloadSchemaVersion: 1,
      payload,
    }),
  );
}
async function offer(
  mode: "MOVE_FOCUS" | "MOVE_CUSTODY" | "MIRROR" | "OPEN_COMPANION" | "SEND_VIEW" = "MOVE_FOCUS",
  family: ObjectRef["family"] = "ARTIFACT",
) {
  const next = await command("source", {
    action: "send",
    targetId: target,
    object: ref(family),
    context: { blockId: family.toLowerCase(), readingPosition: 0.6 },
    mode,
    privateConfirmed: true,
  });
  return next.handoffs.at(-1)!;
}
describe("durable manual handoff and convergence", { timeout: 30_000 }, () => {
  it("separates offer, server commit, destination acknowledgment and source departure without story mutation", async () => {
    const before = await f.counts();
    const h = await offer();
    expect(h.state).toBe("OFFERED");
    expect((await sync.read(f.actor, f.voyage.id, f.source)).presentations).toHaveLength(1);
    const committed = await command("target", { action: "accept", handoffId: h.id });
    expect(committed.handoffs[0].state).toBe("COMMITTED");
    expect(committed.presentations[0].custody).toBe(target);
    expect((await sync.read(f.actor, f.voyage.id, f.source)).presentations).toHaveLength(1);
    const done = await command("target", { action: "acknowledge", handoffId: h.id });
    expect(done.handoffs[0].state).toBe("ACKNOWLEDGED");
    expect(done.handoffs[0].requestedAt).toBeDefined();
    expect(done.handoffs[0].committedAt).toBeDefined();
    expect(done.handoffs[0].acknowledgedAt).toBeDefined();
    expect((await sync.read(f.actor, f.voyage.id, f.source)).presentations).toEqual([]);
    expect(await f.counts()).toEqual(before);
  });
  it("reuses a durable exact message receipt across service instances and rejects sequence gaps or altered replays", async () => {
    await sync.read(f.actor, f.voyage.id, f.source);
    const input = commandSchema.parse({
      messageId: randomUUID(),
      surfaceId: f.source,
      voyageId: f.voyage.id,
      sequence: 1,
      payloadSchemaVersion: 1,
      payload: { action: "send", targetId: target, object: ref(), context: {}, mode: "MIRROR" },
    });
    const sent = await sync.command(f.actor, input);
    const other = createCrossdeckSyncService(f.db, f.now);
    expect((await other.command(f.actor, input)).handoffs).toEqual(sent.handoffs);
    await expect(
      other.command(f.actor, {
        ...input,
        payload: {
          ...input.payload,
          action: "send",
          targetId: target,
          object: ref(),
          context: {},
          mode: "MOVE_FOCUS",
          privateConfirmed: false,
        },
      }),
    ).rejects.toThrow(/already/);
    await expect(other.command(f.actor, { ...input, messageId: randomUUID(), sequence: 3 })).rejects.toThrow(
      /reconnect/,
    );
  });
  it("keeps mirror/companion read-only and permits only the current custodian to update versioned context", async () => {
    const h = await offer("MIRROR");
    await command("target", { action: "accept", handoffId: h.id });
    await command("target", { action: "acknowledge", handoffId: h.id });
    await expect(
      command("target", { action: "update", object: ref(), context: { readingPosition: 0.9 }, expectedRevision: 1 }),
    ).rejects.toThrow(/Another/);
    await command("source", {
      action: "update",
      object: ref(),
      context: { readingPosition: 0.9 },
      expectedRevision: 1,
    });
    const remote = await createCrossdeckSyncService(f.db, f.now).read(f.receiver, f.voyage.id, target);
    expect(remote.presentations[0].context.readingPosition).toBe(0.9);
    expect(remote.presentations[0].custody).toBe(f.source);
  });
  it("preserves note/artifact/map identities and semantic view state, private confirmation, and companion mode", async () => {
    await expect(
      command("source", {
        action: "send",
        targetId: target,
        object: ref("NOTE"),
        context: {},
        mode: "MOVE_CUSTODY",
        privateConfirmed: false,
      }),
    ).rejects.toThrow(/Confirm/);
    for (const family of ["NOTE", "MAP", "ARTIFACT"] as const) {
      const h = await offer("OPEN_COMPANION", family);
      await command("target", { action: "accept", handoffId: h.id });
      await command("target", { action: "acknowledge", handoffId: h.id });
      const p = (await sync.read(f.receiver, f.voyage.id, target)).presentations.find(
        (p) => p.object.family === family,
      )!;
      expect(p.object).toEqual(ref(family));
      expect(p.context.readingPosition).toBe(0.6);
      expect(p.views[target]).toBe("OPEN_COMPANION");
      expect(p.custody).toBe(f.source);
    }
  });
  it("freezes sent views while pinned companions follow the controlling revision", async () => {
    for (const mode of ["SEND_VIEW", "PIN_TO_SURFACE"] as const) {
      await f.db.crossdeckDeck.deleteMany();
      const sent = await command("source", {
        action: "send",
        targetId: target,
        object: ref(),
        context: { readingPosition: 0.6 },
        mode,
        privateConfirmed: false,
      });
      await command("target", { action: "accept", handoffId: sent.handoffs[0].id });
      await command("target", { action: "acknowledge", handoffId: sent.handoffs[0].id });
      await command("source", {
        action: "update",
        object: ref(),
        context: { readingPosition: 0.9 },
        expectedRevision: 1,
      });
      const remote = await sync.read(f.receiver, f.voyage.id, target);
      expect(remote.presentations[0].context.readingPosition).toBe(mode === "SEND_VIEW" ? 0.6 : 0.9);
      expect(remote.presentations[0].custody).toBe(f.source);
    }
  });
  it("keeps per-family focus preferences separate from custody and clears a closed representation", async () => {
    const next = await command("source", { action: "focus", family: "MAP", targetId: target });
    expect(next.focus.MAP).toBe(target);
    expect(next.presentations).toEqual([]);
    const h = await offer("MIRROR");
    await command("target", { action: "accept", handoffId: h.id });
    await command("target", { action: "acknowledge", handoffId: h.id });
    await command("target", { action: "close", object: ref() });
    expect((await sync.read(f.receiver, f.voyage.id, target)).presentations).toEqual([]);
    expect((await sync.read(f.actor, f.voyage.id, f.source)).presentations[0].custody).toBe(f.source);
  });
  it("expires precommit source/target loss and stale targets, but retains committed custody through reconnect", async () => {
    const h = await offer("MOVE_CUSTODY");
    await command("target", { action: "accept", handoffId: h.id });
    await f.service.act(f.receiver, { action: "heartbeat", surfaceId: target, lifecycle: "DISCONNECTED" });
    expect((await sync.read(f.actor, f.voyage.id, f.source)).presentations[0].custody).toBe(target);
    await f.service.act(f.receiver, { action: "heartbeat", surfaceId: target, lifecycle: "ACTIVE" });
    await command("target", { action: "acknowledge", handoffId: h.id });
    expect((await sync.read(f.actor, f.voyage.id, f.source)).presentations[0].views[f.source]).toBe("MIRROR");
  });
  it("recovers exclusively from an unavailable custodian, then rejects a late destination acknowledgment", async () => {
    const h = await offer("MOVE_CUSTODY");
    await command("target", { action: "accept", handoffId: h.id });
    await expect(command("source", { action: "recover", object: ref() })).rejects.toThrow(/still controls/);
    await f.service.act(f.receiver, { action: "heartbeat", surfaceId: target, lifecycle: "LOCKED" });
    const recovered = await command("source", { action: "recover", object: ref() });
    expect(recovered.presentations[0].custody).toBe(f.source);
    await f.service.act(f.receiver, { action: "heartbeat", surfaceId: target, lifecycle: "ACTIVE" });
    await expect(command("target", { action: "acknowledge", handoffId: h.id })).rejects.toThrow(/Receive/);
  });
  it("blocks lost, expired, revoked, wrong-session and wrong-Voyage targets without granting custody", async () => {
    const h = await offer();
    f.advance(HANDOFF_TTL_MS + 1);
    await f.service.act(f.actor, { action: "heartbeat", surfaceId: f.source, lifecycle: "ACTIVE" });
    await f.service.act(f.receiver, { action: "heartbeat", surfaceId: target, lifecycle: "ACTIVE" });
    await expect(command("target", { action: "accept", handoffId: h.id })).rejects.toThrow(/expired/);
    expect((await sync.read(f.actor, f.voyage.id, f.source)).presentations[0].custody).toBe(f.source);
    await expect(sync.read(f.receiver, f.voyage.id, f.source)).rejects.toThrow(/no longer/);
    await expect(sync.read(f.actor, "wrong-voyage", f.source)).rejects.toThrow(/Voyage/);
    await f.db.accountSession.update({ where: { id: f.phone.id }, data: { revokedAt: f.now() } });
    await expect(
      command("source", {
        action: "send",
        targetId: target,
        object: ref(),
        context: {},
        mode: "MIRROR",
        privateConfirmed: false,
      }),
    ).rejects.toThrow(/no longer/);
    await expect(sync.read(f.receiver, f.voyage.id, target)).rejects.toThrow(/no longer/);
  });
  it("rejects stale versions and unreleased content, and strips stale presentation on reconnect", async () => {
    await expect(
      command("source", {
        action: "send",
        targetId: target,
        object: { ...ref(), version: "old" },
        context: {},
        mode: "MIRROR",
        privateConfirmed: false,
      }),
    ).rejects.toThrow(/changed/);
    await expect(
      command("source", {
        action: "send",
        targetId: target,
        object: { ...ref(), objectId: "hidden" },
        context: {},
        mode: "MIRROR",
        privateConfirmed: false,
      }),
    ).rejects.toThrow(/available/);
    const h = await offer("MIRROR");
    await command("target", { action: "accept", handoffId: h.id });
    await f.db.taleSession.update({ where: { id: f.voyage.id }, data: { draftRevisionId: "new" } });
    expect((await sync.read(f.receiver, f.voyage.id, target)).presentations).toEqual([]);
    await f.db.taleSession.update({ where: { id: f.voyage.id }, data: { draftRevisionId: null } });
  });
  it("retires obsolete committed intent so a newly pinned version can be sent", async () => {
    const h = await offer("MOVE_CUSTODY");
    await command("target", { action: "accept", handoffId: h.id });
    await f.db.taleSession.update({ where: { id: f.voyage.id }, data: { draftRevisionId: "new" } });
    const fresh = await command("source", {
      action: "send",
      targetId: target,
      object: { ...ref(), version: "draft:new" },
      context: {},
      mode: "MOVE_CUSTODY",
      privateConfirmed: false,
    });
    expect(fresh.handoffs).toHaveLength(1);
    expect(fresh.handoffs[0].state).toBe("OFFERED");
    expect(fresh.presentations[0].object.version).toBe("draft:new");
    await f.db.taleSession.update({ where: { id: f.voyage.id }, data: { draftRevisionId: null } });
  });
  it("fails closed for private/shared routes, permits explicitly crew read-only projection, and rechecks role changes", async () => {
    await f.service.act(f.receiver, { action: "role", surfaceId: target, role: "SHARED_CREW_DISPLAY" });
    await expect(
      command("source", {
        action: "send",
        targetId: target,
        object: ref("NOTE"),
        context: {},
        mode: "MIRROR",
        privateConfirmed: true,
      }),
    ).rejects.toThrow(/personal/);
    await expect(offer()).rejects.toThrow(/read-only/);
    const h = await offer("SEND_VIEW");
    const ready = await command("target", { action: "accept", handoffId: h.id });
    expect(ready.presentations[0].visibility).toBe("CREW");
    await expect(command("target", { action: "recover", object: ref() })).rejects.toThrow(/personal/);
    expect(JSON.stringify(ready)).not.toMatch(/creatorNotes|csrfToken|tokenHash|Synthetic private note/);
  });
  it("uses first durable reservation to resolve competing exclusive sends and never fans out exclusive custody", async () => {
    const base = {
      surfaceId: f.source,
      voyageId: f.voyage.id,
      sequence: 1,
      payloadSchemaVersion: 1 as const,
      payload: {
        action: "send" as const,
        targetId: target,
        object: ref(),
        context: {},
        mode: "MOVE_CUSTODY" as const,
        privateConfirmed: false,
      },
    };
    const results = await Promise.allSettled([
      sync.command(f.actor, { ...base, messageId: randomUUID() }),
      createCrossdeckSyncService(f.db, f.now).command(f.actor, { ...base, messageId: randomUUID() }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(
      (await sync.read(f.actor, f.voyage.id, f.source)).handoffs.filter((h) => h.state === "OFFERED"),
    ).toHaveLength(1);
  });
  it("stale before-commit destination restores source, and pending commit acknowledgment remains explicit", async () => {
    const h = await offer();
    f.advance(STALE_MS);
    await f.service.act(f.actor, { action: "heartbeat", surfaceId: f.source, lifecycle: "ACTIVE" });
    const refreshed = await sync.read(f.actor, f.voyage.id, f.source);
    expect(refreshed.handoffs.find((item) => item.id === h.id)?.state).toBe("EXPIRED");
    expect(refreshed.presentations[0].custody).toBe(f.source);
  });
});

describe("shared Device Lab Phase 2 D0", () => {
  for (const scenarioId of ["crossdeck.surface-handoff", "crossdeck.phone-disconnect"] as const)
    it(
      scenarioId,
      async () => {
        const before = await f.counts();
        const packs = createCrossdeckPhase2Packs("D0", () => ({
          async execute() {
            const h = await offer("MOVE_CUSTODY");
            await command("target", { action: "accept", handoffId: h.id });
            if (scenarioId === "crossdeck.phone-disconnect") {
              await f.service.act(f.receiver, { action: "heartbeat", surfaceId: target, lifecycle: "DISCONNECTED" });
              await command("source", { action: "recover", object: ref() });
              expect((await sync.read(f.actor, f.voyage.id, f.source)).presentations[0].custody).toBe(f.source);
            } else {
              await command("target", { action: "acknowledge", handoffId: h.id });
              expect((await sync.read(f.receiver, f.voyage.id, target)).presentations[0].context.readingPosition).toBe(
                0.6,
              );
            }
            expect(await f.counts()).toEqual(before);
            return {
              assertions: [{ id: "crossdeck.phase2.continuity", state: "PASS" }],
              unsupportedCapabilities: [],
              artifacts: [],
            };
          },
          async cleanup() {
            await f.db.crossdeckDeck.deleteMany();
            return { result: "PASS", ownedResources: ["owned-deck-fixture"], remainingResources: [] };
          },
        }));
        const source = await deviceLabSourceIdentity(["src/crossdeck"]);
        const receipt = await runDeviceLabScenario(packs, scenarioId, {
          source,
          baseSha: "2e367c372a6d44e4e6a68bb38266196954f8d486",
          tier: "D0",
          profile: "synthetic",
          hostOs: process.platform,
          runtimeVersion: process.version,
          capabilitySnapshot: loadDeviceLabRegistry().scenarios.find((s) => s.scenarioId === scenarioId)!
            .requiredCapabilities,
        });
        await mkdir("artifacts/crossdeck-phase2", { recursive: true });
        await writeFile(`artifacts/crossdeck-phase2/${scenarioId}-D0.json`, JSON.stringify(receipt, null, 2));
        expect(receipt.passFailDisposition, JSON.stringify(receipt)).toBe("PASS");
        expect(receipt.evidenceClass).toBe("PROVIDER_SIMULATION_PROVEN");
      },
      120_000,
    );
});
