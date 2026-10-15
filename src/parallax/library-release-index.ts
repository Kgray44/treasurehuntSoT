import type { SpatialLibraryRecord } from "./library-service";

export type SpatialReleaseIndexEntry = {
  id: string;
  semanticVersion: string;
  checksum: string;
  createdAt: string;
  notes: string;
  usageCount: number;
};

/** INDEX_ONLY records contain no full snapshots; callers must hydrate before opening a version. */
export function spatialReleaseIndex(record: SpatialLibraryRecord): SpatialReleaseIndexEntry[] {
  if (record.releasesState === "INDEX_ONLY") return record.releaseIndex ?? [];
  return record.releases.map((version) => {
    const metadata = record.releaseMetadata?.find((entry) => entry.id === version.id);
    return {
      id: version.id,
      semanticVersion: version.semanticVersion,
      checksum: version.checksum,
      createdAt: metadata?.createdAt ?? record.updatedAt,
      notes: metadata?.notes ?? "",
      usageCount: metadata?.usageCount ?? 0,
    };
  });
}
