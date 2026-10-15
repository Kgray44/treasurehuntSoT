import { createHash } from "node:crypto";
import { db } from "../../../src/lib/db";
import type { PublishedTaleSnapshot } from "../../../src/chronicle/types";
import { syntheticSpatialMoment } from "../../../src/parallax/fixtures";
import { closureAccount, closureVoyage } from "./landfall-closure";
import { ensureGenericSoundingLineIsolation } from "./sounding-line-isolation";

/** Persisted private synthetic edition. Never operates against the shared developer database. */
export async function createCrossdeckRefitFixture() {
  if (process.env.SOUNDING_LINE_SUITE_PROFILE !== "generic" || process.env.FOREVER_VALIDATION_ISOLATION !== "1")
    throw new Error("CROSSDECK_OWNED_DATABASE_REQUIRED");
  ensureGenericSoundingLineIsolation();
  const account = await closureAccount("Crossdeck synthetic navigator");
  const voyage = await closureVoyage(account, account, "livingChart", { virtual: true, route: true });
  const edition = await db.publishedTaleVersion.findUniqueOrThrow({ where: { id: voyage.versionId } });
  const snapshot = JSON.parse(edition.contentSnapshot) as PublishedTaleSnapshot;
  snapshot.tale.title = "Synthetic Crossdeck refit Voyage";
  snapshot.tale.subtitle = "Lanterns across the tide";
  snapshot.chapters[0].title = "The island course";
  const active = snapshot.chapters[0].blocks[0];
  active.title = "The island course";
  active.configuration.heading = "Follow the lanterns";
  active.configuration.body =
    "The harbour falls quiet behind you. Across the tide, the island’s lanterns mark a course through the old gardens.\n\nKeep the Chart close. The Captain’s note carries your next bearing.";
  active.presentation = { spatialMoment: syntheticSpatialMoment(voyage.activeId) };
  const noteId = "note-" + voyage.id,
    artifactId = "artifact-" + voyage.id;
  const released = [
    {
      id: noteId,
      blockType: "captainsNote",
      title: "A letter from the Captain",
      configuration: {
        heading: "A bearing in the stars",
        body: "When the first lantern meets the northern light, follow the path into the garden. Keep this letter close; the same clue travels with you.",
        signature: "Your Captain",
      },
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
    },
  ];
  for (const [index, item] of released.entries())
    snapshot.chapters[0].blocks.push({
      ...item,
      chapterId: active.chapterId,
      presentation: {},
      completion: {},
      orderIndex: index + 2,
      isEnabled: true,
      nextBlockId: null,
      connections: [],
    });
  const contentSnapshot = JSON.stringify(snapshot);
  await db.publishedTaleVersion.update({
    where: { id: voyage.versionId },
    data: {
      contentSnapshot,
      checksum: createHash("sha256").update(contentSnapshot).digest("hex"),
    },
  });
  await db.chronicle.update({ where: { id: voyage.taleId }, data: { title: snapshot.tale.title } });
  await db.revealState.createMany({
    data: released.map((item) => ({
      playthroughId: voyage.id,
      contentType: "BLOCK",
      contentKey: item.id,
      revealedByAccountId: account.id,
    })),
  });
  return { account, voyage, noteId, artifactId };
}

export async function removeCrossdeckRefitFixture(fixture: Awaited<ReturnType<typeof createCrossdeckRefitFixture>>) {
  await db.chronicle.delete({ where: { id: fixture.voyage.taleId } });
  await db.userAccount.delete({ where: { id: fixture.account.id } });
}
