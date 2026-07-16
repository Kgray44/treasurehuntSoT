import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";

const db = new PrismaClient();
const hash = (value: string) => createHash("sha256").update(value).digest("hex");

async function main() {
  const gmUsername = process.env.GM_USERNAME ?? "kato";
  const gmPassword = process.env.GM_PASSWORD ?? "development-captain-only";
  const accessCode = process.env.PLAYER_ACCESS_CODE ?? "development-moonwake";
  const user = await db.gameMasterUser.upsert({
    where: { username: gmUsername },
    update: { passwordHash: await bcrypt.hash(gmPassword, 12) },
    create: { username: gmUsername, passwordHash: await bcrypt.hash(gmPassword, 12) },
  });
  const campaign = await db.campaign.upsert({
    where: { slug: "development-forever-treasure" },
    update: { accessCodeHash: await bcrypt.hash(accessCode, 12) },
    create: {
      slug: "development-forever-treasure",
      title: "The Forever Treasure",
      status: "ACTIVE",
      accessCodeHash: await bcrypt.hash(accessCode, 12),
    },
  });
  let content = await db.chapterContent.findFirst({
    where: { chapters: { some: { campaignId: campaign.id, ordinal: 1 } } },
  });
  if (!content)
    content = await db.chapterContent.create({
      data: {
        title: "The First Seal",
        narrative:
          "The sea has carried a whisper to Port Merrick. Somewhere beneath lantern light and weathered stone, the first mark of the voyage waits to be found.",
        objective: "Discover where the first seal was hidden.",
        developmentOnly: true,
      },
    });
  const firstChapter = await db.chapter.upsert({
    where: { campaignId_ordinal: { campaignId: campaign.id, ordinal: 1 } },
    update: {},
    create: {
      campaignId: campaign.id,
      ordinal: 1,
      state: "LOCKED",
      contentId: content.id,
      clues: {
        create: {
          ordinal: 1,
          body: "Where weary crews return from foam,\nBeneath the lights that welcome home,\nSeek not the crown nor highest stair,\nBut where old ropes taste salted air.",
        },
      },
    },
  });
  for (const [ordinal, body] of [
    [1, "Look to the lanterns before searching the lower quay."],
    [2, "The old ropes remember which mooring heard the bell."],
    [3, "If the tide is high, follow the brass mark rather than the foam."],
  ] as const)
    await db.hint.upsert({
      where: { chapterId_ordinal: { chapterId: firstChapter.id, ordinal } },
      update: {},
      create: { chapterId: firstChapter.id, ordinal, body },
    });

  const developmentChapters = [
    [
      2,
      "The Moonlit Bearing",
      "Plot a safe course through a field of sleeping stars.",
      "Find the bearing hidden in the chart margins.",
    ],
    [
      3,
      "The Brass Accord",
      "Three recovered fragments hum when laid upon the same course.",
      "Discover how the relics answer one another.",
    ],
    [
      4,
      "The Quiet Horizon",
      "A sealed horizon waits beyond the last ordinary waypoint.",
      "Prepare the voyage for its development-only final approach.",
    ],
  ] as const;
  for (const [ordinal, title, narrative, objective] of developmentChapters) {
    let chapterContent = await db.chapterContent.findFirst({
      where: { chapters: { some: { campaignId: campaign.id, ordinal } } },
    });
    if (!chapterContent)
      chapterContent = await db.chapterContent.create({
        data: { title, narrative, objective, developmentOnly: true },
      });
    const chapter = await db.chapter.upsert({
      where: { campaignId_ordinal: { campaignId: campaign.id, ordinal } },
      update: {},
      create: {
        campaignId: campaign.id,
        ordinal,
        state: "LOCKED",
        contentId: chapterContent.id,
        clues: { create: { ordinal: 1, body: `Development clue for chapter ${ordinal}.` } },
      },
    });
    for (const hintOrdinal of [1, 2])
      await db.hint.upsert({
        where: { chapterId_ordinal: { chapterId: chapter.id, ordinal: hintOrdinal } },
        update: {},
        create: {
          chapterId: chapter.id,
          ordinal: hintOrdinal,
          body: `Development hint ${hintOrdinal} for chapter ${ordinal}.`,
        },
      });
  }
  await db.artifact.upsert({
    where: { campaignId_key: { campaignId: campaign.id, key: "broken-compass-needle" } },
    update: {},
    create: {
      campaignId: campaign.id,
      key: "broken-compass-needle",
      name: "The Broken Compass Needle",
      description: "A sliver of darkened brass that trembles toward promises, not north.",
    },
  });
  await db.artifact.upsert({
    where: { campaignId_key: { campaignId: campaign.id, key: "tarnished-star-disc" } },
    update: {},
    create: {
      campaignId: campaign.id,
      key: "tarnished-star-disc",
      name: "The Tarnished Star Disc",
      description: "A development relic etched with a deliberately incomplete constellation.",
    },
  });
  await db.mapLocation.upsert({
    where: { campaignId_key: { campaignId: campaign.id, key: "port-merrick" } },
    update: {},
    create: {
      campaignId: campaign.id,
      key: "port-merrick",
      name: "Port Merrick",
      regionLabel: "The Ancient Isles",
      x: 63,
      y: 43,
    },
  });
  await db.mapLocation.upsert({
    where: { campaignId_key: { campaignId: campaign.id, key: "moonwake-shoal" } },
    update: {},
    create: {
      campaignId: campaign.id,
      key: "moonwake-shoal",
      name: "Moonwake Shoal",
      regionLabel: "Uncharted development waters",
      x: 37,
      y: 61,
    },
  });
  await db.sideQuest.upsert({
    where: { campaignId_key: { campaignId: campaign.id, key: "echoes-of-the-past" } },
    update: {},
    create: {
      campaignId: campaign.id,
      key: "echoes-of-the-past",
      title: "Echoes of the Past",
      state: "UNDISCOVERED",
      objectives: { create: { ordinal: 1, body: "Listen for what the tide remembers." } },
    },
  });
  await db.sideQuest.upsert({
    where: { campaignId_key: { campaignId: campaign.id, key: "lantern-keepers-ledger" } },
    update: {},
    create: {
      campaignId: campaign.id,
      key: "lantern-keepers-ledger",
      title: "The Lantern Keeper's Ledger",
      state: "UNDISCOVERED",
      objectives: {
        create: [
          { ordinal: 1, body: "Find the unsigned ledger page." },
          { ordinal: 2, body: "Match its mark to the chart." },
        ],
      },
    },
  });
  const playerToken = randomBytes(24).toString("base64url");
  if (!(await db.playerAccess.findFirst({ where: { campaignId: campaign.id } })))
    await db.playerAccess.create({
      data: { campaignId: campaign.id, tokenHash: hash(playerToken), label: "Development player" },
    });
  await db.contentVersion.upsert({
    where: { key_version: { key: "development-first-seal", version: 1 } },
    update: {},
    create: { key: "development-first-seal", version: 1, checksum: hash(content.title + content.narrative) },
  });
  if (!(await db.preparedAction.findFirst({ where: { campaignId: campaign.id } })))
    await db.preparedAction.create({
      data: {
        campaignId: campaign.id,
        command: "REVEAL_MAP",
        targetKey: "moonwake-shoal",
        payload: "{}",
        status: "PREPARED",
        expectedSequence: campaign.currentSequence,
        preparedBy: user.id,
      },
    });
  if (!(await db.adminAuditLog.findFirst({ where: { campaignId: campaign.id, action: "DEVELOPMENT_SEED" } })))
    await db.adminAuditLog.create({
      data: {
        campaignId: campaign.id,
        userId: user.id,
        action: "DEVELOPMENT_SEED",
        metadata: JSON.stringify({ preset: "command-center-ready" }),
        reason: "Generic Phase 3 development fixture",
      },
    });
  console.log(
    `Development seed ready for ${campaign.slug}; GM user: ${user.username}. Credentials come from local environment values.`,
  );
}

main().finally(() => db.$disconnect());
