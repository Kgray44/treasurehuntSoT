import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { randomBytes, createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ensureDevelopmentMusterCover } from "../../prisma/muster-cover";

async function main() {
  const taskRoot = path.resolve(".runtime/muster");
  const expected = `file:${path.join(taskRoot, "muster.sqlite").replaceAll("\\", "/")}`;
  if (process.env.DATABASE_URL !== expected) throw new Error("MUSTER_TASK_DATABASE_REQUIRED");
  const db = new PrismaClient();
  const digest = (value: string) => createHash("sha256").update(value).digest("hex");
  const now = new Date();
  const password = process.env.MUSTER_PREVIEW_PASSWORD ?? "Muster-Preview-2026!";
  const profiles: Record<
    string,
    { accountId: string; profileId: string; token: string; csrfToken: string; email: string }
  > = {};
  try {
    for (const [key, name] of [
      ["captain", "Kato"],
      ["sera", "Sera"],
      ["northwind", "Northwind"],
      ["tidewalker", "TideWalker"],
      ["outsider", "Visitor"],
    ]) {
      const email = `muster-${key}@example.invalid`;
      const id = `muster-account-${key}`;
      const user = await db.userAccount.upsert({
        where: { id },
        update: {},
        create: {
          id,
          status: "ACTIVE",
          claimedAt: now,
          ordinaryWorkspaceEntryAt: now,
          credential: { create: { passwordHash: await hash(password, 8) } },
          emails: {
            create: {
              normalizedEmail: email,
              displayEmail: email,
              isPrimary: true,
              verificationState: "VERIFIED",
              verifiedAt: now,
            },
          },
          roles: { create: { role: "PLAYER" } },
          profile: {
            create: {
              id: `muster-profile-${key}`,
              displayName: name,
              normalizedDisplayName: name.toLowerCase(),
              handle: `muster-${key}`,
              normalizedHandle: `muster-${key}`,
              status: "ACTIVE",
              claimedAt: now,
            },
          },
        },
        include: { profile: true },
      });
      const token = randomBytes(32).toString("hex"),
        csrfToken = randomBytes(24).toString("hex");
      await db.accountSession.create({
        data: {
          accountId: id,
          tokenHash: digest(token),
          csrfToken,
          expiresAt: new Date(Date.now() + 30 * 86400_000),
          deviceLabel: "Muster task-owned development proof",
        },
      });
      profiles[key] = { accountId: id, profileId: user.profile!.id, token, csrfToken, email };
    }
    const captain = profiles.captain;
    const tale = await db.chronicle.upsert({
      where: { slug: "development-studio-voyage" },
      update: {},
      create: {
        id: "muster-forever-treasure",
        slug: "development-studio-voyage",
        title: "The Forever Treasure",
        subtitle: "A Studio Development Voyage",
        shortDescription:
          "A journey of discovery, friendship, and the treasures that can’t be lost. Explore familiar shores with new perspectives, uncover hidden stories, and create memories together.",
        creatorId: captain.accountId,
        creatorAccountId: captain.accountId,
        status: "PUBLISHED",
        visibility: "PUBLIC",
        estimatedDuration: 150,
      },
    });
    const cover = await ensureDevelopmentMusterCover(db);
    const covers = cover
      ? [
          {
            id: cover.id,
            mediaType: "IMAGE",
            displayName: cover.displayName,
            description: null,
            mimeType: "image/png",
            width: 1672,
            height: 941,
            roles: ["COVER"],
            variants: cover.variants.map((v) => ({
              id: v.id,
              role: v.role,
              mimeType: v.mimeType,
              processingState: v.processingState,
            })),
          },
        ]
      : [];
    async function edition(taleId: string, title: string, coverAssetId: string | null) {
      const contentSnapshot = JSON.stringify({
        schemaVersion: 1,
        tale: {
          id: taleId,
          slug: taleId,
          title,
          subtitle: tale.subtitle,
          shortDescription: tale.shortDescription,
          longDescription: null,
          coverAssetId,
          theme: "CARTOGRAPHERS_TABLE",
          visibility: "PUBLIC",
          playerCountMin: 1,
          playerCountMax: 4,
          estimatedDuration: 150,
          contentWarnings: null,
        },
        chapters: [
          {
            id: `${taleId}-chapter`,
            title: "A new horizon",
            subtitle: null,
            description: null,
            coverAssetId: null,
            estimatedDuration: null,
            isOptional: false,
            metadata: {},
            orderIndex: 0,
            entryBlockId: `${taleId}-entry`,
            completionBlockId: `${taleId}-entry`,
            blocks: [
              {
                id: `${taleId}-entry`,
                chapterId: `${taleId}-chapter`,
                blockType: "narrative",
                title: "Cast off",
                configuration: {
                  heading: "A new horizon",
                  body: "A task-owned practice Voyage.",
                  completionMode: "playerConfirmation",
                },
                presentation: {},
                completion: {},
                orderIndex: 0,
                isEnabled: true,
                nextBlockId: null,
                connections: [],
              },
            ],
          },
        ],
        assets: coverAssetId ? covers : [],
        locations: [],
        artifacts: [],
        publishedAt: now.toISOString(),
      });
      const version = await db.publishedTaleVersion.upsert({
        where: { id: `${taleId}-edition` },
        update: {},
        create: {
          id: `${taleId}-edition`,
          taleId,
          versionNumber: 1,
          versionLabel: "1.0",
          publishedBy: captain.accountId,
          publishedByAccountId: captain.accountId,
          contentSnapshot,
          checksum: digest(contentSnapshot),
          publishedAt: now,
          isCurrent: true,
        },
      });
      await db.chronicle.update({ where: { id: taleId }, data: { latestPublishedVersionId: version.id } });
      return version;
    }
    const version = await edition(tale.id, tale.title, cover?.id ?? null);
    const fallback = await db.chronicle.upsert({
      where: { slug: "muster-fallback-chronicle" },
      update: {},
      create: {
        id: "muster-fallback-chronicle",
        slug: "muster-fallback-chronicle",
        title: "Beyond the Blue Horizon",
        creatorId: captain.accountId,
        creatorAccountId: captain.accountId,
        status: "PUBLISHED",
        visibility: "PUBLIC",
      },
    });
    const fallbackVersion = await edition(fallback.id, fallback.title, null);
    const voyages: Record<string, string> = {};
    for (const [key, keys] of [
      ["all-ready", ["captain", "sera", "northwind", "tidewalker"]],
      ["preparing", ["captain", "sera", "northwind", "tidewalker"]],
      ["captain-only", ["sera", "northwind", "tidewalker"]],
      ["captain-empty", []],
      ["fallback", ["captain", "sera"]],
    ] as const) {
      const id = `muster-${key}`;
      const selected = key === "fallback" ? fallbackVersion : version;
      await db.taleSession.upsert({
        where: { id },
        update: {},
        create: {
          id,
          taleId: selected.taleId,
          publishedVersionId: selected.id,
          captainAccountId: captain.accountId,
          voyageName: "Studio Development Voyage",
          accessTokenHash: digest(id),
          status: "READY",
          previewMode: false,
        },
      });
      for (const member of keys)
        await db.playthroughMembership.upsert({
          where: { playthroughId_playerProfileId: { playthroughId: id, playerProfileId: profiles[member].profileId } },
          update: {},
          create: {
            playthroughId: id,
            playerProfileId: profiles[member].profileId,
            status: key === "preparing" && ["northwind", "tidewalker"].includes(member) ? "ACCEPTED" : "READY",
            joinedAt: now,
          },
        });
      voyages[key] = id;
    }
    // The supplied island is also a real profile upload in this synthetic fixture.
    const mediaRoot = path.join(taskRoot, "profile-media");
    await mkdir(mediaRoot, { recursive: true });
    const avatarBytes = await readFile("public/images/muster/moonlit-island.png");
    await writeFile(path.join(mediaRoot, "northwind.png"), avatarBytes);
    const avatar = await db.profileMedia.upsert({
      where: { id: "muster-northwind-avatar" },
      update: {},
      create: {
        id: "muster-northwind-avatar",
        profileId: profiles.northwind.profileId,
        ownerAccountId: profiles.northwind.accountId,
        kind: "AVATAR",
        storageKey: "northwind.png",
        mimeType: "image/png",
        byteLength: avatarBytes.length,
        width: 1672,
        height: 941,
        altText: "Moonlit island",
      },
    });
    await db.playerProfile.update({ where: { id: profiles.northwind.profileId }, data: { avatarMediaId: avatar.id } });
    await writeFile(
      path.join(taskRoot, "fixture.json"),
      JSON.stringify({ origin: "http://127.0.0.1:3128", profiles, voyages, password }, null, 2),
    );
    console.log("Muster synthetic fixture ready: five Voyages, five accounts; Crew Chat starts empty.");
  } finally {
    await db.$disconnect();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
