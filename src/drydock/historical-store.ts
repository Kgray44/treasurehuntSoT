import { parsePublishedSnapshot } from "@/chronicle/publishing";
import { assessDrydockCompatibility, migrationPreviewForHistoricalSnapshot } from "@/drydock/compatibility";
import { db } from "@/lib/db";

export async function inspectHistoricalDrydockCompatibility(taleId: string, versionId: string) {
  const version = await db.publishedTaleVersion.findFirst({
    where: { id: versionId, taleId },
    select: { contentSnapshot: true },
  });
  if (!version) return null;
  const snapshot = parsePublishedSnapshot(version.contentSnapshot);
  return {
    compatibility: assessDrydockCompatibility(snapshot),
    migrationPreview: migrationPreviewForHistoricalSnapshot(snapshot),
  };
}
