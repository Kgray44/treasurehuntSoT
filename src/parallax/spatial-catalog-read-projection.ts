import { canonicalChecksum } from "@/drydock/canonical";
import { z } from "zod";
import { listCompatibleEnvironments } from "./environment-library-compatibility";
import {
  listOwnedSpatialCatalogSummaries,
  readOwnedSpatialCatalogItem,
  type IndexedSummary,
} from "./spatial-catalog-page-service";
import {
  buildSpatialContentCatalog,
  filterSpatialContentCatalog,
  type SpatialCatalogProviderEntry,
  type SpatialContentEntry,
  type SpatialContentKind,
} from "./spatial-content-catalog";
import { projectEnvironmentCatalog, type EnvironmentCatalogItem } from "./spatial-library-environment-catalog";
import { spatialElementCatalogEntries } from "./spatial-element-catalog-provider";
import { readInstalledSpatialCommunitySummaryPage } from "@/community/spatial-installed-catalog";
import { collectInstalledSpatialCatalogEntries } from "./spatial-installed-catalog-adapter";

export const compactCatalogQuerySchema = z.strictObject({
  kind: z.enum(["ASSETS", "ENVIRONMENTS", "SCENES", "EFFECTS", "COMPOSITIONS"]),
  search: z.string().max(200).default(""),
  collection: z.string().max(120).default(""),
  origin: z
    .enum(["ALL", "BUILT_IN", "MY_CREATIONS", "RECONSTRUCTED", "INSTALLED", "FAVORITES", "RECENTLY_USED", "IN_USE"])
    .default("ALL"),
  state: z.enum(["ACTIVE", "SAVED", "WORKING", "ARCHIVED"]).default("ACTIVE"),
  environmentId: z.string().max(128).optional(),
  sort: z.enum(["NAME", "RECENT"]).default("NAME"),
  limit: z.number().int().min(1).max(100).default(48),
  cursor: z.string().max(2048).optional(),
});
export type CompactCatalogQuery = z.input<typeof compactCatalogQuerySchema>;
export type CompactPreviewMark = { id: string; kind: string; x: number; z: number; width?: number; depth?: number };
export type CompactSpatialCatalogEntry = Omit<SpatialContentEntry, "scene" | "environment"> & {
  environmentId?: string | null;
  releaseCount?: number;
  previewMarks?: CompactPreviewMark[];
};
type IndexedEntry = { entry: CompactSpatialCatalogEntry; checksum: string };
const cursorSchema = z.strictObject({
  query: z.string(),
  snapshot: z.string(),
  offset: z.number().int().nonnegative(),
  seal: z.string(),
});

export class UnsupportedSpatialCatalogFilter extends Error {
  constructor() {
    super("Recently used and In use require canonical usage coverage across every provider.");
  }
}

function previewMarks(environment: EnvironmentCatalogItem): CompactPreviewMark[] {
  const preview = environment.preview;
  if (!preview) return [];
  if (preview.kind === "RICH_ROOM")
    return preview.room.features
      .filter((feature) => !["FLOOR", "CEILING", "WALL"].includes(feature.classification))
      .slice(0, 12)
      .map((feature) => ({
        id: feature.id,
        kind: feature.classification,
        x: feature.position.x,
        z: feature.position.z,
        width: feature.dimensions[0],
        depth: feature.dimensions[2],
      }));
  return preview.environment.fixtures.slice(0, 12).map((fixture) => ({
    id: fixture.id,
    kind: fixture.kind,
    x: fixture.position.x,
    z: fixture.position.z,
    width: fixture.size.x,
    depth: fixture.size.z,
  }));
}

function ownedEntry({ summary, searchText, checksum }: IndexedSummary): IndexedEntry {
  const composition = summary.kind === "COMPOSITIONS";
  const effect = summary.kind === "EFFECTS";
  return {
    checksum,
    entry: {
      id: `saved:${summary.id}`,
      kind: summary.kind,
      origin: summary.origin,
      name: summary.name,
      description:
        summary.description ||
        (effect
          ? "Reusable spatial effect."
          : composition
            ? "Creator-owned reusable composition."
            : "Creator-owned spatial Scene."),
      family:
        summary.kind === "ASSETS"
          ? "Saved asset"
          : effect
            ? "Spatial effect"
            : composition
              ? "Saved composition"
              : "Saved Scene",
      searchText,
      environmentId: summary.environmentId,
      environmentName: summary.environmentName ?? undefined,
      objectCount: summary.objectCount,
      includedElements: summary.includedElements,
      revision: summary.revision,
      saveState: summary.saveState,
      archived: summary.archived,
      favorite: summary.favorite,
      collection: summary.collection,
      updatedAt: summary.updatedAt,
      releaseCount: summary.releaseCount,
      previewMarks: summary.previewMarks,
    },
  };
}

function providerEntry(entry: SpatialContentEntry): IndexedEntry {
  const { scene: _scene, environment, ...compact } = entry;
  void _scene;
  const value: CompactSpatialCatalogEntry = {
    ...compact,
    ...(environment ? { environmentId: environment.id, previewMarks: previewMarks(environment) } : {}),
  };
  // No Environment record, room geometry, immutable capsule or selected Scene draft enters the page payload.
  return { entry: value, checksum: canonicalChecksum(value) };
}

function decodeCursor(raw: string) {
  try {
    const cursor = cursorSchema.parse(JSON.parse(Buffer.from(raw, "base64url").toString("utf8")));
    if (cursor.seal !== canonicalChecksum({ query: cursor.query, snapshot: cursor.snapshot, offset: cursor.offset }))
      throw new Error("invalid seal");
    return cursor;
  } catch {
    throw new Error("Spatial catalog cursor is invalid.");
  }
}

/** One global filter/sort/page over already authorized provider summaries. */
export function pageCompactSpatialCatalog(
  indexed: IndexedEntry[],
  rawQuery: CompactCatalogQuery,
  ownerAccountId: string,
) {
  const query = compactCatalogQuerySchema.parse(rawQuery);
  if (query.origin === "RECENTLY_USED" || query.origin === "IN_USE") throw new UnsupportedSpatialCatalogFilter();
  const { cursor: rawCursor, ...filter } = query;
  const ordered = [...indexed].sort((a, b) => a.entry.id.localeCompare(b.entry.id));
  const queryHash = canonicalChecksum({ ownerAccountId, filter });
  const snapshot = canonicalChecksum(ordered);
  const cursor = rawCursor ? decodeCursor(rawCursor) : null;
  if (cursor && (cursor.query !== queryHash || cursor.snapshot !== snapshot))
    throw new Error("Spatial catalog cursor is stale; restart browsing.");
  const matching = filterSpatialContentCatalog(
    ordered.map(({ entry }) => entry),
    query,
  );
  const availableCollections = [
    ...new Set(
      filterSpatialContentCatalog(
        ordered.map(({ entry }) => entry),
        { ...query, search: "", collection: "" },
      )
        .map((entry) => entry.collection)
        .filter((collection): collection is string => Boolean(collection?.trim())),
    ),
  ].sort((a, b) => a.localeCompare(b));
  const offset = cursor?.offset ?? 0;
  if (offset > matching.length) throw new Error("Spatial catalog cursor is invalid.");
  const nextOffset = offset + query.limit;
  const nextCursor =
    nextOffset < matching.length
      ? Buffer.from(
          JSON.stringify({
            query: queryHash,
            snapshot,
            offset: nextOffset,
            seal: canonicalChecksum({ query: queryHash, snapshot, offset: nextOffset }),
          }),
        ).toString("base64url")
      : null;
  const availableKinds: SpatialContentKind[] = [...new Set(ordered.map(({ entry }) => entry.kind))];
  const availableOrigins = [
    ...new Set(
      ordered.filter(({ entry }) => entry.kind === query.kind && !entry.archived).map(({ entry }) => entry.origin),
    ),
  ];
  return {
    items: matching.slice(offset, nextOffset),
    total: matching.length,
    nextCursor,
    availableKinds,
    availableOrigins,
    availableCollections,
  };
}

/** Uses existing canonical Environment and provider inputs; read-only and owner-scoped. */
export async function readCompactSpatialCatalogPage(
  ownerAccountId: string,
  query: CompactCatalogQuery,
  providerEntries: SpatialCatalogProviderEntry[] = [],
) {
  const environments = projectEnvironmentCatalog(await listCompatibleEnvironments(ownerAccountId));
  const names = Object.fromEntries(environments.map((environment) => [environment.id, environment.name]));
  const [owned, installed] = await Promise.all([
    listOwnedSpatialCatalogSummaries(ownerAccountId, names),
    collectInstalledSpatialCatalogEntries(ownerAccountId, readInstalledSpatialCommunitySummaryPage),
  ]);
  const installedIds = new Set(installed.map((entry) => entry.id));
  const providers = buildSpatialContentCatalog(
    [],
    environments.filter((environment) => !environment.readOnly),
    [...spatialElementCatalogEntries, ...providerEntries.filter((entry) => !installedIds.has(entry.id)), ...installed],
  );
  return pageCompactSpatialCatalog([...owned.map(ownedEntry), ...providers.map(providerEntry)], query, ownerAccountId);
}

/** Full, checked record only after selection; built-in presets remain client provider actions. */
export async function readExactSpatialCatalogItem(ownerAccountId: string, entryId: string) {
  if (entryId.startsWith("saved:")) {
    const record = await readOwnedSpatialCatalogItem(ownerAccountId, entryId.slice("saved:".length));
    if (!record) return null;
    if (!record.readOnly) return { kind: "SPATIAL" as const, record };
    const installed = await collectInstalledSpatialCatalogEntries(
      ownerAccountId,
      readInstalledSpatialCommunitySummaryPage,
    );
    const summary = installed.find((item) => item.id === entryId);
    return summary ? { kind: "SPATIAL" as const, record, summary } : null;
  }
  if (entryId.startsWith("environment:")) {
    const record = (await listCompatibleEnvironments(ownerAccountId)).find(
      (item) => item.id === entryId.slice("environment:".length),
    );
    if (!record) return null;
    if (!("readOnly" in record && record.readOnly)) return { kind: "ENVIRONMENT" as const, record };
    const installed = await collectInstalledSpatialCatalogEntries(
      ownerAccountId,
      readInstalledSpatialCommunitySummaryPage,
    );
    const summary = installed.find((item) => item.id === entryId);
    return summary ? { kind: "ENVIRONMENT" as const, record, summary } : null;
  }
  return null;
}
