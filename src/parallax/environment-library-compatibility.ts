import { db } from "@/lib/db";
import type { PrismaClient } from "@prisma/client";
import { canonicalChecksum } from "@/drydock/canonical";
import { listEnvironmentDefinitions } from "./library-lifecycle-service";
import { environmentReleaseReference, checkedLegacyEnvironmentRelease } from "./environment-version-resolution";
import { environmentVersionSchema as legacyEnvironmentVersionSchema } from "./legacy-scene-environment-contracts";
import legacyBuiltins from "./builtin-environments.v1.json";
import { checkedLegacyEnvironmentWorking, legacyEnvironmentMembership } from "./legacy-environment-working-contracts";
import type { EnvironmentLibraryRecord } from "./library-lifecycle-contracts";

/** A catalog/Scene Manager projection, not a new persistence authority.
 * No `current` pin is supplied: selecting a release or a working snapshot is explicit.
 */
export async function listCompatibleEnvironments(
  accountId: string,
  store: PrismaClient = db,
  inventoryEnvironments?: EnvironmentLibraryRecord[],
) {
  const lifecycle = inventoryEnvironments ?? (await listEnvironmentDefinitions(accountId, store));
  const legacy = await store.reusableAuthoringItem.findMany({
    where: { ownerAccountId: accountId, kind: "PARALLAX_ENVIRONMENT" },
    include: { versions: { orderBy: { versionNumber: "desc" } } },
    orderBy: { updatedAt: "desc" },
  });
  return [
    ...lifecycle.map((record) => ({
      representation: "LIFECYCLE_V1" as const,
      id: record.id,
      builtin: false,
      ownerAccountId: accountId,
      revision: record.revision,
      saveState: record.saveState,
      archived: record.archived,
      working: record.draft,
      // Retain the complete ordinary record for working/legacy/archive discovery and Save As.
      lifecycle: record,
      versions: record.releases.map(({ checksum, usageCount: _count, ...value }) => {
        void _count;
        const row = {
          id: value.id,
          itemId: record.id,
          versionNumber: value.number,
          envelope: JSON.stringify(value),
          checksum,
        };
        return { reference: environmentReleaseReference(row), room: value.content.room };
      }),
    })),
    ...legacy.map((item) => {
      const workingRow = item.versions.find((row) => row.versionNumber === 0);
      return {
        representation: "SC01_SCHEMA1" as const,
        id: item.id,
        builtin: false,
        ownerAccountId: accountId,
        revision: item.currentVersionNumber,
        saveState: legacyEnvironmentMembership(item.status),
        archived: Boolean(item.archivedAt),
        working: workingRow ? checkedLegacyEnvironmentWorking(workingRow, item.id) : null,
        versions: item.versions
          .filter((row) => row.versionNumber > 0)
          .map((row) => checkedLegacyEnvironmentRelease(row, item.id)),
      };
    }),
    ...legacyBuiltins.map((raw) => {
      const version = legacyEnvironmentVersionSchema.parse(raw);
      if (canonicalChecksum(version.content) !== version.reference.checksum)
        throw new Error("Built-in Environment integrity failed.");
      return {
        representation: "SC01_SCHEMA1" as const,
        id: version.reference.environmentId,
        builtin: true,
        ownerAccountId: null,
        revision: null,
        saveState: null,
        archived: false,
        working: null,
        versions: [version],
      };
    }),
  ];
}
export type CompatibleEnvironmentRecord = Awaited<ReturnType<typeof listCompatibleEnvironments>>[number];
