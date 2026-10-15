import type { SpatialLibraryRecord } from "./library-service";
import type { EnvironmentRecord } from "./environment-contracts";
import { presetNames } from "./authoring";
import { spatialCatalog } from "./element-authoring";

export type LibraryKind = "ASSETS" | "ENVIRONMENTS" | "SCENES" | "EFFECTS" | "COMPOSITIONS";
export type LibraryOrigin = "BUILT_IN" | "MY_CREATIONS" | "RECONSTRUCTED";
export type LibraryEntry = {
  id: string;
  kind: LibraryKind;
  origin: LibraryOrigin;
  name: string;
  description: string;
  searchText: string;
  family: string;
  thumbnail?: string;
  preset?: string;
  record?: SpatialLibraryRecord;
  environment?: EnvironmentRecord;
  environmentName?: string;
  objectCount?: number;
  revision?: number;
  updatedAt?: string;
  favorite?: boolean;
  collection?: string;
  blocked?: string;
  dimensions?: readonly [number, number, number];
  support?: "FLOOR" | "TABLE" | "WALL";
  includedElements?: string[];
};

const entry = (value: Omit<LibraryEntry, "searchText">): LibraryEntry => ({
  ...value,
  searchText: [value.name, value.description, value.family, value.environmentName, value.collection]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase(),
});

export function buildSpatialLibrary(items: SpatialLibraryRecord[], environments: EnvironmentRecord[]): LibraryEntry[] {
  const environmentNames = new Map(
    environments.map((environment) => [environment.id, environment.current.content.name]),
  );
  const assets = spatialCatalog.map((asset) => {
    const kind: LibraryKind =
      asset.type === "PHYSICAL_ASSET" ? "ASSETS" : asset.type === "COMPOSITION" ? "COMPOSITIONS" : "EFFECTS";
    return entry({
      id: `catalog:${asset.id}`,
      kind,
      origin: "BUILT_IN",
      name: asset.name,
      description: asset.description,
      family: asset.family,
      thumbnail: asset.thumbnail ?? undefined,
      preset: `sc02:${asset.id}`,
      blocked: "visualBlocker" in asset ? asset.visualBlocker : undefined,
      dimensions: "dimensions" in asset ? asset.dimensions : undefined,
      support: "support" in asset ? asset.support : undefined,
    });
  });
  const classics = presetNames.map((name) =>
    entry({
      id: `classic:${name}`,
      kind: "ASSETS",
      origin: "BUILT_IN",
      name,
      description: "Classic spatial preset. Adds editable objects to the active Scene.",
      family: "Classic presets",
      preset: name,
    }),
  );
  const places = environments.map((environment) => {
    const content = environment.current.content;
    return entry({
      id: `environment:${environment.id}`,
      kind: "ENVIRONMENTS",
      origin: environment.builtin ? "BUILT_IN" : content.origin === "RECONSTRUCTED" ? "RECONSTRUCTED" : "MY_CREATIONS",
      name: content.name,
      description: content.description,
      family: content.origin === "RECONSTRUCTED" ? "From Photos" : environment.builtin ? "Built-in" : "Authored",
      environment,
      revision: environment.current.reference.revision,
    });
  });
  const saved = items.map((record) => {
    const draft = record.draft;
    const composition = draft.category === "SCENE_TEMPLATE" && draft.tags.includes("composition");
    const environmentName = draft.content.environment
      ? (environmentNames.get(draft.content.environment.environmentId) ?? "Environment unavailable")
      : undefined;
    return entry({
      id: `saved:${record.id}`,
      kind: composition ? "COMPOSITIONS" : "SCENES",
      origin: "MY_CREATIONS",
      name: draft.content.title,
      description:
        draft.content.sceneDescription ||
        (composition ? "Saved reusable group of editable spatial elements." : "Creator-owned spatial Scene."),
      family: composition ? "Saved composition" : "Saved Scene",
      record,
      environmentName,
      objectCount: draft.content.entities.length,
      revision: record.revision,
      updatedAt: record.updatedAt,
      favorite: draft.favorite,
      collection: draft.collection,
      includedElements: composition ? draft.content.entities.map((entity) => entity.name) : undefined,
    });
  });
  return [...assets, ...classics, ...places, ...saved];
}

export type LibraryQuery = {
  kind: LibraryKind;
  search: string;
  origin: "ALL" | LibraryOrigin | "FAVORITES";
  environmentId?: string;
  sort: "NAME" | "RECENT";
};

export function filterSpatialLibrary(entries: LibraryEntry[], query: LibraryQuery): LibraryEntry[] {
  const search = query.search.trim().toLocaleLowerCase();
  return entries
    .filter((item) => item.kind === query.kind)
    .filter((item) => !search || item.searchText.includes(search))
    .filter((item) =>
      query.origin === "ALL" ? true : query.origin === "FAVORITES" ? item.favorite : item.origin === query.origin,
    )
    .filter((item) =>
      query.kind !== "SCENES" || !query.environmentId
        ? true
        : item.record?.draft.content.environment?.environmentId === query.environmentId,
    )
    .sort((a, b) =>
      query.sort === "RECENT" && a.updatedAt && b.updatedAt
        ? b.updatedAt.localeCompare(a.updatedAt) || a.name.localeCompare(b.name)
        : a.name.localeCompare(b.name),
    );
}
