import type { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { createHash } from "node:crypto";
import path from "node:path";
import type { PublishedTaleSnapshot } from "../../../src/chronicle/types";
import { validateLandfallDefinition } from "../../../src/landfall/definition";
import { landfallFixture } from "../../../src/landfall/fixtures";
import { syntheticSpatialMoment } from "../../../src/parallax/fixtures";

/** Public synthetic identities; real sign-in and device enrollment remain UI actions. */
export const STATIC_ACCOUNT_ID = "00000000-0000-4000-8000-00000000cd10";
export const STATIC_VOYAGE_ID = "00000000-0000-4000-8000-00000000cd11";
export const STATIC_EDITION_ID = "00000000-0000-4000-8000-00000000cd12";
export const STATIC_PROFILE_ID = "00000000-0000-4000-8000-00000000cd13";
export const STATIC_CHRONICLE_ID = "00000000-0000-4000-8000-00000000cd14";
export const CROSSDECK_EXPERIENCE_EMAIL = "crossdeck-review@example.test";
export const CROSSDECK_EXPERIENCE_PASSWORD = "Synthetic-Crossdeck-Review-2026!";
const chapterId = "00000000-0000-4000-8000-00000000cd15";
const activeId = "00000000-0000-4000-8000-00000000cd16";
const nextId = "00000000-0000-4000-8000-00000000cd17";
const noteId = "00000000-0000-4000-8000-00000000cd18";
const artifactId = "00000000-0000-4000-8000-00000000cd19";
const timestamp = new Date("2026-10-11T12:00:00.000Z");
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
    throw new Error("CROSSDECK_EXPERIENCE_OWNED_FIXTURE_REQUIRED");
}

function publishedSnapshot(): PublishedTaleSnapshot {
  const definition = structuredClone(landfallFixture);
  definition.taleId = STATIC_CHRONICLE_ID;
  definition.waypoints[0].evidenceProfile.acceptedSources.push("PLAYER_CONFIRMATION");
  definition.waypoints[0].evidenceProfile.dwellSeconds = 0;
  definition.waypoints.push({
    ...structuredClone(definition.waypoints[0]),
    id: "town-second",
    name: "Second square",
    visibility: { hiddenUntilRevealed: false },
    sequence: { afterWaypointIds: [], optional: false },
  });
  definition.waypoints.push({
    ...structuredClone(definition.waypoints[0]),
    id: "town-hidden",
    name: "Withheld destination",
    visibility: { hiddenUntilRevealed: true },
    sequence: { afterWaypointIds: [], optional: false },
  });
  definition.routes[0].waypointIds.push("town-second");
  definition.routes.push({
    ...structuredClone(definition.routes[0]),
    id: "hidden-route",
    name: "Withheld route",
    model: "HIDDEN",
    waypointIds: ["town-hidden"],
  });
  definition.worldspaces = [definition.worldspaces[1], definition.worldspaces[0]];
  definition.waypoints[1].visibility.hiddenUntilRevealed = false;
  definition.maps[1].renderer = "VECTOR_2D";
  definition.maps[1].source = { type: "AUTHORED_VECTOR" };
  const blocks = [
    {
      id: activeId,
      blockType: "livingChart",
      title: "The island course",
      configuration: {
        heading: "Follow the lanterns",
        body: "The harbour falls quiet behind you. Across the tide, the island’s lanterns mark a course through the old gardens.\n\nKeep the Chart close. The Captain’s note carries your next bearing.",
        worldspaceId: "isles",
        waypointId: "isle-region",
        routeId: "isle-route",
      },
      presentation: { spatialMoment: syntheticSpatialMoment(activeId) },
      nextBlockId: nextId,
    },
    {
      id: nextId,
      blockType: "taleComplete",
      title: "Voyage complete",
      configuration: {},
      presentation: {},
      nextBlockId: null,
    },
    {
      id: noteId,
      blockType: "captainsNote",
      title: "A letter from the Captain",
      configuration: {
        heading: "A bearing in the stars",
        body: "When the first lantern meets the northern light, follow the path into the garden. Keep this letter close; the same clue travels with you.",
        signature: "Your Captain",
      },
      presentation: {},
      nextBlockId: null,
    },
    {
      id: artifactId,
      blockType: "artifactReveal",
      title: "The brass compass",
      configuration: {
        heading: "The brass compass",
        body: "A small compass worn smooth by a hundred voyages. Its engraved star points toward the island garden.",
        description: "Recovered at the harbour. A released keepsake from this Voyage.",
      },
      presentation: {},
      nextBlockId: null,
    },
  ];
  return {
    schemaVersion: 1,
    tale: {
      id: STATIC_CHRONICLE_ID,
      slug: "synthetic-crossdeck-experience",
      title: "Synthetic Crossdeck refit Voyage",
      subtitle: "Lanterns across the tide",
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
        title: "The island course",
        subtitle: null,
        description: null,
        coverAssetId: null,
        estimatedDuration: null,
        isOptional: false,
        metadata: {},
        orderIndex: 0,
        entryBlockId: activeId,
        completionBlockId: nextId,
        blocks: blocks.map((block, orderIndex) => ({
          ...block,
          chapterId,
          orderIndex,
          completion: {},
          isEnabled: true,
          connections: [],
        })),
      },
    ],
    assets: [],
    locations: [],
    artifacts: [],
    landfall: validateLandfallDefinition(definition),
    publishedAt: timestamp.toISOString(),
  };
}

/** Data-only seed adapter, called before the isolation marker is prepared. */
export async function prepareCrossdeckExperienceFixture(store: PrismaClient) {
  assertOwnedSeedEnvironment();
  const identity = {
    accountId: STATIC_ACCOUNT_ID,
    voyageId: STATIC_VOYAGE_ID,
    versionId: STATIC_EDITION_ID,
    profileId: STATIC_PROFILE_ID,
    taleId: STATIC_CHRONICLE_ID,
    activeId,
    nextId,
    noteId,
    artifactId,
  };
  // Repeated --ensure seeds preserve any real UI actions already performed.
  if (await store.taleSession.findUnique({ where: { id: STATIC_VOYAGE_ID } })) return identity;
  const passwordHash = await hash(CROSSDECK_EXPERIENCE_PASSWORD, 10);
  const snapshot = publishedSnapshot();
  const contentSnapshot = JSON.stringify(snapshot);
  await store.$transaction(async (tx) => {
    await tx.userAccount.create({
      data: {
        id: STATIC_ACCOUNT_ID,
        status: "ACTIVE",
        claimedAt: timestamp,
        ordinaryWorkspaceEntryAt: timestamp,
        profile: {
          create: {
            id: STATIC_PROFILE_ID,
            displayName: "Crossdeck synthetic navigator",
            normalizedDisplayName: "crossdeck synthetic navigator",
            status: "ACTIVE",
            claimedAt: timestamp,
          },
        },
        emails: {
          create: {
            id: "00000000-0000-4000-8000-00000000cd27",
            normalizedEmail: CROSSDECK_EXPERIENCE_EMAIL,
            displayEmail: CROSSDECK_EXPERIENCE_EMAIL,
            isPrimary: true,
            verificationState: "VERIFIED",
            verifiedAt: timestamp,
          },
        },
        credential: { create: { id: "00000000-0000-4000-8000-00000000cd26", passwordHash } },
      },
    });
    await tx.chronicle.create({
      data: {
        id: STATIC_CHRONICLE_ID,
        slug: snapshot.tale.slug,
        title: snapshot.tale.title,
        subtitle: snapshot.tale.subtitle,
        creatorId: STATIC_PROFILE_ID,
        creatorAccountId: STATIC_ACCOUNT_ID,
        status: "PUBLISHED",
        visibility: "PRIVATE",
      },
    });
    await tx.publishedTaleVersion.create({
      data: {
        id: STATIC_EDITION_ID,
        taleId: STATIC_CHRONICLE_ID,
        versionNumber: 1,
        versionLabel: "Synthetic closure v1",
        publishedBy: STATIC_ACCOUNT_ID,
        contentSnapshot,
        checksum: digest(contentSnapshot),
        publishedAt: timestamp,
      },
    });
    await tx.chronicle.update({
      where: { id: STATIC_CHRONICLE_ID },
      data: { latestPublishedVersionId: STATIC_EDITION_ID },
    });
    await tx.taleSession.create({
      data: {
        id: STATIC_VOYAGE_ID,
        taleId: STATIC_CHRONICLE_ID,
        publishedVersionId: STATIC_EDITION_ID,
        accessTokenHash: digest(`synthetic-crossdeck-experience:${STATIC_VOYAGE_ID}`),
        status: "ACTIVE",
        currentChapterId: chapterId,
        currentBlockId: activeId,
        currentSequence: 4,
        startedAt: timestamp,
        launchedAt: timestamp,
      },
    });
    await tx.playthroughMembership.create({
      data: {
        id: "00000000-0000-4000-8000-00000000cd1a",
        playthroughId: STATIC_VOYAGE_ID,
        playerProfileId: STATIC_PROFILE_ID,
        status: "ACTIVE_MEMBER",
        joinedAt: timestamp,
      },
    });
    const events = [
      { eventType: "blockEntered", payload: { blockId: activeId, chapterId } },
      { eventType: "landfallWorldspaceEntered", payload: { worldspaceId: "isles" } },
      { eventType: "landfallWaypointSelected", payload: { worldspaceId: "isles", waypointId: "isle-region" } },
      { eventType: "landfallRouteSelected", payload: { worldspaceId: "isles", routeId: "isle-route" } },
    ];
    await tx.taleSessionEvent.createMany({
      data: events.map((event, index) => ({
        id: `00000000-0000-4000-8000-00000000cd2${index}`,
        sessionId: STATIC_VOYAGE_ID,
        publishedVersionId: STATIC_EDITION_ID,
        blockId: activeId,
        sourceType: "progression",
        idempotencyKey: `crossdeck-experience:${STATIC_VOYAGE_ID}:${index + 1}`,
        sequence: index + 1,
        eventType: event.eventType,
        payload: JSON.stringify(event.payload),
        createdAt: timestamp,
      })),
    });
    await tx.revealState.createMany({
      data: [noteId, artifactId].map((contentKey, index) => ({
        id: `00000000-0000-4000-8000-00000000cd2${index + 4}`,
        playthroughId: STATIC_VOYAGE_ID,
        contentType: "BLOCK",
        contentKey,
        revealedByAccountId: STATIC_ACCOUNT_ID,
        revealedAt: timestamp,
      })),
    });
  });
  return identity;
}
