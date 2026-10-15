import type { SpatialLibraryRecord } from "./library-service";
import { presetNames } from "./authoring";
import { spatialLibraryKind } from "./reusable-assets";
import type { EnvironmentCatalogItem } from "./spatial-library-environment-catalog";

export type SpatialContentKind = "ASSETS" | "ENVIRONMENTS" | "SCENES" | "EFFECTS" | "COMPOSITIONS";
export type SpatialContentOrigin = "BUILT_IN" | "MY_CREATIONS" | "RECONSTRUCTED" | "INSTALLED";
export type SpatialContentEntry = {
  id: string;
  kind: SpatialContentKind;
  origin: SpatialContentOrigin;
  name: string;
  description: string;
  family: string;
  searchText: string;
  thumbnail?: string;
  preset?: string;
  blocked?: string;
  scene?: SpatialLibraryRecord;
  environment?: EnvironmentCatalogItem;
  environmentName?: string;
  objectCount?: number;
  includedElements?: string[];
  revision?: number | null;
  saveState?: string | null;
  archived?: boolean;
  favorite?: boolean | null;
  collection?: string | null;
  usageCount?: number;
  updatedAt?: string | null;
  lastUsedAt?: string | null;
  dimensions?: readonly [number, number, number];
  support?: "FLOOR" | "TABLE" | "WALL";
};

/** Root release pins win; the editor binding is identity for display only, never a synthetic pin. */
export function sceneEnvironmentIdentity(record: SpatialLibraryRecord): string | null {
  return (
    record.draft.content.environment?.environmentId ??
    record.draft.content.studio?.environmentBinding?.definitionId ??
    null
  );
}

export type SpatialCatalogProviderEntry = Omit<SpatialContentEntry, "searchText" | "scene" | "environment">;

const classicDescriptions: Record<(typeof presetNames)[number] | "Exclusion Zone", string> = {
  "Desk Map": "An editable parchment map for a clue or route.",
  "Peeking Letter": "An editable letter that reveals its clue when inspected.",
  "Hidden Wall Message": "A wall-attached message with a reveal interaction.",
  "Ghost Footprint Trail": "A reusable trail of five editable footprint markers.",
  "Floating Compass": "A floating compass marker for spatial guidance.",
  "Exclusion Zone": "Reserve clear room space with a movable zone.",
};

function withSearch(value: Omit<SpatialContentEntry, "searchText">): SpatialContentEntry {
  return {
    ...value,
    searchText: [value.name, value.description, value.family, value.collection, value.environmentName]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase(),
  };
}

/** The Library is a view over owner records and implemented providers, never a second save authority. */
export function buildSpatialContentCatalog(
  scenes: SpatialLibraryRecord[],
  environments: EnvironmentCatalogItem[],
  providerEntries: SpatialCatalogProviderEntry[] = [],
): SpatialContentEntry[] {
  const environmentNames = new Map(environments.map((item) => [item.id, item.name]));
  const classics = [...presetNames, "Exclusion Zone" as const].map((name) =>
    withSearch({
      id: `classic:${name}`,
      kind: name === "Ghost Footprint Trail" ? "COMPOSITIONS" : "ASSETS",
      origin: "BUILT_IN",
      name,
      description: classicDescriptions[name],
      family:
        name === "Exclusion Zone" ? "Room tools" : name === "Ghost Footprint Trail" ? "Trails" : "Classic presets",
      preset: name,
      includedElements: name === "Ghost Footprint Trail" ? ["Five footprint markers"] : undefined,
    }),
  );
  const places = environments.map((environment) => ({
    ...withSearch({
      id: `environment:${environment.id}`,
      kind: "ENVIRONMENTS" as const,
      origin: environment.origin,
      name: environment.name,
      description: environment.description,
      family: environment.preview?.kind === "RICH_ROOM" ? "Spatial room" : "Legacy Environment",
      environment,
      revision: environment.workingRevision,
      saveState: environment.saveState,
      archived: environment.archived,
      favorite: environment.favorite,
      collection: environment.collection,
      usageCount:
        environment.record.representation === "LIFECYCLE_V1" ? environment.record.lifecycle.usageCount : undefined,
      updatedAt: environment.updatedAt,
      lastUsedAt: environment.record.representation === "LIFECYCLE_V1" ? environment.record.lifecycle.lastUsedAt : null,
    }),
    searchText: environment.searchText,
  }));
  const saved = scenes.map((record) => {
    const draft = record.draft;
    const type = spatialLibraryKind(draft);
    // Earlier extracted compositions inherited SCENE metadata from the draft
    // factory. Their explicit template category/marker still identifies them.
    const composition =
      type === "ASSEMBLIES" || (draft.category === "SCENE_TEMPLATE" && draft.tags.includes("composition"));
    const kind: SpatialContentKind = type === "ASSETS" ? "ASSETS" : composition ? "COMPOSITIONS" : "SCENES";
    const environmentId = sceneEnvironmentIdentity(record);
    const environmentName = environmentId
      ? (environmentNames.get(environmentId) ?? "Environment unavailable")
      : undefined;
    const description = draft.library?.description || draft.content.studio?.libraryDefinition?.description || "";
    return {
      ...withSearch({
        id: `saved:${record.id}`,
        kind,
        origin: "MY_CREATIONS",
        name: draft.content.title,
        description:
          description || (composition ? "Creator-owned reusable composition." : "Creator-owned spatial Scene."),
        family:
          type === "TEMPLATES"
            ? "Scene template"
            : kind === "ASSETS"
              ? "Saved asset"
              : composition
                ? "Saved composition"
                : "Saved Scene",
        scene: record,
        environmentName,
        objectCount: draft.content.entities.length,
        includedElements: composition ? draft.content.entities.map((entity) => entity.name) : undefined,
        revision: record.revision,
        saveState: record.saveState ?? (record.releases.length ? "SAVED" : "LEGACY_REVIEW"),
        archived: Boolean(record.archived),
        favorite: draft.favorite,
        collection: draft.collection,
        usageCount: record.usageCount,
        updatedAt: record.updatedAt,
        lastUsedAt: record.lastUsedAt,
      }),
      searchText: [
        draft.content.title,
        description,
        draft.content.studio?.libraryDefinition?.classification,
        environmentName,
        draft.collection,
        ...draft.tags,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase(),
    };
  });
  return [...providerEntries.map(withSearch), ...classics, ...places, ...saved];
}

export type SpatialCatalogQuery = {
  kind: SpatialContentKind;
  search: string;
  origin: "ALL" | SpatialContentOrigin | "FAVORITES" | "RECENTLY_USED" | "IN_USE";
  state: "ACTIVE" | "SAVED" | "WORKING" | "ARCHIVED";
  environmentId?: string;
  sort: "NAME" | "RECENT";
};

export function filterSpatialContentCatalog(entries: SpatialContentEntry[], query: SpatialCatalogQuery) {
  const search = query.search.trim().toLocaleLowerCase();
  return entries
    .filter((item) => item.kind === query.kind)
    .filter((item) => (query.state === "ARCHIVED" ? item.archived : !item.archived))
    .filter((item) =>
      query.state === "SAVED"
        ? item.saveState === "SAVED" || item.origin === "BUILT_IN"
        : query.state === "WORKING"
          ? item.saveState === "WORKING" || item.saveState === "LEGACY_REVIEW"
          : true,
    )
    .filter((item) => !search || item.searchText.includes(search))
    .filter((item) =>
      query.origin === "ALL"
        ? true
        : query.origin === "FAVORITES"
          ? item.favorite === true
          : query.origin === "RECENTLY_USED"
            ? Boolean(item.lastUsedAt)
            : query.origin === "IN_USE"
              ? (item.usageCount ?? 0) > 0
              : item.origin === query.origin,
    )
    .filter((item) =>
      query.kind !== "SCENES" || !query.environmentId
        ? true
        : item.scene && sceneEnvironmentIdentity(item.scene) === query.environmentId,
    )
    .sort((a, b) =>
      query.sort === "RECENT"
        ? (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "") || a.name.localeCompare(b.name)
        : a.name.localeCompare(b.name),
    );
}
