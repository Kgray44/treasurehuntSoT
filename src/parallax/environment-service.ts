import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { canonicalChecksum } from "@/drydock/canonical";
import { DraftConflictError } from "@/chronicle/studio-service";
import {
  environmentContentSchema,
  environmentVersionSchema,
  type EnvironmentContent,
  type EnvironmentRecord,
  type EnvironmentVersion,
} from "./environment-contracts";
import { reviewEnvironmentImpact } from "./environment-authoring";
import builtinVersions from "./builtin-environments.v1.json";
import type { SpatialDraft } from "./authoring";

export const environmentItemKind = "PARALLAX_ENVIRONMENT";
function version(content: EnvironmentContent, revision: number): EnvironmentVersion {
  return {
    content,
    reference: {
      environmentId: content.id,
      versionId: `${content.id}:e${revision}`,
      revision,
      checksum: canonicalChecksum(content),
    },
  };
}
/** Version-one preset envelopes are checked-in immutable data, independent of
 * later preview fixture or generator changes. New presets append versions. */
export function builtinEnvironments(): EnvironmentRecord[] {
  return builtinVersions.map((raw) => {
    const current = environmentVersionSchema.parse(raw);
    if (canonicalChecksum(current.content) !== current.reference.checksum)
      throw new Error("Built-in Environment revision integrity could not be verified.");
    return { id: current.reference.environmentId, ownerAccountId: null, builtin: true, current, versions: [current] };
  });
}

function readVersion(raw: string, checksum: string, id: string, environmentId: string, revision: number) {
  const v = environmentVersionSchema.parse(JSON.parse(raw));
  if (
    v.reference.environmentId !== environmentId ||
    v.content.id !== environmentId ||
    v.reference.versionId !== id ||
    v.reference.revision !== revision ||
    v.reference.checksum !== checksum ||
    canonicalChecksum(v.content) !== checksum
  )
    throw new Error("Environment revision integrity could not be verified.");
  return v;
}
export async function listEnvironments(ownerAccountId: string): Promise<EnvironmentRecord[]> {
  const items = await db.reusableAuthoringItem.findMany({
    where: { ownerAccountId, kind: environmentItemKind, archivedAt: null },
    include: { versions: { orderBy: { versionNumber: "desc" } } },
    orderBy: { updatedAt: "desc" },
  });
  return [
    ...items.map((item) => {
      const versions = item.versions.map((v) => readVersion(v.envelope, v.checksum, v.id, item.id, v.versionNumber));
      const current = versions.find((v) => v.reference.revision === item.currentVersionNumber);
      if (!current) throw new Error("Environment current revision is unavailable.");
      return { id: item.id, ownerAccountId, builtin: false, current, versions };
    }),
    ...builtinEnvironments(),
  ];
}
export async function saveEnvironment(ownerAccountId: string, raw: unknown, revision: number) {
  const content = environmentContentSchema.parse(raw);
  if (content.id.startsWith("builtin:") || content.origin === "BUILTIN")
    throw new Error("Built-in Environments are immutable. Save an owned copy to edit.");
  const next = version(content, revision + 1);
  await db.$transaction(async (tx) => {
    const item = await tx.reusableAuthoringItem.findUnique({ where: { id: content.id } });
    if (!item) {
      if (revision !== 0) throw new DraftConflictError(0);
      await tx.reusableAuthoringItem.create({
        data: {
          id: content.id,
          ownerAccountId,
          kind: environmentItemKind,
          name: content.name,
          currentVersionNumber: 1,
          tags: "[]",
          versions: {
            create: {
              id: next.reference.versionId,
              versionNumber: 1,
              checksum: next.reference.checksum,
              envelope: JSON.stringify(next),
            },
          },
        },
      });
      return;
    }
    if (item.ownerAccountId !== ownerAccountId || item.kind !== environmentItemKind || item.archivedAt)
      throw new Error("Environment unavailable to this Creator.");
    const claimed = await tx.reusableAuthoringItem.updateMany({
      where: {
        id: content.id,
        ownerAccountId,
        kind: environmentItemKind,
        currentVersionNumber: revision,
        archivedAt: null,
      },
      data: { name: content.name, currentVersionNumber: { increment: 1 } },
    });
    if (!claimed.count) throw new DraftConflictError(item.currentVersionNumber);
    await tx.reusableAuthoringItemVersion.create({
      data: {
        id: next.reference.versionId,
        itemId: content.id,
        versionNumber: revision + 1,
        checksum: next.reference.checksum,
        envelope: JSON.stringify(next),
      },
    });
  });
  return next;
}
export async function resolveEnvironment(
  ownerAccountId: string,
  reference: EnvironmentVersion["reference"],
  tx: Prisma.TransactionClient = db,
): Promise<EnvironmentVersion> {
  const builtin = builtinEnvironments().find((e) => e.id === reference.environmentId);
  if (builtin) {
    if (JSON.stringify(builtin.current.reference) !== JSON.stringify(reference)) {
      // Compare fields rather than relying on incoming JSON key order.
      if (canonicalChecksum(builtin.current.reference) !== canonicalChecksum(reference))
        throw new Error("Built-in Environment pin is invalid.");
    }
    return builtin.current;
  }
  const item = await tx.reusableAuthoringItem.findUnique({ where: { id: reference.environmentId } });
  if (!item || item.ownerAccountId !== ownerAccountId || item.kind !== environmentItemKind)
    throw new Error("Referenced Environment is unavailable to this Creator.");
  const row = await tx.reusableAuthoringItemVersion.findFirst({
    where: { id: reference.versionId, itemId: item.id, versionNumber: reference.revision },
  });
  if (!row) throw new Error("Referenced Environment revision is unavailable.");
  const found = readVersion(row.envelope, row.checksum, row.id, item.id, row.versionNumber);
  if (found.reference.checksum !== reference.checksum)
    throw new Error("Environment checksum does not match its pinned revision.");
  return found;
}
export async function assertSceneEnvironment(
  ownerAccountId: string,
  draft: SpatialDraft,
  tx: Prisma.TransactionClient = db,
) {
  if (!draft.content.environment) return;
  const environment = await resolveEnvironment(ownerAccountId, draft.content.environment, tx);
  const impact = reviewEnvironmentImpact(draft, environment);
  if (impact.status === "INVALID") throw new Error(impact.findings.map((f) => f.message).join(" "));
}
