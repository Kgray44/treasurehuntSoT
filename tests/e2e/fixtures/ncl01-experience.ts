import type { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { createHash } from "node:crypto";
import path from "node:path";
import type { PublishedTaleSnapshot } from "../../../src/chronicle/types";

/** Disposable identities for real UI sign-in in the existing isolated generic suite. */
export const NCL01_EXPERIENCE_PASSWORD = "Synthetic-NCL01-Review-2026!";
export const NCL01_EXPERIENCE_ACCOUNTS = [
  { id: "00000000-0000-4000-8000-00000000ac01", label: "Player", role: null },
  { id: "00000000-0000-4000-8000-00000000ac02", label: "Captain", role: "CAPTAIN" },
  { id: "00000000-0000-4000-8000-00000000ac03", label: "Creator", role: "CREATOR" },
  { id: "00000000-0000-4000-8000-00000000ac04", label: "Administrator", role: "ADMINISTRATOR" },
  { id: "spatial-pilot-navigator", label: "Owner", role: null },
] as const;
export const NCL01_EXPERIENCE_CHRONICLE_ID = "00000000-0000-4000-8000-00000000ac10";
export const NCL01_EXPERIENCE_DRAFT_ID = "00000000-0000-4000-8000-00000000ac11";
export const NCL01_EXPERIENCE_EDITION_ID = "00000000-0000-4000-8000-00000000ac12";
export const NCL01_EXPERIENCE_VOYAGE_ID = "00000000-0000-4000-8000-00000000ac13";
const chapterId = "00000000-0000-4000-8000-00000000ac14";
const completionId = "00000000-0000-4000-8000-00000000ac15";
const startedAt = new Date("2026-10-20T12:00:00.000Z");
const completedAt = new Date("2026-10-20T12:10:00.000Z");
const digest = (value: string) => createHash("sha256").update(value).digest("hex");

function assertOwnedSeedEnvironment() {
  const databaseUrl = process.env.DATABASE_URL ?? "";
  const databasePath = databaseUrl.startsWith("file:") ? databaseUrl.slice(5) : "";
  const relative = path.relative(path.resolve("artifacts/sounding-line"), databasePath);
  if (
    process.env.FOREVER_VALIDATION_ISOLATION !== "1" ||
    process.env.SOUNDING_LINE_SUITE_PROFILE !== "generic" ||
    process.env.SOUNDING_LINE_TASK_OWNED_HTTP !== "1" ||
    !/^[a-f0-9]{64}$/u.test(process.env.FOREVER_VALIDATION_NONCE_HASH ?? "") ||
    !path.isAbsolute(databasePath) ||
    !/^generic-[a-f0-9]{12}[\\/]validation-isolated-\d{8}-\d{9}-[a-f0-9]{32}\.db$/u.test(relative)
  )
    throw new Error("NCL01_EXPERIENCE_OWNED_FIXTURE_REQUIRED");
}

function historySnapshot(): PublishedTaleSnapshot {
  return {
    schemaVersion: 1,
    tale: {
      id: NCL01_EXPERIENCE_CHRONICLE_ID,
      slug: "ncl01-consumer-chronicle",
      title: "NCL01 Consumer Chronicle",
      subtitle: "A synthetic private account record",
      shortDescription: null,
      longDescription: null,
      coverAssetId: null,
      theme: "CARTOGRAPHERS_TABLE",
      visibility: "PRIVATE",
      playerCountMin: 1,
      playerCountMax: 4,
      estimatedDuration: null,
      contentWarnings: null,
    },
    chapters: [
      {
        id: chapterId,
        title: "The return to Harbor",
        orderIndex: 0,
        entryBlockId: completionId,
        completionBlockId: completionId,
        blocks: [
          {
            id: completionId,
            chapterId,
            blockType: "taleComplete",
            title: "A voyage remembered",
            orderIndex: 0,
            configuration: { heading: "A voyage remembered", body: "A synthetic voyage returned safely to Harbor." },
            presentation: {},
            completion: {},
            nextBlockId: null,
            connections: [],
          },
        ],
      },
    ],
    assets: [],
    locations: [],
    artifacts: [],
    publishedAt: startedAt.toISOString(),
  };
}

/**
 * Data-only capture preconditions, not publication or native qualification evidence.
 * Actual history is derived by the ordinary Passport service from the pinned Voyage.
 * No auth sessions, device enrollments, history projections or success receipts are seeded.
 */
export async function prepareNcl01ExperienceFixture(store: PrismaClient) {
  assertOwnedSeedEnvironment();
  const passwordHash = await hash(NCL01_EXPERIENCE_PASSWORD, 10);
  await store.$transaction(async (tx) => {
    for (const account of NCL01_EXPERIENCE_ACCOUNTS) {
      // In particular, never replace an existing fixed Sea Trials owner's credentials or fields.
      if (await tx.userAccount.findUnique({ where: { id: account.id } })) continue;
      const email = `ncl01-review-${account.label.toLowerCase()}@example.test`;
      await tx.userAccount.create({
        data: {
          id: account.id,
          status: "ACTIVE",
          claimedAt: startedAt,
          ordinaryWorkspaceEntryAt: startedAt,
          profile: {
            create: {
              id: `${account.id}:profile`,
              displayName: `Synthetic NCL01 ${account.label}`,
              normalizedDisplayName: `synthetic ncl01 ${account.label.toLowerCase()}`,
              status: "ACTIVE",
              claimedAt: startedAt,
            },
          },
          emails: {
            create: {
              normalizedEmail: email,
              displayEmail: email,
              isPrimary: true,
              verificationState: "VERIFIED",
              verifiedAt: startedAt,
            },
          },
          credential: { create: { passwordHash } },
          ...(account.role ? { roles: { create: { role: account.role, scopeType: "GLOBAL" } } } : {}),
        },
      });
    }
    // --ensure preserves mutations made through the real UI in earlier contexts.
    if (await tx.taleSession.findUnique({ where: { id: NCL01_EXPERIENCE_VOYAGE_ID } })) return;
    const snapshot = historySnapshot();
    const contentSnapshot = JSON.stringify(snapshot);
    const creator = NCL01_EXPERIENCE_ACCOUNTS[2];
    await tx.chronicle.create({
      data: {
        id: NCL01_EXPERIENCE_CHRONICLE_ID,
        slug: snapshot.tale.slug,
        title: snapshot.tale.title,
        subtitle: snapshot.tale.subtitle,
        creatorId: `${creator.id}:profile`,
        creatorAccountId: creator.id,
        status: "PUBLISHED",
        visibility: "PRIVATE",
        drafts: {
          create: {
            id: NCL01_EXPERIENCE_DRAFT_ID,
            createdBy: creator.id,
            createdByAccountId: creator.id,
            validationState: "NOT_VALIDATED",
            chapters: {
              create: {
                id: chapterId,
                title: snapshot.chapters[0].title,
                orderIndex: 0,
                entryBlockId: completionId,
                completionBlockId: completionId,
                blocks: {
                  create: {
                    id: completionId,
                    title: snapshot.chapters[0].blocks[0].title,
                    blockType: "taleComplete",
                    orderIndex: 0,
                    configuration: JSON.stringify(snapshot.chapters[0].blocks[0].configuration),
                  },
                },
              },
            },
          },
        },
      },
    });
    await tx.publishedTaleVersion.create({
      data: {
        id: NCL01_EXPERIENCE_EDITION_ID,
        taleId: NCL01_EXPERIENCE_CHRONICLE_ID,
        versionNumber: 1,
        versionLabel: "Synthetic account history v1",
        publishedBy: creator.id,
        contentSnapshot,
        checksum: digest(contentSnapshot),
        publishedAt: startedAt,
      },
    });
    await tx.chronicle.update({
      where: { id: NCL01_EXPERIENCE_CHRONICLE_ID },
      data: {
        currentDraftRevisionId: NCL01_EXPERIENCE_DRAFT_ID,
        latestPublishedVersionId: NCL01_EXPERIENCE_EDITION_ID,
      },
    });
    await tx.taleSession.create({
      data: {
        id: NCL01_EXPERIENCE_VOYAGE_ID,
        taleId: NCL01_EXPERIENCE_CHRONICLE_ID,
        publishedVersionId: NCL01_EXPERIENCE_EDITION_ID,
        accessTokenHash: digest(`ncl01-consumer-history:${NCL01_EXPERIENCE_VOYAGE_ID}`),
        status: "COMPLETED",
        currentChapterId: chapterId,
        currentBlockId: completionId,
        currentSequence: 2,
        startedAt,
        launchedAt: startedAt,
        completedAt,
      },
    });
    await tx.playthroughMembership.create({
      data: {
        id: "00000000-0000-4000-8000-00000000ac16",
        playthroughId: NCL01_EXPERIENCE_VOYAGE_ID,
        playerProfileId: `${NCL01_EXPERIENCE_ACCOUNTS[0].id}:profile`,
        status: "COMPLETED_MEMBER",
        joinedAt: startedAt,
        completedAt,
      },
    });
    await tx.taleSessionEvent.createMany({
      data: ["chapterCompleted", "sessionCompleted"].map((eventType, index) => ({
        id: `00000000-0000-4000-8000-00000000ac2${index}`,
        sessionId: NCL01_EXPERIENCE_VOYAGE_ID,
        publishedVersionId: NCL01_EXPERIENCE_EDITION_ID,
        blockId: completionId,
        sourceType: "progression",
        idempotencyKey: `ncl01-consumer-history:${index + 1}`,
        sequence: index + 1,
        eventType,
        payload: JSON.stringify({ blockId: completionId, chapterId }),
        createdAt: completedAt,
      })),
    });
  });
}
