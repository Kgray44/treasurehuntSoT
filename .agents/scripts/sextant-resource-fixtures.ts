/** Owned synthetic active-Voyage baselines; no browser authentication or hidden reader preparation. */
import { createHash } from "node:crypto";
import { hash } from "bcryptjs";
import { db } from "../../src/lib/db";
import { saveStudioDraft, studioDraftSchema } from "../../src/chronicle/studio-service";
import { closureVoyage } from "../../tests/e2e/fixtures/landfall-closure";
import { seedSextantExperience } from "./sextant-experience-fixture";
import { syntheticSpatialMoment } from "../../src/parallax/fixtures";

const title = "Synthetic Sextant command Voyage";
const resourceCases = [
  "default",
  "1280-no-preference",
  "1280-reduce",
  "390-no-preference",
  "390-reduce",
  "paired-1280-no-preference",
  "paired-1280-reduce",
  "paired-390-no-preference",
  "paired-390-reduce",
] as const;
type ResourceCase = (typeof resourceCases)[number];

/** Reuse the existing nonce-owned database guard and preserve its separate Player baseline. */
export async function seedSextantResourceExperiences(resourceCase: ResourceCase = "default") {
  if (!resourceCases.includes(resourceCase)) throw new Error("SEXTANT_RESOURCE_CASE_INVALID");
  const player = await seedSextantExperience();
  const suffix = resourceCase === "default" ? "" : `-${resourceCase}`;
  const ownerId = `sextant-resource-owner${suffix}`;
  const crewId = `sextant-resource-crew${suffix}`;
  const email = `sextant.resources${suffix}@example.test`;
  const displayName = `Synthetic Sextant Captain${suffix}`;
  const paired = resourceCase.startsWith("paired-");
  const crewEmail = paired ? `sextant.crew${suffix}@example.test` : null;
  const existing = await db.userAccount.findUnique({
    where: { id: ownerId },
    include: { profile: true, emails: true },
  });
  if (existing) {
    const voyage = await db.taleSession.findUniqueOrThrow({ where: { id: `sextant-resource-voyage${suffix}` } });
    const tale = await db.chronicle.findUniqueOrThrow({ where: { id: `sextant-resource-chronicle${suffix}` } });
    if (!voyage.publishedVersionId) throw new Error("SEXTANT_RESOURCE_EDITION_MISSING");
    const version = await db.publishedTaleVersion.findUniqueOrThrow({ where: { id: voyage.publishedVersionId } });
    const crew = await db.playerProfile.findFirstOrThrow({ where: { accountId: crewId } });
    if (
      existing.status !== "ACTIVE" ||
      existing.profile?.displayName !== displayName ||
      !existing.emails.some((entry) => entry.normalizedEmail === email && entry.isPrimary) ||
      voyage.captainAccountId !== ownerId ||
      voyage.taleId !== tale.id ||
      tale.creatorAccountId !== ownerId ||
      version.taleId !== tale.id ||
      createHash("sha256").update(version.contentSnapshot).digest("hex") !== version.checksum ||
      (await db.playthroughMembership.count({ where: { playthroughId: voyage.id, playerProfileId: crew.id } })) !== 1 ||
      (await db.playthroughMembership.count({ where: { playerProfileId: existing.profile.id } })) !== 0
    )
      throw new Error("SEXTANT_RESOURCE_EXISTING_IDENTITY_MISMATCH");
    return {
      ownerId,
      email,
      displayName,
      crewEmail,
      voyageId: voyage.id,
      taleId: tale.id,
      versionId: version.id,
      playerVoyageId: player.voyageId,
      title,
    };
  }
  const now = new Date();
  const owner = await db.userAccount.create({
    data: {
      id: ownerId,
      status: "ACTIVE",
      claimedAt: now,
      ordinaryWorkspaceEntryAt: now,
      profile: {
        create: {
          displayName,
          normalizedDisplayName: displayName.toLowerCase(),
          status: "ACTIVE",
          claimedAt: now,
        },
      },
      emails: {
        create: {
          normalizedEmail: email,
          displayEmail: email,
          isPrimary: true,
          verificationState: "VERIFIED",
          verifiedAt: now,
        },
      },
      credential: { create: { passwordHash: await hash("Synthetic-Sextant-Resources-2026!", 12) } },
      roles: {
        create: [
          { role: "PLAYER", scopeType: "GLOBAL" },
          { role: "CREATOR", scopeType: "GLOBAL" },
        ],
      },
    },
    include: { profile: true },
  });
  const crew = await db.userAccount.create({
    data: {
      id: crewId,
      status: "ACTIVE",
      claimedAt: now,
      ordinaryWorkspaceEntryAt: now,
      profile: {
        create: {
          displayName: `Synthetic Sextant Crew${suffix}`,
          normalizedDisplayName: `synthetic sextant crew${suffix}`,
          status: "ACTIVE",
          claimedAt: now,
        },
      },
      ...(crewEmail
        ? {
            emails: {
              create: {
                normalizedEmail: crewEmail,
                displayEmail: crewEmail,
                isPrimary: true,
                verificationState: "VERIFIED",
                verifiedAt: now,
              },
            },
            credential: { create: { passwordHash: await hash("Synthetic-Sextant-Crew-2026!", 12) } },
            roles: { create: { role: "PLAYER", scopeType: "GLOBAL" } },
          }
        : {}),
    },
    include: { profile: true },
  });
  // Captain authority belongs to the resource owner. A separate crew member owns
  // Player participation, so the owner's Creator workspace is not safety-locked.
  const voyage = await closureVoyage(
    { id: owner.id, profileId: owner.profile!.id, token: "NOT_USED_FOR_AUTHENTICATION" },
    { id: crew.id, profileId: crew.profile!.id, token: "NOT_USED_FOR_AUTHENTICATION" },
    "narrative",
    {
      captain: true,
      fixtureIds: {
        tale: `sextant-resource-chronicle${suffix}`,
        session: `sextant-resource-voyage${suffix}`,
        chapter: `sextant-resource-chapter${suffix}`,
        active: `sextant-resource-passage${suffix}`,
        next: `sextant-resource-ending${suffix}`,
      },
    },
  );
  const version = await db.publishedTaleVersion.findUniqueOrThrow({ where: { id: voyage.versionId } });
  const snapshot = JSON.parse(version.contentSnapshot);
  snapshot.tale.title = title;
  snapshot.tale.slug = `sextant-resource-chronicle${suffix}`;
  if (paired) {
    const block = snapshot.chapters[0].blocks[0];
    block.title = "The Captain’s note";
    block.configuration = { heading: "The Captain’s note", body: "Open the Lens to read the released clue." };
    const moment = syntheticSpatialMoment(voyage.activeId);
    moment.definition.ownerPersonId = ownerId;
    block.presentation = { spatialMoment: moment };
    block.completion = { mode: "playerConfirmation" };
  }
  const contentSnapshot = JSON.stringify(snapshot);
  await db.publishedTaleVersion.update({
    where: { id: version.id },
    data: { contentSnapshot, checksum: createHash("sha256").update(contentSnapshot).digest("hex") },
  });
  await db.chronicle.update({ where: { id: voyage.taleId }, data: { title, slug: snapshot.tale.slug } });
  const draft = await db.taleDraft.create({
    data: { taleId: voyage.taleId, createdBy: ownerId, createdByAccountId: ownerId },
  });
  await db.chronicle.update({ where: { id: voyage.taleId }, data: { currentDraftRevisionId: draft.id } });
  await saveStudioDraft(
    voyage.taleId,
    studioDraftSchema.parse({
      autosaveVersion: draft.autosaveVersion,
      tale: snapshot.tale,
      chapters: snapshot.chapters,
    }),
    ownerId,
  );
  return {
    ownerId,
    email,
    displayName,
    crewEmail,
    voyageId: voyage.id,
    taleId: voyage.taleId,
    versionId: version.id,
    playerVoyageId: player.voyageId,
    title,
  };
}
