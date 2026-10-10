import { PrismaClient } from "@prisma/client";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createCrossdeckService } from "./service";
import { projectCapabilities } from "./contracts";
export async function crossdeckFixture() {
  const directory = await mkdtemp(join(tmpdir(), "crossdeck-phase1-"));
  const url = `file:${join(directory, "fixture.db")}`;
  try {
    execFileSync(
      process.execPath,
      [
        resolve("node_modules/prisma/build/index.js"),
        "db",
        "push",
        "--schema",
        "prisma/schema.sqlite.prisma",
        "--skip-generate",
      ],
      { env: { ...process.env, DATABASE_URL: url }, stdio: "pipe", timeout: 90_000 },
    );
  } catch (cause) {
    await rm(directory, { recursive: true, force: true });
    throw cause;
  }
  const db = new PrismaClient({ datasourceUrl: url });
  let time = new Date("2026-10-10T12:00:00Z");
  const expiresAt = new Date("2026-10-12T12:00:00Z");
  const account = await db.userAccount.create({
    data: { status: "ACTIVE", profile: { create: { displayName: "Synthetic navigator" } } },
    include: { profile: true },
  });
  const desktop = await db.accountSession.create({
    data: { accountId: account.id, csrfToken: randomUUID(), tokenHash: randomUUID(), expiresAt },
  });
  const phone = await db.accountSession.create({
    data: { accountId: account.id, csrfToken: randomUUID(), tokenHash: randomUUID(), expiresAt },
  });
  const tale = await db.chronicle.create({
    data: {
      slug: randomUUID(),
      title: "Crossdeck synthetic Voyage",
      creatorId: account.profile!.id,
      creatorAccountId: account.id,
    },
  });
  const voyage = await db.taleSession.create({
    data: { taleId: tale.id, accessTokenHash: randomUUID(), captainAccountId: account.id },
  });
  const member = await db.playthroughMembership.create({
    data: { playthroughId: voyage.id, playerProfileId: account.profile!.id, status: "ACTIVE_MEMBER" },
  });
  const source = randomUUID();
  const caps = projectCapabilities({ formFactor: "DESKTOP", viewportClass: "WIDE", reducedMotion: false });
  const service = createCrossdeckService(db, () => time);
  const actor = { id: desktop.id, accountId: account.id };
  const receiver = { id: phone.id, accountId: account.id };
  await service.act(actor, {
    action: "register",
    surfaceId: source,
    voyageId: voyage.id,
    label: "Desktop",
    capabilities: caps,
  });
  const challenge = async () => {
    const result = await service.act(actor, { action: "challenge", surfaceId: source, role: "CHRONICLE_LENS" });
    if (!("code" in result) || !result.code) throw new Error("CROSSDECK_TEST_CHALLENGE_MISSING");
    return result.code;
  };
  const claim = (code: string, surfaceId = randomUUID()) => ({
    action: "claim" as const,
    code,
    surfaceId,
    label: "Phone",
    capabilities: caps,
  });
  const counts = async () => ({
    players: await db.playerProfile.count(),
    members: await db.playthroughMembership.count(),
    events: await db.taleSessionEvent.count(),
    sequence: (await db.taleSession.findUniqueOrThrow({ where: { id: voyage.id } })).currentSequence,
  });
  return {
    db,
    service,
    actor,
    receiver,
    account,
    desktop,
    phone,
    member,
    voyage,
    source,
    caps,
    challenge,
    claim,
    counts,
    advance: (ms: number) => {
      time = new Date(time.getTime() + ms);
    },
    now: () => time,
    cleanup: async () => {
      await db.$disconnect();
      await rm(directory, { recursive: true, force: true });
    },
  };
}
