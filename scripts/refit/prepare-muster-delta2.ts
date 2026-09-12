import { PrismaClient } from "@prisma/client";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

async function main() {
  const taskRoot = path.resolve(".runtime/muster");
  if (process.env.DATABASE_URL !== `file:${path.join(taskRoot, "muster.sqlite").replaceAll("\\", "/")}`)
    throw new Error("MUSTER_TASK_DATABASE_REQUIRED");
  const db = new PrismaClient();
  const digest = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
  const output = path.join(taskRoot, "delta2");
  await mkdir(output, { recursive: true });
  const fixturePath = path.join(taskRoot, "fixture.json");
  const fixture = JSON.parse(await readFile(fixturePath, "utf8"));
  const captain = fixture.profiles.captain;

  // Include every existing owner-review Voyage, not just the original five. Presence is ephemeral.
  async function retainedState(ids?: string[]) {
    const voyages = await db.taleSession.findMany({
      where: { id: ids ? { in: ids } : { startsWith: "muster-" } },
      orderBy: { id: "asc" },
      include: {
        memberships: { orderBy: { id: "asc" } },
        invitations: { orderBy: { id: "asc" } },
        musterMessages: { orderBy: { id: "asc" } },
        version: true,
      },
    });
    return voyages.map((voyage) => ({
      id: voyage.id,
      hash: digest(JSON.stringify(voyage)),
      messages: voyage.musterMessages.length,
      memberships: voyage.memberships.length,
    }));
  }
  const before = (await retainedState()).filter(
    (row) => fixture.voyages["tidal-observatory"] || row.id !== "muster-tidal-observatory",
  );
  await writeFile(path.join(output, "fixture-before.json"), JSON.stringify(before, null, 2));
  try {
    const taleId = "muster-delta2-observatory";
    const exists = await db.chronicle.findUnique({ where: { id: taleId } });
    if (!exists) {
      await db.chronicle.create({
        data: {
          id: taleId,
          slug: taleId,
          title: "Unpublished observatory revision",
          subtitle: "Newer draft subtitle",
          shortDescription: "Newer draft overview",
          estimatedDuration: 5,
          creatorId: captain.accountId,
          creatorAccountId: captain.accountId,
          status: "PUBLISHED",
          visibility: "PUBLIC",
        },
      });
      async function cover(name: string, file: string, width: number, height: number) {
        const bytes = await readFile(path.join("public/images/muster", file));
        const storageFolder = randomUUID();
        const storageFile = `${randomUUID()}.png`;
        const folder = path.join(taskRoot, "chronicle-assets", storageFolder);
        await mkdir(folder, { recursive: true });
        await writeFile(path.join(folder, storageFile), bytes, { flag: "wx" });
        return db.taleAsset.create({
          data: {
            id: `${taleId}-${name}`,
            taleId,
            mediaType: "IMAGE",
            displayName: name,
            originalFilename: file,
            mimeType: "image/png",
            fileSize: bytes.length,
            width,
            height,
            checksum: digest(bytes),
            createdBy: captain.accountId,
            createdByAccountId: captain.accountId,
            variants: {
              create: {
                role: "PREVIEW",
                storageKey: `${storageFolder}/${storageFile}`,
                mimeType: "image/png",
                fileSize: bytes.length,
                width,
                height,
                checksum: digest(bytes),
              },
            },
          },
          include: { variants: true },
        });
      }
      const publishedCover = await cover("published-cover", "lantern-room.png", 1536, 1024);
      const draftCover = await cover("draft-cover", "moonlit-island.png", 1672, 941);
      const original = await db.publishedTaleVersion.findUniqueOrThrow({
        where: { id: "muster-forever-treasure-edition" },
      });
      const snapshot = JSON.parse(original.contentSnapshot);
      Object.assign(snapshot.tale, {
        id: taleId,
        slug: taleId,
        title: "The Tidal Observatory",
        subtitle: "Follow the stars beyond the harbor.",
        shortDescription:
          "Decode forgotten signals at the old observatory and chart a course beneath the evening stars.",
        estimatedDuration: 95,
        coverAssetId: publishedCover.id,
      });
      snapshot.assets = [
        {
          id: publishedCover.id,
          mediaType: "IMAGE",
          displayName: publishedCover.displayName,
          description: null,
          mimeType: publishedCover.mimeType,
          width: publishedCover.width,
          height: publishedCover.height,
          roles: ["COVER"],
          variants: publishedCover.variants.map((variant) => ({
            id: variant.id,
            role: variant.role,
            mimeType: variant.mimeType,
            processingState: variant.processingState,
          })),
        },
      ];
      const contentSnapshot = JSON.stringify(snapshot);
      const version = await db.publishedTaleVersion.create({
        data: {
          id: `${taleId}-edition`,
          taleId,
          versionNumber: 2,
          versionLabel: "2.3",
          publishedBy: captain.accountId,
          publishedByAccountId: captain.accountId,
          contentSnapshot,
          checksum: digest(contentSnapshot),
          isCurrent: true,
        },
      });
      await db.chronicle.update({
        where: { id: taleId },
        data: { latestPublishedVersionId: version.id, coverAssetId: draftCover.id },
      });
    }
    const voyageId = "muster-tidal-observatory";
    await db.taleSession.upsert({
      where: { id: voyageId },
      update: {},
      create: {
        id: voyageId,
        taleId,
        publishedVersionId: `${taleId}-edition`,
        captainAccountId: captain.accountId,
        voyageName: "Observatory invitation review",
        status: "SCHEDULED",
        plannedStartAt: new Date("2026-10-01T23:00:00Z"),
        accessTokenHash: digest(voyageId),
        memberships: {
          create: [
            { playerProfileId: captain.profileId, status: "READY", joinedAt: new Date() },
            { playerProfileId: fixture.profiles.sera.profileId, status: "INVITED" },
            { playerProfileId: fixture.profiles.northwind.profileId, status: "ACCEPTED", joinedAt: new Date() },
          ],
        },
      },
    });
    await db.invitation.upsert({
      where: { id: "muster-delta2-sera-invitation" },
      update: {},
      create: {
        id: "muster-delta2-sera-invitation",
        playthroughId: voyageId,
        intendedPlayerId: fixture.profiles.sera.profileId,
        recipientName: "Sera",
        tokenHash: digest(randomBytes(32)),
        tokenPrefix: "refit-d2",
        shortCodeHash: digest(randomBytes(16)),
        shortCodePrefix: "RFD2",
        expiresAt: new Date("2026-12-01T00:00:00Z"),
        createdBy: captain.accountId,
        creatorAccountId: captain.accountId,
      },
    });
    fixture.voyages["tidal-observatory"] = voyageId;
    await writeFile(fixturePath, JSON.stringify(fixture, null, 2));
    const after = await retainedState(before.map((row) => row.id));
    if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error("EXISTING_MUSTER_FIXTURE_CHANGED");
    await writeFile(
      path.join(output, "fixture-preservation.json"),
      JSON.stringify({ preserved: true, before, after, added: voyageId }, null, 2),
    );
    console.log(
      `Preserved ${before.length} existing Voyages and their memberships, invitations, editions and chat. Added ${voyageId}.`,
    );
  } finally {
    await db.$disconnect();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
