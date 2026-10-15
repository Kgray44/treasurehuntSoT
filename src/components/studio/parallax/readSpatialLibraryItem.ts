import type { SpatialLibraryRecord } from "@/parallax/library-service";
import { spatialReleaseIndex } from "@/parallax/library-release-index";

/** Exact selection port; bootstrap indexes are never treated as full release snapshots. */
export async function readSpatialLibraryItem(id: string, indexed?: SpatialLibraryRecord) {
  const response = await fetch(`/api/studio/parallax?view=library-item&entryId=${encodeURIComponent(`saved:${id}`)}`, {
    cache: "no-store",
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "This Library item could not load. Try again.");
  if (
    data.kind !== "SPATIAL" ||
    data.record?.id !== id ||
    data.record.releasesState === "INDEX_ONLY" ||
    !Array.isArray(data.record.releases)
  )
    throw new Error("This Library item is unavailable.");
  const record = data.record as SpatialLibraryRecord;
  if (indexed?.id === id) {
    if (indexed.revision !== record.revision)
      throw new Error("This Scene changed while its versions were loading. Refresh its Library entry and try again.");
    const index = new Map(spatialReleaseIndex(indexed).map((version) => [version.id, version]));
    if (
      record.releases.length !== index.size ||
      record.releases.some((version) => index.get(version.id)?.checksum !== version.checksum)
    )
      throw new Error("This version does not match its immutable Library pin.");
    // Hydration supplies snapshots only; it must never adopt a newer working draft or CAS revision.
    return {
      ...indexed,
      releasesState: "LOADED" as const,
      releases: record.releases,
      releaseMetadata: record.releaseMetadata?.map((version) => ({
        ...version,
        usageCount: index.get(version.id)?.usageCount ?? version.usageCount,
      })),
    };
  }
  return record;
}
