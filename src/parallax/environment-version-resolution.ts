import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { canonicalChecksum } from "@/drydock/canonical";
import { environmentReferenceSchema, type EnvironmentReference } from "./environment-reference";
import { checkedEnvironmentRelease, type EnvironmentReleaseRow } from "./library-lifecycle-contracts";
import { environmentVersionSchema as legacyEnvironmentVersionSchema } from "./legacy-scene-environment-contracts";
import legacyBuiltins from "./builtin-environments.v1.json";
import type { SpatialDraft } from "./authoring";
import { reviewEnvironmentImpact } from "./legacy-scene-environment-impact";

export function checkedLegacyEnvironmentRelease(row: EnvironmentReleaseRow, environmentId: string) {
  const value = legacyEnvironmentVersionSchema.parse(JSON.parse(row.envelope));
  if (
    row.versionNumber <= 0 ||
    row.itemId !== environmentId ||
    value.content.id !== environmentId ||
    value.reference.environmentId !== environmentId ||
    value.reference.versionId !== row.id ||
    value.reference.revision !== row.versionNumber ||
    value.reference.checksum !== row.checksum ||
    canonicalChecksum(value.content) !== row.checksum
  )
    throw new Error("Environment version binding and integrity failed.");
  return value;
}

/** A release ordinal is not the item's mutable CAS revision. */
export function environmentReleaseReference(row: EnvironmentReleaseRow): EnvironmentReference {
  checkedEnvironmentRelease(row, row.itemId);
  return environmentReferenceSchema.parse({
    environmentId: row.itemId,
    versionId: row.id,
    revision: row.versionNumber,
    checksum: row.checksum,
  });
}

function assertPin(actual: EnvironmentReference, requested: EnvironmentReference) {
  if (canonicalChecksum(actual) !== canonicalChecksum(requested))
    throw new Error("Environment checksum or immutable version binding does not match its pin.");
}

/** Preserve both immutable formats. Never resolve an exact pin to moving current/v0.
 * Archived definitions still serve existing owner-authorized immutable pins.
 * Legacy fixtures are retained as legacy data, never invented RoomEnvironment geometry.
 */
export async function resolvePinnedEnvironment(
  accountId: string,
  rawReference: unknown,
  store: Prisma.TransactionClient = db,
) {
  const reference = environmentReferenceSchema.parse(rawReference);
  const builtin = legacyBuiltins.find((value) => value.reference.environmentId === reference.environmentId);
  if (builtin) {
    const value = legacyEnvironmentVersionSchema.parse(builtin);
    if (canonicalChecksum(value.content) !== value.reference.checksum)
      throw new Error("Built-in Environment integrity failed.");
    assertPin(value.reference, reference);
    return { format: "SC01_SCHEMA1" as const, reference: value.reference, legacy: value.content, room: null };
  }
  const item = await store.reusableAuthoringItem.findUnique({ where: { id: reference.environmentId } });
  if (!item || item.ownerAccountId !== accountId || !["PARALLAX_STUDIO", "PARALLAX_ENVIRONMENT"].includes(item.kind))
    throw new Error("Referenced Environment is unavailable to this Creator.");
  const row = await store.reusableAuthoringItemVersion.findFirst({
    where: {
      id: reference.versionId,
      itemId: item.id,
      versionNumber: reference.revision,
    },
  });
  if (!row) throw new Error("Referenced immutable Environment version is unavailable.");
  if (item.kind === "PARALLAX_ENVIRONMENT") {
    const value = checkedLegacyEnvironmentRelease(row, item.id);
    assertPin(value.reference, reference);
    return { format: "SC01_SCHEMA1" as const, reference: value.reference, legacy: value.content, room: null };
  }
  const value = checkedEnvironmentRelease(row, item.id);
  assertPin(environmentReleaseReference(row), reference);
  if (!value.content.room) throw new Error("Referenced Environment has no constructed room.");
  return {
    format: "PARALLAX_ENVIRONMENT_VERSION_1" as const,
    reference,
    document: value.content,
    room: value.content.room,
  };
}

/** Enforce pins on the canonical save transaction and before Scene release. */
export async function assertPinnedSceneEnvironment(
  accountId: string,
  draft: SpatialDraft,
  store: Prisma.TransactionClient = db,
) {
  if (!draft.content.environment) return;
  const resolved = await resolvePinnedEnvironment(accountId, draft.content.environment, store);
  const binding = draft.content.studio?.environmentBinding;
  if (
    binding &&
    (binding.definitionId !== resolved.reference.environmentId ||
      binding.versionId !== resolved.reference.versionId ||
      binding.checksum !== resolved.reference.checksum)
  )
    throw new Error(
      "Scene Environment source identity conflicts with its immutable pin. Review the Environment binding before saving.",
    );
  // Binding revision is the source's mutable CAS revision, not the release ordinal.
  const snapshot = draft.content.studio?.environment;
  if (resolved.room) {
    if (!snapshot || canonicalChecksum(snapshot) !== canonicalChecksum(resolved.room))
      throw new Error(
        "Scene room does not match its immutable Environment pin. Review an explicit Environment update before saving.",
      );
  } else if (snapshot) {
    throw new Error(
      "Legacy Environment geometry cannot be replaced by an unrelated room snapshot. Create an explicit independent Environment first.",
    );
  }
  if (resolved.format === "SC01_SCHEMA1") {
    const impact = reviewEnvironmentImpact(draft, { reference: resolved.reference, content: resolved.legacy });
    if (impact.status === "INVALID") throw new Error(impact.findings.map((finding) => finding.message).join(" "));
  }
  const features = resolved.room
    ? new Set(
        resolved.room.features
          .filter((f) => f.classification !== "EXCLUSION_ZONE")
          .flatMap((f) => [f.id, ...f.parts.filter((p) => p.surface !== null).map((p) => p.id)]),
      )
    : new Set(resolved.legacy.evidence.candidates.filter((f) => f.safe && !f.occluded).map((f) => f.id));
  if ((draft.content.environmentPlacements ?? []).some((p) => !features.has(p.featureId)))
    throw new Error("A Scene references a missing or unsafe Environment feature. Repair the placement before saving.");
}
