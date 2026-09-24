import { PrismaClient } from "@prisma/client";
import { readFile, writeFile } from "node:fs/promises";
import { randomBytes, createHash } from "node:crypto";
import path from "node:path";
const root = path.resolve(".runtime/muster"),
  expected = `file:${path.join(root, "muster.sqlite").replaceAll("\\", "/")}`;
if (process.env.DATABASE_URL !== expected) throw new Error("EMBARKATION_OWNED_DATABASE_REQUIRED");
async function prepare() {
  const db = new PrismaClient();
  try {
    const fixture = JSON.parse(await readFile(path.join(root, "fixture.json"), "utf8"));
    // Unclaimed synthetic account exercises canonical identity, not a runtime name override.
    const account = await db.userAccount.upsert({
      where: { id: "embarkation-guest" },
      update: { status: "GUEST_UNCLAIMED" },
      create: {
        id: "embarkation-guest",
        status: "GUEST_UNCLAIMED",
        ordinaryWorkspaceEntryAt: new Date(),
        roles: { create: { role: "PLAYER" } },
        profile: {
          create: {
            id: "embarkation-guest-profile",
            displayName: "Invited Voyager",
            normalizedDisplayName: "invited voyager",
            status: "ACTIVE",
          },
        },
      },
      include: { profile: true },
    });
    const source = await db.taleSession.findUniqueOrThrow({ where: { id: "muster-all-ready" } });
    await db.taleSession.upsert({
      where: { id: "muster-guest" },
      update: {},
      create: {
        id: "muster-guest",
        taleId: source.taleId,
        publishedVersionId: source.publishedVersionId,
        captainAccountId: source.captainAccountId,
        voyageName: "Invitation arrival",
        accessTokenHash: createHash("sha256").update("embarkation-guest-fixture").digest("hex"),
        status: "READY",
      },
    });
    // This membership was created only by the first version of this task's fixture.
    await db.playthroughMembership.deleteMany({
      where: { playthroughId: "muster-all-ready", playerProfileId: "embarkation-guest-profile" },
    });
    for (const key of ["captain", "sera", "northwind"]) {
      const playerProfileId = fixture.profiles[key].profileId;
      await db.playthroughMembership.upsert({
        where: { playthroughId_playerProfileId: { playthroughId: "muster-guest", playerProfileId } },
        update: {},
        create: { playthroughId: "muster-guest", playerProfileId, status: "READY", joinedAt: new Date() },
      });
    }
    await db.playthroughMembership.upsert({
      where: {
        playthroughId_playerProfileId: { playthroughId: "muster-guest", playerProfileId: account.profile!.id },
      },
      update: {},
      create: { playthroughId: "muster-guest", playerProfileId: account.profile!.id, status: "INVITED" },
    });
    const token = randomBytes(32).toString("hex"),
      csrfToken = randomBytes(24).toString("hex");
    await db.accountSession.create({
      data: {
        accountId: account.id,
        tokenHash: createHash("sha256").update(token).digest("hex"),
        csrfToken,
        expiresAt: new Date(Date.now() + 30 * 86400000),
        deviceLabel: "Embarkation isolated guest invitation",
      },
    });
    fixture.profiles.guest = { accountId: account.id, profileId: account.profile!.id, token, csrfToken };
    fixture.origin = "http://127.0.0.1:3138";
    await writeFile(path.join(root, "fixture.json"), JSON.stringify(fixture, null, 2));
    console.log("Embarkation isolated guest prepared; existing fixture state preserved.");
  } finally {
    await db.$disconnect();
  }
}
prepare().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
