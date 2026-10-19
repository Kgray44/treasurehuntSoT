/** Public immutable synthetic editions, separate from all active private baselines. */
import { createHash } from "node:crypto";
import { db } from "../../src/lib/db";
import { getStudioTale } from "../../src/chronicle/studio-service";
import { snapshotFromStudio } from "../../src/chronicle/snapshot";
import { getPublicChroniclePreview } from "../../src/chronicle/public-preview";
import { loadTideglassPassageContext } from "../../src/tideglass/passage-service";
import { seedSextantResourceExperiences } from "./sextant-resource-fixtures";

const cases = [
  "catalog-default",
  "catalog-1280-no-preference",
  "catalog-1280-reduce",
  "catalog-390-no-preference",
  "catalog-390-reduce",
] as const;
type CatalogCase = (typeof cases)[number];
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
export async function seedSextantCatalogExperience(key: CatalogCase = "catalog-default") {
  if (!cases.includes(key)) throw new Error("SEXTANT_CATALOG_CASE_REFUSED");
  // Canonical guard runs before any inspection or writes. Each fixed case has
  // its own owner, separate Crew and two untouched private ACTIVE baselines.
  const resource = await seedSextantResourceExperiences(key);
  const id = `sextant-public-${key}`;
  const title = `Synthetic Sextant public course ${key}`;
  const versionIds = [`${id}-v1`, `${id}-v2`];
  const releaseNotes = ["The first fictional course.", "A clearer fictional course."];
  const owner = await db.playerProfile.findFirstOrThrow({ where: { accountId: resource.ownerId } });
  const source = snapshotFromStudio(await getStudioTale(resource.taleId));
  source.tale = {
    ...source.tale,
    id,
    slug: id,
    title,
    visibility: "PUBLIC",
    subtitle: "A fictional software-only course",
    shortDescription: "Compare public editions, then prepare a synthetic Voyage.",
    longDescription:
      "A fictional Chronicle for isolated browser validation. No real place, media or private story is included.",
    estimatedDuration: 15,
    playerCountMin: 1,
    playerCountMax: 4,
  };
  source.publishedAt = "2026-10-18T12:00:00.000Z";
  source.chapters[0].blocks[0].configuration.heading = "The public course";
  source.chapters[0].blocks[0].configuration.body = "The first fictional edition describes a safe software course.";
  const target = structuredClone(source);
  target.publishedAt = "2026-10-19T12:00:00.000Z";
  target.tale.subtitle = "A refined fictional software-only course";
  target.chapters[0].blocks[0].configuration.body = "The second fictional edition describes a clearer course.";
  const snapshots = [JSON.stringify(source), JSON.stringify(target)];
  const checksums = snapshots.map(digest);
  const metadata = {
    slug: id,
    title,
    creatorId: owner.id,
    creatorAccountId: resource.ownerId,
    status: "PUBLISHED",
    visibility: "PUBLIC",
    subtitle: target.tale.subtitle,
    shortDescription: target.tale.shortDescription,
    longDescription: target.tale.longDescription,
    estimatedDuration: 15,
    playerCountMin: 1,
    playerCountMax: 4,
    theme: target.tale.theme,
    coverAssetId: null,
    contentWarnings: target.tale.contentWarnings,
    featured: false,
    sortOrder: 0,
    archivedAt: null,
  };
  const existing = await db.chronicle.findUnique({
    where: { id },
    include: { versions: { orderBy: { versionNumber: "asc" } } },
  });
  if (!existing) {
    // All public rows are created together; collisions are retained, never upserted.
    if (
      (await db.chronicle.count({ where: { slug: id } })) ||
      (await db.publishedTaleVersion.count({ where: { id: { in: versionIds } } }))
    )
      throw new Error("SEXTANT_CATALOG_PARTIAL_FIXTURE_PRESERVED");
    await db.$transaction(async (tx) => {
      await tx.chronicle.create({
        data: {
          id,
          ...metadata,
        },
      });
      for (const [index, contentSnapshot] of snapshots.entries())
        await tx.publishedTaleVersion.create({
          data: {
            id: versionIds[index],
            taleId: id,
            versionNumber: index + 1,
            versionLabel: `${index + 1}.0.0`,
            publishedBy: owner.id,
            publishedByAccountId: resource.ownerId,
            contentSnapshot,
            checksum: checksums[index],
            publishedAt: new Date(index ? target.publishedAt : source.publishedAt),
            isCurrent: index === 1,
            releaseNotes: releaseNotes[index],
          },
        });
      await tx.chronicle.update({ where: { id }, data: { latestPublishedVersionId: versionIds[1] } });
    });
  }
  const actual = await db.chronicle.findUniqueOrThrow({
    where: { id },
    include: { versions: { orderBy: { versionNumber: "asc" } } },
  });
  if (
    (Object.keys(metadata) as Array<keyof typeof metadata>).some((key) => actual[key] !== metadata[key]) ||
    actual.latestPublishedVersionId !== versionIds[1] ||
    actual.versions.length !== 2 ||
    actual.versions.some(
      (v, i) =>
        v.id !== versionIds[i] ||
        v.taleId !== id ||
        v.schemaVersion !== 1 ||
        v.versionNumber !== i + 1 ||
        v.versionLabel !== `${i + 1}.0.0` ||
        v.releaseNotes !== releaseNotes[i] ||
        v.publishedAt.toISOString() !== (i ? target.publishedAt : source.publishedAt) ||
        v.publishedBy !== owner.id ||
        v.publishedByAccountId !== resource.ownerId ||
        v.checksum !== checksums[i] ||
        v.contentSnapshot !== snapshots[i] ||
        v.isCurrent !== (i === 1),
    )
  )
    throw new Error("SEXTANT_CATALOG_EXISTING_FIXTURE_MISMATCH");
  const preview = await getPublicChroniclePreview(id);
  const comparison = await loadTideglassPassageContext(id);
  if (
    !preview ||
    preview.communityHref ||
    preview.id !== id ||
    preview.version !== "2.0.0" ||
    comparison?.editions.length !== 2 ||
    comparison.recommendedEditionId !== versionIds[1]
  )
    throw new Error("SEXTANT_CATALOG_PUBLIC_PROJECTION_REFUSED");
  return {
    ...resource,
    publicTaleId: id,
    publicSlug: id,
    publicTitle: title,
    publicVersionIds: versionIds,
    publicChecksums: checksums,
  };
}
