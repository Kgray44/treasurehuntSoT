import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";

const db = new PrismaClient();
const hash = (value: string) => createHash("sha256").update(value).digest("hex");

async function main() {
  const gmUsername = process.env.GM_USERNAME ?? "kato";
  const gmPassword = process.env.GM_PASSWORD ?? "development-captain-only";
  const accessCode = process.env.PLAYER_ACCESS_CODE ?? "development-moonwake";
  const user = await db.gameMasterUser.upsert({ where: { username: gmUsername }, update: { passwordHash: await bcrypt.hash(gmPassword, 12) }, create: { username: gmUsername, passwordHash: await bcrypt.hash(gmPassword, 12) } });
  const campaign = await db.campaign.upsert({ where: { slug: "development-forever-treasure" }, update: { accessCodeHash: await bcrypt.hash(accessCode, 12) }, create: { slug: "development-forever-treasure", title: "The Forever Treasure", status: "ACTIVE", accessCodeHash: await bcrypt.hash(accessCode, 12) } });
  let content = await db.chapterContent.findFirst({ where: { chapters: { some: { campaignId: campaign.id, ordinal: 1 } } } });
  if (!content) content = await db.chapterContent.create({ data: { title: "The First Seal", narrative: "The sea has carried a whisper to Port Merrick. Somewhere beneath lantern light and weathered stone, the first mark of the voyage waits to be found.", objective: "Discover where the first seal was hidden.", developmentOnly: true } });
  await db.chapter.upsert({ where: { campaignId_ordinal: { campaignId: campaign.id, ordinal: 1 } }, update: {}, create: { campaignId: campaign.id, ordinal: 1, state: "LOCKED", contentId: content.id, clues: { create: { ordinal: 1, body: "Where weary crews return from foam,\nBeneath the lights that welcome home,\nSeek not the crown nor highest stair,\nBut where old ropes taste salted air." } } } });
  await db.artifact.upsert({ where: { campaignId_key: { campaignId: campaign.id, key: "broken-compass-needle" } }, update: {}, create: { campaignId: campaign.id, key: "broken-compass-needle", name: "The Broken Compass Needle", description: "A sliver of darkened brass that trembles toward promises, not north." } });
  await db.mapLocation.upsert({ where: { campaignId_key: { campaignId: campaign.id, key: "port-merrick" } }, update: {}, create: { campaignId: campaign.id, key: "port-merrick", name: "Port Merrick", regionLabel: "The Ancient Isles", x: 63, y: 43 } });
  await db.sideQuest.upsert({ where: { campaignId_key: { campaignId: campaign.id, key: "echoes-of-the-past" } }, update: {}, create: { campaignId: campaign.id, key: "echoes-of-the-past", title: "Echoes of the Past", state: "UNDISCOVERED", objectives: { create: { ordinal: 1, body: "Listen for what the tide remembers." } } } });
  const playerToken = randomBytes(24).toString("base64url");
  if (!(await db.playerAccess.findFirst({ where: { campaignId: campaign.id } }))) await db.playerAccess.create({ data: { campaignId: campaign.id, tokenHash: hash(playerToken), label: "Development player" } });
  await db.contentVersion.upsert({ where: { key_version: { key: "development-first-seal", version: 1 } }, update: {}, create: { key: "development-first-seal", version: 1, checksum: hash(content.title + content.narrative) } });
  console.log(`Development seed ready for ${campaign.slug}; GM user: ${user.username}. Credentials come from local environment values.`);
}

main().finally(() => db.$disconnect());
