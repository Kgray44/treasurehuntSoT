import { db } from "@/lib/db";
import { parseReusableEnvelope } from "@/studio/reusable-content";

export async function isInstalledCommunityChronicle(
  taleId: string,
  client: Pick<typeof db, "communityInstallMapping"> = db,
) {
  return Boolean(
    await client.communityInstallMapping.findFirst({
      where: { sourceId: "chronicle", targetId: taleId, kind: "CHRONICLE" },
      select: { id: true },
    }),
  );
}

/** Owner-only projection of private Community copies, including their immutable release credit. */
export async function listCreatorInstalledCommunityItems(accountId: string) {
  const receipts = await db.communityInstallation.findMany({
    where: { accountId, mode: { in: ["LIBRARY_REFERENCE", "PRIVATE_COPY"] } },
    orderBy: { installedAt: "desc" },
    take: 50,
  });
  if (!receipts.length) return [];
  const [mappings, releases, packages] = await Promise.all([
    db.communityInstallMapping.findMany({
      where: {
        operationId: { in: receipts.map((receipt) => receipt.operationId) },
        sourceId: { in: ["creator-item", "chronicle"] },
      },
    }),
    db.communityRelease.findMany({ where: { id: { in: receipts.map((receipt) => receipt.releaseId) } } }),
    db.communityPackage.findMany({ where: { id: { in: receipts.map((receipt) => receipt.packageId) } } }),
  ]);
  const itemIds = mappings.filter((mapping) => mapping.sourceId === "creator-item").map((mapping) => mapping.targetId);
  const taleIds = mappings.filter((mapping) => mapping.sourceId === "chronicle").map((mapping) => mapping.targetId);
  const items = await db.reusableAuthoringItem.findMany({
    where: {
      id: { in: itemIds },
      ownerAccountId: accountId,
      status: "INSTALLED_READ_ONLY",
      archivedAt: null,
    },
    include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } },
  });
  const tales = await db.chronicle.findMany({
    where: { id: { in: taleIds }, creatorAccountId: accountId, visibility: "PRIVATE" },
    select: { id: true, title: true, forkedFromVersionId: true },
  });
  const byTale = new Map(tales.map((tale) => [tale.id, tale]));
  const byOperation = new Map(mappings.map((mapping) => [mapping.operationId, mapping]));
  const byItem = new Map(items.map((item) => [item.id, item]));
  const byRelease = new Map(releases.map((release) => [release.id, release]));
  const byPackage = new Map(packages.map((record) => [record.id, record]));
  return receipts.flatMap((receipt) => {
    const mapping = byOperation.get(receipt.operationId);
    const item = mapping ? byItem.get(mapping.targetId) : null;
    const version = item?.versions[0];
    const release = byRelease.get(receipt.releaseId);
    const record = byPackage.get(receipt.packageId);
    if (
      !release ||
      !record ||
      release.packageChecksum !== receipt.installedPackageChecksum ||
      record.releaseId !== release.id ||
      record.packageChecksum !== receipt.installedPackageChecksum
    )
      return [];
    try {
      const tale = mapping?.sourceId === "chronicle" ? byTale.get(mapping.targetId) : null;
      if (receipt.mode === "PRIVATE_COPY") {
        if (!tale || !tale.forkedFromVersionId || tale.forkedFromVersionId !== release.sourcePublishedTaleVersionId)
          return [];
      } else {
        if (!item || !version) return [];
        const envelope = parseReusableEnvelope(JSON.parse(version.envelope));
        if (
          envelope.itemId !== item.id ||
          envelope.versionId !== version.id ||
          envelope.ownerId !== accountId ||
          envelope.checksum !== version.checksum ||
          envelope.attribution.sourceReleaseId !== release.id
        )
          return [];
      }
      const target = tale
        ? { itemId: tale.id, kind: "CHRONICLE", name: tale.title, studioUrl: `/studio/tales/${tale.id}` }
        : item
          ? { itemId: item.id, kind: item.kind, name: item.name, studioUrl: null }
          : null;
      if (!target) return [];
      const license = JSON.parse(release.licenseSnapshot) as { key?: string; displayName?: string };
      const credits = JSON.parse(release.attributionSnapshot) as unknown;
      return [
        {
          ...target,
          releaseId: release.id,
          semanticVersion: release.semanticVersion,
          packageChecksum: receipt.installedPackageChecksum,
          licenseName: license.displayName || license.key || "Recorded license",
          credits: Array.isArray(credits)
            ? credits.flatMap((credit) =>
                credit &&
                typeof credit === "object" &&
                typeof (credit as { displayName?: unknown }).displayName === "string"
                  ? [(credit as { displayName: string }).displayName]
                  : [],
              )
            : [],
        },
      ];
    } catch {
      return [];
    }
  });
}
