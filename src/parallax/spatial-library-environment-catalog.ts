import type { CompatibleEnvironmentRecord } from "./environment-library-compatibility";
import type { RoomEnvironment } from "./environment-contracts";
import type { EnvironmentReference } from "./environment-reference";
import type { EnvironmentContent as LegacyEnvironmentContent } from "./legacy-scene-environment-contracts";

export type EnvironmentCatalogPreview =
  | { kind: "RICH_ROOM"; room: RoomEnvironment }
  | { kind: "LEGACY_FIXTURES"; environment: LegacyEnvironmentContent }
  | null;

/** Read-only Library metadata. The record remains the authority for every action. */
export type EnvironmentCatalogItem = {
  id: string;
  record: CompatibleEnvironmentRecord;
  name: string;
  description: string;
  origin: "BUILT_IN" | "MY_CREATIONS" | "RECONSTRUCTED";
  saveState: CompatibleEnvironmentRecord["saveState"];
  archived: boolean;
  workingRevision: number | null;
  immutableVersions: EnvironmentReference[];
  collection: string | null;
  favorite: boolean | null;
  updatedAt: string | null;
  widthMeters: number | null;
  depthMeters: number | null;
  authoredFeatureCount: number | null;
  preview: EnvironmentCatalogPreview;
  searchText: string;
};

/** Never synthesizes a current pin, Library membership, or rich geometry for legacy records. */
export function projectEnvironmentForSpatialLibrary(record: CompatibleEnvironmentRecord): EnvironmentCatalogItem {
  const immutableVersions = record.versions.map((version) => version.reference);
  if (record.representation === "LIFECYCLE_V1") {
    const working = record.working;
    const room = working.room;
    const origin =
      working.category === "RECONSTRUCTED" || room?.origin === "PHOTO_RECONSTRUCTION"
        ? "RECONSTRUCTED"
        : "MY_CREATIONS";
    const searchText = [working.name, working.description, working.category, working.collection, ...working.tags]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase();
    return {
      id: record.id,
      record,
      name: working.name,
      description: working.description,
      origin,
      saveState: record.saveState,
      archived: record.archived,
      workingRevision: record.revision,
      immutableVersions,
      collection: working.collection,
      favorite: working.favorite,
      updatedAt: record.lifecycle.updatedAt,
      widthMeters: room?.width ?? null,
      depthMeters: room?.depth ?? null,
      authoredFeatureCount: room?.features.length ?? null,
      preview: room ? { kind: "RICH_ROOM", room } : null,
      searchText,
    };
  }

  const latest = record.versions.reduce<(typeof record.versions)[number] | null>(
    (best, version) => (!best || version.reference.revision > best.reference.revision ? version : best),
    null,
  );
  const content = latest?.content;
  const origin = record.builtin
    ? "BUILT_IN"
    : content?.origin === "RECONSTRUCTED"
      ? "RECONSTRUCTED"
      : "MY_CREATIONS";
  return {
    id: record.id,
    record,
    name: content?.name ?? record.id,
    description: content?.description ?? "",
    origin,
    saveState: record.saveState,
    archived: record.archived,
    workingRevision: null,
    immutableVersions,
    collection: null,
    favorite: null,
    updatedAt: null,
    widthMeters: content?.width ?? null,
    depthMeters: content?.depth ?? null,
    authoredFeatureCount: content?.fixtures.length ?? null,
    preview: content ? { kind: "LEGACY_FIXTURES", environment: content } : null,
    searchText: [content?.name ?? record.id, content?.description, content?.origin]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase(),
  };
}

export function projectEnvironmentCatalog(records: CompatibleEnvironmentRecord[]): EnvironmentCatalogItem[] {
  return records.map(projectEnvironmentForSpatialLibrary);
}
