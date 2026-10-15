import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { canonicalChecksum } from "@/drydock/canonical";
import { draftSchema } from "./authoring";
import { environmentReferenceSchema } from "./environment-reference";
import { studioContentSchema } from "./studio-contracts";
import { librarySaveState } from "./library-lifecycle-contracts";
import { spatialItemKind, type SpatialLibraryRecord } from "./library-service";
import type { SpatialVersion } from "./contracts";
import type { SpatialReleaseIndexEntry } from "./library-release-index";

export type SpatialReferenceUse = { definitionId: string; versionId: string | null; at: string | null };

/** Read-model references only. Full immutable content is still verified before opening or using it. */
export function spatialContentReferences(content: {
  environment?: SpatialVersion["environment"];
  studio?: Pick<NonNullable<SpatialVersion["studio"]>, "environmentBinding" | "assetInstances">;
}): SpatialReferenceUse[] {
  const pin = content.environment;
  const source = content.studio?.environmentBinding;
  return [
    ...(content.studio?.assetInstances ?? []).map((instance) => ({
      definitionId: instance.definitionId,
      versionId: instance.versionId,
      at: instance.insertedAt ?? null,
    })),
    ...(pin
      ? [
          {
            definitionId: pin.environmentId,
            versionId: pin.versionId,
            at:
              source?.definitionId === pin.environmentId &&
              source.versionId === pin.versionId &&
              source.checksum === pin.checksum
                ? source.usedAt
                : null,
          },
        ]
      : source
        ? [{ definitionId: source.definitionId, versionId: source.versionId, at: source.usedAt }]
        : []),
  ];
}

const metadataSchema = z.object({
  definitionId: z.string(),
  ownerPersonId: z.string(),
  versionId: z.string(),
  checksum: z.string().regex(/^[a-f0-9]{64}$/),
  semanticVersion: z.string().min(1).max(64),
  notes: z.string().max(1000).nullable(),
  environment: environmentReferenceSchema.nullable(),
  environmentBinding: studioContentSchema.shape.environmentBinding.unwrap().nullable(),
  assetInstances: studioContentSchema.shape.assetInstances.unwrap().nullable(),
});
type ReleaseProjection = {
  id: string;
  itemId: string;
  versionNumber: number;
  checksum: string;
  createdAt: Date | string | number;
  metadata: unknown;
};

/**
 * Studio bootstrap retains working documents, but never selects complete release envelopes.
 * JSON extraction is supported by both repository databases (SQLite and MySQL). Pages bound
 * transient release metadata; no migration, persisted cache or second authority is introduced.
 */
export async function listSpatialBootstrapItems(ownerAccountId: string) {
  const rows = await db.reusableAuthoringItem.findMany({
    where: { ownerAccountId, kind: spatialItemKind },
    orderBy: { updatedAt: "desc" },
    include: {
      versions: { where: { versionNumber: 0 } },
      _count: { select: { usages: true } },
    },
  });
  const items: SpatialLibraryRecord[] = [];
  for (const row of rows) {
    const working = row.versions.find((version) => version.versionNumber === 0);
    if (!working) throw new Error("Spatial draft integrity could not be verified.");
    const envelope: unknown = JSON.parse(working.envelope);
    if (
      envelope &&
      typeof envelope === "object" &&
      "format" in envelope &&
      envelope.format === "PARALLAX_ENVIRONMENT_DRAFT_1"
    )
      continue;
    if (canonicalChecksum(envelope) !== working.checksum)
      throw new Error("Spatial draft integrity could not be verified.");
    const draft = draftSchema.parse(envelope);
    if (draft.content.definitionId !== row.id) throw new Error("Spatial definition binding is invalid.");
    items.push({
      id: row.id,
      revision: row.currentVersionNumber,
      draft,
      releases: [],
      releasesState: "INDEX_ONLY",
      releaseIndex: [],
      releaseMetadata: [],
      usageCount: row._count.usages,
      updatedAt: row.updatedAt.toISOString(),
      saveState: librarySaveState(row.status, false),
      archived: Boolean(row.archivedAt),
      readOnly: row.status === "INSTALLED_READ_ONLY",
    });
  }
  const byId = new Map(items.map((item) => [item.id, item]));
  const statuses = new Map(rows.map((row) => [row.id, row.status]));
  const bindings = new Map<string, SpatialReferenceUse[]>();
  const ordinals = new Map<string, number>();
  let after = "";
  for (;;) {
    const page = await db.$queryRaw<ReleaseProjection[]>(Prisma.sql`
      SELECT v.id, v.itemId, v.versionNumber, v.checksum, v.createdAt,
        JSON_OBJECT(
          'definitionId', JSON_EXTRACT(v.envelope, '$.definition.id'),
          'ownerPersonId', JSON_EXTRACT(v.envelope, '$.definition.ownerPersonId'),
          'versionId', JSON_EXTRACT(v.envelope, '$.version.id'),
          'checksum', JSON_EXTRACT(v.envelope, '$.version.checksum'),
          'semanticVersion', JSON_EXTRACT(v.envelope, '$.version.semanticVersion'),
          'notes', JSON_EXTRACT(v.envelope, '$.version.studio.releaseNotes'),
          'environment', JSON_EXTRACT(v.envelope, '$.version.environment'),
          'environmentBinding', JSON_EXTRACT(v.envelope, '$.version.studio.environmentBinding'),
          'assetInstances', JSON_EXTRACT(v.envelope, '$.version.studio.assetInstances')
        ) AS metadata
      FROM ReusableAuthoringItemVersion v
      INNER JOIN ReusableAuthoringItem i ON i.id = v.itemId
      WHERE i.ownerAccountId = ${ownerAccountId} AND i.kind = ${spatialItemKind}
        AND v.versionNumber > 0 AND v.id > ${after}
      ORDER BY v.id ASC LIMIT 256
    `);
    for (const row of page) {
      const item = byId.get(row.itemId);
      if (!item) continue; // Rich Environment releases belong to the existing Environment reader.
      const meta = metadataSchema.parse(typeof row.metadata === "string" ? JSON.parse(row.metadata) : row.metadata);
      if (
        meta.definitionId !== item.id ||
        meta.ownerPersonId !== ownerAccountId ||
        meta.versionId !== row.id ||
        meta.checksum !== row.checksum
      )
        throw new Error("Spatial Library version binding is invalid.");
      const entry: SpatialReleaseIndexEntry = {
        id: row.id,
        semanticVersion: meta.semanticVersion,
        checksum: row.checksum,
        createdAt: new Date(row.createdAt).toISOString(),
        notes: meta.notes ?? "",
        usageCount: 0,
      };
      item.releaseIndex!.push(entry);
      ordinals.set(row.id, row.versionNumber);
      const references = spatialContentReferences({
        ...(meta.environment ? { environment: meta.environment } : {}),
        studio: {
          environmentBinding: meta.environmentBinding ?? undefined,
          assetInstances: meta.assetInstances ?? undefined,
        },
      });
      const historical = bindings.get(item.id) ?? [];
      historical.push(...references);
      bindings.set(item.id, historical);
    }
    if (page.length < 256) break;
    after = page[page.length - 1].id;
  }
  for (const item of items) {
    item.releaseIndex!.sort((a, b) => ordinals.get(b.id)! - ordinals.get(a.id)!);
    item.saveState = librarySaveState(statuses.get(item.id)!, item.releaseIndex!.length > 0);
  }
  return { items, releaseBindings: bindings };
}
