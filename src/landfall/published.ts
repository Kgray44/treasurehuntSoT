import { db } from "@/lib/db";
import { parsePublishedSnapshot } from "@/chronicle/publishing";
import type { LandfallDefinition } from "@/landfall/schema";

export type PinnedLandfallDefinition = Readonly<{
  sessionId: string;
  taleId: string;
  publishedVersionId: string;
  currentSequence: number;
  definition: LandfallDefinition;
}>;

/** Internal only. Callers must authorize the Tale Session before exposing any definition or projection. */
export async function loadPinnedLandfallDefinition(sessionId: string): Promise<PinnedLandfallDefinition | null> {
  const session = await db.taleSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      taleId: true,
      publishedVersionId: true,
      currentSequence: true,
      version: { select: { id: true, taleId: true, contentSnapshot: true } },
    },
  });
  if (!session?.publishedVersionId || !session.version) return null;
  if (session.version.id !== session.publishedVersionId || session.version.taleId !== session.taleId)
    throw new Error("LANDFALL_PINNED_VERSION_MISMATCH");
  const snapshot = parsePublishedSnapshot(session.version.contentSnapshot);
  if (!snapshot.landfall) return null;
  if (snapshot.landfall.taleId !== session.taleId || snapshot.tale.id !== session.taleId)
    throw new Error("LANDFALL_PINNED_TALE_MISMATCH");
  return {
    sessionId: session.id,
    taleId: session.taleId,
    publishedVersionId: session.publishedVersionId,
    currentSequence: session.currentSequence,
    definition: snapshot.landfall,
  };
}
