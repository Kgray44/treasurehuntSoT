// @sounding-line-registration owner=project-crossdeck suite=unit.crossdeck contracts=crossdeck.phase1.participation
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { crossdeckFixture } from "./test-fixture";
import { CHALLENGE_MS, STALE_MS, actionSchema, projectCapabilities } from "./contracts";
import { createCrossdeckPhase1Packs, crossdeckPhase1Scenarios } from "./lab";
import { runDeviceLabScenario } from "@/device-lab/runner";
import { deviceLabSourceIdentity } from "../../scripts/device-lab/source";
import { loadDeviceLabRegistry } from "@/device-lab/registry";
let f: Awaited<ReturnType<typeof crossdeckFixture>>;
beforeAll(async () => {
  f = await crossdeckFixture();
}, 120_000);
afterAll(async () => {
  await f?.cleanup();
});
const forbidden = /no longer|unavailable|already/;
describe("durable Crossdeck identity and pairing", () => {
  it("pairs separate canonical sessions without creating identity or progression, stores only a hash, and rejects replay", async () => {
    const before = await f.counts();
    const code = await f.challenge();
    const row = await f.db.crossdeckPairingChallenge.findFirstOrThrow();
    expect(row.codeHash).not.toContain(code);
    expect(row.codeHash).toHaveLength(64);
    await f.service.act(f.receiver, f.claim(code));
    const surfaces = await f.service.list(f.actor, f.voyage.id);
    expect(surfaces).toHaveLength(2);
    expect(surfaces.find((s) => s.surfaceId === f.source)?.pairing?.state).toBe("CONNECTED");
    expect(surfaces.map((s) => s.role)).toContain("CHRONICLE_LENS");
    expect(JSON.stringify(surfaces)).not.toMatch(/tokenHash|csrfToken|accountSessionId|codeHash/);
    expect(await f.counts()).toEqual(before);
    await expect(f.service.act(f.receiver, f.claim(code))).rejects.toThrow(forbidden);
  });
  it("rejects wrong account and wrong Voyage without consuming the valid code", async () => {
    const other = await f.db.userAccount.create({ data: { status: "ACTIVE" } });
    const session = await f.db.accountSession.create({
      data: { accountId: other.id, csrfToken: "other", tokenHash: randomUUID(), expiresAt: f.desktop.expiresAt },
    });
    const code = await f.challenge();
    await expect(f.service.act({ accountId: other.id, id: session.id }, f.claim(code))).rejects.toThrow(forbidden);
    await expect(f.service.act(f.receiver, { ...f.claim(code), voyageId: "wrong-voyage" })).rejects.toThrow(forbidden);
    expect((await f.db.crossdeckPairingChallenge.findFirstOrThrow()).consumedAt).toBeNull();
    await f.service.act(f.receiver, f.claim(code));
  });
  it("expires codes, supersedes previous codes, and cannot pair a device with itself", async () => {
    const old = await f.challenge(),
      code = await f.challenge();
    await expect(f.service.act(f.receiver, f.claim(old))).rejects.toThrow(forbidden);
    await expect(f.service.act(f.actor, f.claim(code, f.source))).rejects.toThrow(/other device/);
    f.advance(CHALLENGE_MS + 1);
    await expect(f.service.act(f.receiver, f.claim(code))).rejects.toThrow(forbidden);
    await f.service.act(f.actor, { action: "heartbeat", surfaceId: f.source, lifecycle: "ACTIVE" });
  });
  it("permits exactly one concurrent claim across service instances", async () => {
    const code = await f.challenge();
    const before = await f.db.crossdeckSurfaceSession.count();
    const results = await Promise.allSettled([
      f.service.act(f.receiver, f.claim(code)),
      f.service.act(f.receiver, f.claim(code)),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await f.db.crossdeckSurfaceSession.count()).toBe(before + 1);
  });
  it("prevents a receiving session from impersonating the source heartbeat", async () => {
    await expect(
      f.service.act(f.receiver, { action: "heartbeat", surfaceId: f.source, lifecycle: "ACTIVE" }),
    ).rejects.toThrow(forbidden);
  });
  it("cannot elevate an ordinary player through a role label", async () => {
    await f.db.taleSession.update({ where: { id: f.voyage.id }, data: { captainAccountId: null } });
    await expect(
      f.service.act(f.actor, { action: "role", surfaceId: f.source, role: "CAPTAIN_AUXILIARY" }),
    ).rejects.toThrow(forbidden);
    await expect(
      f.service.act(f.actor, { action: "role", surfaceId: f.source, role: "CREATOR_PREVIEW" }),
    ).rejects.toThrow(/not available/);
    await f.db.taleSession.update({ where: { id: f.voyage.id }, data: { captainAccountId: f.actor.accountId } });
  });
  it("reports background, stale, reconnect and explicit disconnect truthfully", async () => {
    await f.service.act(f.actor, { action: "heartbeat", surfaceId: f.source, lifecycle: "BACKGROUND" });
    expect((await f.service.list(f.actor)).find((s) => s.surfaceId === f.source)?.presence).toBe("BACKGROUND");
    f.advance(STALE_MS);
    expect((await f.service.list(f.actor)).find((s) => s.surfaceId === f.source)?.presence).toBe("DISCONNECTED");
    await f.service.act(f.actor, { action: "heartbeat", surfaceId: f.source, lifecycle: "ACTIVE" });
    expect((await f.service.list(f.actor)).find((s) => s.surfaceId === f.source)?.presence).toBe("ACTIVE");
  });
  it("immediately excludes revoked source/receiving sign-ins and cancels authority for live challenges", async () => {
    const code = await f.challenge();
    await f.db.accountSession.update({ where: { id: f.desktop.id }, data: { revokedAt: f.now() } });
    await expect(f.service.act(f.receiver, f.claim(code))).rejects.toThrow(forbidden);
    expect((await f.service.list(f.receiver)).some((s) => s.surfaceId === f.source)).toBe(false);
    await expect(f.service.list(f.actor)).rejects.toThrow(forbidden);
    await f.db.accountSession.update({ where: { id: f.desktop.id }, data: { revokedAt: null } });
  });
  it("fails closed after membership removal, expiry or account suspension", async () => {
    const code = await f.challenge();
    await f.db.playthroughMembership.update({ where: { id: f.member.id }, data: { removedAt: f.now() } });
    await expect(f.service.act(f.receiver, f.claim(code))).rejects.toThrow(forbidden);
    expect(await f.service.list(f.actor)).toEqual([]);
    await f.db.playthroughMembership.update({ where: { id: f.member.id }, data: { removedAt: null } });
    await f.db.userAccount.update({ where: { id: f.account.id }, data: { suspendedAt: f.now() } });
    await expect(f.service.list(f.actor)).rejects.toThrow(forbidden);
    await f.db.userAccount.update({ where: { id: f.account.id }, data: { suspendedAt: null } });
  });
  it("removal invalidates source challenges and cannot resurrect the old surface", async () => {
    const code = await f.challenge();
    await f.service.act(f.receiver, { action: "remove", surfaceId: f.source });
    await expect(
      f.service.act(f.actor, { action: "heartbeat", surfaceId: f.source, lifecycle: "ACTIVE" }),
    ).rejects.toThrow(forbidden);
    await expect(f.service.act(f.receiver, f.claim(code))).rejects.toThrow(forbidden);
    await expect(
      f.service.act(f.actor, {
        action: "register",
        surfaceId: f.source,
        voyageId: f.voyage.id,
        label: "Again",
        capabilities: f.caps,
      }),
    ).rejects.toThrow(forbidden);
  });
});
describe("capability and input boundaries", () => {
  it("preserves missing hardware providers as unknown and keeps denied permission explicit", () => {
    expect(
      projectCapabilities({ formFactor: "UNKNOWN", viewportClass: "COMPACT", reducedMotion: true }).sextant,
    ).toEqual({});
    const cap = projectCapabilities({ formFactor: "PHONE", viewportClass: "COMPACT", reducedMotion: false }, () => ({
      support: "SUPPORTED",
      availability: "AVAILABLE",
      permission: "DENIED",
      calibration: "UNKNOWN",
      quality: "LOW",
      freshness: "STALE",
      lifecycle: "SUSPENDED",
    }));
    expect(cap.sextant["sextant.media.camera"]?.permission).toBe("DENIED");
    expect(() => actionSchema.parse({ action: "role", surfaceId: randomUUID(), role: "ADMIN" })).toThrow();
    expect(() => actionSchema.parse({ ...f.claim("A".repeat(12)), accountId: "forged" })).toThrow();
  });
});
describe("shared Device Lab D0 execution", () => {
  for (const id of crossdeckPhase1Scenarios)
    it(
      id,
      async () => {
        let owned: Awaited<ReturnType<typeof crossdeckFixture>> | undefined;
        const packs = createCrossdeckPhase1Packs("D0", () => ({
          async execute({ signal }) {
            if (signal.aborted) throw new Error("ABORTED");
            owned = await crossdeckFixture();
            const before = await owned.counts();
            const code = await owned.challenge();
            const claimed = await owned.service.act(owned.receiver, owned.claim(code));
            if (!("surface" in claimed) || !claimed.surface) throw new Error("PAIR_FAILED");
            expect((await owned.service.list(owned.actor)).length).toBe(2);
            if (id === "crossdeck.phone-disconnect") {
              await owned.service.act(owned.receiver, {
                action: "heartbeat",
                surfaceId: claimed.surface.surfaceId,
                lifecycle: "DISCONNECTED",
              });
              expect(
                (await owned.service.list(owned.actor)).find((s) => s.surfaceId === claimed.surface.surfaceId)
                  ?.presence,
              ).toBe("DISCONNECTED");
              await owned.service.act(owned.actor, { action: "remove", surfaceId: claimed.surface.surfaceId });
              expect((await owned.service.list(owned.actor)).length).toBe(1);
            }
            expect(await owned.counts()).toEqual(before);
            return {
              assertions: [
                { id: "crossdeck.phase1.participation", state: "PASS" },
                { id: "presence-removal", state: "PASS" },
              ],
              unsupportedCapabilities: [],
              artifacts: [],
            };
          },
          async cleanup() {
            await owned?.cleanup();
            owned = undefined;
            return { result: "PASS", ownedResources: ["owned-sqlite-fixture"], remainingResources: [] };
          },
        }));
        const source = await deviceLabSourceIdentity(["src/crossdeck"]);
        const receipt = await runDeviceLabScenario(packs, id, {
          source,
          baseSha: source.sourceSha,
          tier: "D0",
          profile: "synthetic",
          hostOs: process.platform,
          runtimeVersion: process.version,
          capabilitySnapshot: loadDeviceLabRegistry().scenarios.find((s) => s.scenarioId === id)!.requiredCapabilities,
        });
        await mkdir("artifacts/crossdeck-device-lab", { recursive: true });
        await writeFile(`artifacts/crossdeck-device-lab/${id}-D0.json`, JSON.stringify(receipt, null, 2));
        expect(receipt.passFailDisposition, JSON.stringify(receipt)).toBe("PASS");
        expect(receipt.evidenceClass).toBe("PROVIDER_SIMULATION_PROVEN");
        expect(receipt.cleanupReceipt.remainingResources).toEqual([]);
      },
      120_000,
    );
});
