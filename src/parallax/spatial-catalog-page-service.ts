import { db } from "@/lib/db";
import { canonicalChecksum } from "@/drydock/canonical";
import { z } from "zod";
import { draftSchema, type SpatialDraft } from "./authoring";
import { librarySaveState, type LibrarySaveState } from "./library-lifecycle-contracts";
import { spatialItemKind, type SpatialLibraryRecord } from "./library-service";
import { validateSpatialMoment } from "./publication";
import { spatialLibraryKind } from "./reusable-assets";

const pageQuerySchema = z.strictObject({
  kind: z.enum(["ASSETS", "SCENES", "COMPOSITIONS"]),
  search: z.string().max(200).default(""),
  origin: z.enum(["ALL", "MY_CREATIONS", "FAVORITES"]).default("ALL"),
  state: z.enum(["ACTIVE", "SAVED", "WORKING", "ARCHIVED"]).default("ACTIVE"),
  environmentId: z.string().max(128).optional(),
  sort: z.enum(["NAME", "RECENT"]).default("NAME"),
  limit: z.number().int().min(1).max(100).default(48),
  cursor: z.string().max(2048).optional(),
});
export type OwnedSpatialCatalogPageQuery = z.input<typeof pageQuerySchema>;
export type OwnedSpatialCatalogSummary = {
  id: string;
  kind: "ASSETS" | "SCENES" | "COMPOSITIONS";
  origin: "MY_CREATIONS";
  name: string;
  description: string;
  classification: string;
  tags: string[];
  collection: string;
  favorite: boolean;
  environmentId: string | null;
  environmentName: string | null;
  objectCount: number;
  includedElements: string[];
  revision: number;
  saveState: LibrarySaveState;
  archived: boolean;
  usageCount: number;
  releaseCount: number;
  updatedAt: string;
};
type IndexedSummary = { summary: OwnedSpatialCatalogSummary; searchText: string; checksum: string };
const cursorSchema = z.strictObject({
  query: z.string(),
  snapshot: z.string(),
  offset: z.number().int().nonnegative(),
  seal: z.string(),
});

function parseWorking(item: { id: string; versions: { envelope: string; checksum: string }[] }): SpatialDraft | null {
  const working = item.versions[0];
  if (!working) throw new Error("Spatial draft integrity could not be verified.");
  const envelope: unknown = JSON.parse(working.envelope);
  if (
    typeof envelope === "object" &&
    envelope !== null &&
    "format" in envelope &&
    envelope.format === "PARALLAX_ENVIRONMENT_DRAFT_1"
  )
    return null; // Existing Environment inventory owns this legacy representation.
  if (canonicalChecksum(envelope) !== working.checksum)
    throw new Error("Spatial draft integrity could not be verified.");
  const draft = draftSchema.parse(envelope);
  if (draft.content.definitionId !== item.id) throw new Error("Spatial definition binding is invalid.");
  return draft;
}

function kindOf(draft: SpatialDraft): OwnedSpatialCatalogSummary["kind"] {
  const type = spatialLibraryKind(draft);
  if (type === "ASSETS") return "ASSETS";
  if (type === "ASSEMBLIES" || (draft.category === "SCENE_TEMPLATE" && draft.tags.includes("composition")))
    return "COMPOSITIONS";
  return "SCENES";
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

/** Summary projection over canonical owner records. All filters run before page slicing. */
export async function pageOwnedSpatialCatalog(
  ownerAccountId: string,
  rawQuery: OwnedSpatialCatalogPageQuery,
  environmentNames: Readonly<Record<string, string>> = {},
) {
  const query = pageQuerySchema.parse(rawQuery);
  const { cursor: rawCursor, ...filter } = query;
  const items = await db.reusableAuthoringItem.findMany({
    where: { ownerAccountId, kind: spatialItemKind },
    select: {
      id: true,
      currentVersionNumber: true,
      status: true,
      archivedAt: true,
      updatedAt: true,
      versions: { where: { versionNumber: 0 }, select: { envelope: true, checksum: true } },
      _count: { select: { versions: true, usages: true } },
    },
  });
  const indexed: IndexedSummary[] = items.flatMap((item) => {
    const draft = parseWorking(item);
    if (!draft) return [];
    const kind = kindOf(draft);
    const description = draft.library?.description || draft.content.studio?.libraryDefinition?.description || "";
    const classification = draft.content.studio?.libraryDefinition?.classification ?? "";
    const environmentId =
      draft.content.environment?.environmentId ?? draft.content.studio?.environmentBinding?.definitionId ?? null;
    const summary: OwnedSpatialCatalogSummary = {
      id: item.id,
      kind,
      origin: "MY_CREATIONS",
      name: draft.content.title,
      description,
      classification,
      tags: draft.tags,
      collection: draft.collection,
      favorite: draft.favorite,
      environmentId,
      environmentName: environmentId ? (environmentNames[environmentId] ?? null) : null,
      objectCount: draft.content.entities.length,
      includedElements: kind === "COMPOSITIONS" ? draft.content.entities.map((entity) => entity.name) : [],
      revision: item.currentVersionNumber,
      saveState: librarySaveState(item.status, item._count.versions > 1),
      archived: Boolean(item.archivedAt),
      usageCount: item._count.usages,
      releaseCount: Math.max(0, item._count.versions - 1),
      updatedAt: item.updatedAt.toISOString(),
    };
    return [
      {
        summary,
        searchText: [
          summary.name,
          description,
          classification,
          summary.collection,
          environmentId,
          summary.environmentName,
          ...draft.tags,
        ]
          .filter(Boolean)
          .join(" ")
          .toLocaleLowerCase(),
        checksum: item.versions[0].checksum,
      },
    ];
  });
  indexed.sort((a, b) => a.summary.id.localeCompare(b.summary.id));
  const snapshot = canonicalChecksum(
    indexed.map(({ summary, searchText, checksum }) => ({ summary, searchText, checksum })),
  );
  const queryHash = canonicalChecksum(filter);
  const cursor = rawCursor ? decodeCursor(rawCursor) : null;
  if (cursor && (cursor.query !== queryHash || cursor.snapshot !== snapshot))
    throw new Error("Spatial catalog cursor is stale; restart browsing.");
  const search = query.search.trim().toLocaleLowerCase();
  const matching = indexed
    .map(({ summary, searchText }) => ({ summary, searchText }))
    .filter(({ summary }) => summary.kind === query.kind)
    .filter(({ summary }) => (query.state === "ARCHIVED" ? summary.archived : !summary.archived))
    .filter(({ summary }) =>
      query.state === "SAVED"
        ? summary.saveState === "SAVED"
        : query.state === "WORKING"
          ? summary.saveState !== "SAVED"
          : true,
    )
    .filter(({ summary }) => query.origin !== "FAVORITES" || summary.favorite)
    .filter(
      ({ summary }) => !query.environmentId || query.kind !== "SCENES" || summary.environmentId === query.environmentId,
    )
    .filter(({ searchText }) => !search || searchText.includes(search))
    .sort((a, b) =>
      query.sort === "RECENT"
        ? b.summary.updatedAt.localeCompare(a.summary.updatedAt) || a.summary.id.localeCompare(b.summary.id)
        : a.summary.name.localeCompare(b.summary.name) || a.summary.id.localeCompare(b.summary.id),
    );
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
  return {
    items: matching.slice(offset, nextOffset).map(({ summary }) => summary),
    total: matching.length,
    nextCursor,
  };
}

/** Exact owner-scoped read for selection; canonical mutation and CAS remain in the library service. */
export async function readOwnedSpatialCatalogItem(
  ownerAccountId: string,
  itemId: string,
): Promise<SpatialLibraryRecord | null> {
  const item = await db.reusableAuthoringItem.findFirst({
    where: { id: itemId, ownerAccountId, kind: spatialItemKind },
    include: { versions: { orderBy: { versionNumber: "desc" } }, _count: { select: { usages: true } } },
  });
  if (!item) return null;
  const working = item.versions.find((version) => version.versionNumber === 0);
  if (!working) throw new Error("Spatial draft integrity could not be verified.");
  const draft = parseWorking({ id: item.id, versions: [working] });
  if (!draft) return null;
  const releases = item.versions
    .filter((version) => version.versionNumber > 0)
    .map((version) => {
      const moment = validateSpatialMoment(JSON.parse(version.envelope));
      if (
        moment.definition.id !== item.id ||
        moment.definition.ownerPersonId !== ownerAccountId ||
        moment.version.checksum !== version.checksum ||
        moment.version.id !== version.id
      )
        throw new Error("Spatial Library version binding is invalid.");
      return {
        version: moment.version,
        metadata: {
          id: version.id,
          createdAt: version.createdAt.toISOString(),
          notes: moment.version.studio?.releaseNotes ?? "",
          usageCount: 0,
        },
      };
    });
  return {
    id: item.id,
    revision: item.currentVersionNumber,
    draft,
    releases: releases.map(({ version }) => version),
    usageCount: item._count.usages,
    updatedAt: item.updatedAt.toISOString(),
    saveState: librarySaveState(item.status, releases.length > 0),
    archived: Boolean(item.archivedAt),
    releaseMetadata: releases.map(({ metadata }) => metadata),
  };
}
