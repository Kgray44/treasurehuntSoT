import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { parsePublishedSnapshot } from "@/chronicle/types";
import { db } from "@/lib/db";

export const artifactVisibilityValues = ["ONLY_ME", "CREW_ONLY", "REGISTERED_USERS", "PUBLIC", "UNLISTED"] as const;
const ids = z.array(z.string().min(1).max(191)).max(64);
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const json = <T>(value: string, fallback: T): T => {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};
const receiptIds = (value: string) => ids.catch([]).parse(json<unknown>(value, []));

export const artifactPersonalizationSchema = z
  .object({
    favorite: z.boolean().optional(),
    privateNote: z.string().trim().max(4000).nullable().optional(),
    chronicleMemoryId: z.string().min(1).max(191).nullable().optional(),
    visibility: z.enum(artifactVisibilityValues).optional(),
    archive: z.boolean().optional(),
  })
  .strict();
const listSchema = z.object({
  search: z.string().trim().max(120).optional(),
  state: z.string().trim().max(40).optional(),
  status: z.enum(["ACTIVE", "REVOKED", "CORRECTED", "UNRESOLVED"]).optional(),
  favorite: z.boolean().optional(),
  sort: z.enum(["RECENT", "NAME", "STATE"]).default("RECENT"),
  cursor: z.string().min(1).max(191).optional(),
  limit: z.number().int().min(1).max(50).default(24),
}).strict();
const displayCaseSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    description: z.string().trim().max(1000).nullable().optional(),
    visibility: z.enum(artifactVisibilityValues),
  })
  .strict();
const achievementPatchSchema = z
  .object({ showcased: z.boolean().optional(), visibility: z.enum(artifactVisibilityValues).optional() })
  .strict();

type Version = { id: string; checksum: string; contentSnapshot: string; tale: { title: string } };
function artifactSnapshot(version: Version, artifactId: string) {
  const snapshot = parsePublishedSnapshot(version.contentSnapshot);
  const artifact = snapshot.artifacts.find((item) => item.id === artifactId);
  if (!artifact) return null;
  const record = artifact as Record<string, unknown>;
  return {
    name:
      typeof record.displayName === "string"
        ? record.displayName
        : typeof record.name === "string"
          ? record.name
          : "Unavailable artifact",
    type: typeof record.inventoryCategory === "string" ? record.inventoryCategory : "ARTIFACT",
    representation:
      typeof record.modelAssetId === "string"
        ? "MODEL"
        : typeof record.artworkAssetId === "string"
          ? "ARTWORK"
          : "FALLBACK",
    collection: typeof record.collectionGroup === "string" ? record.collectionGroup : null,
    assembly: typeof record.assemblyDefinitionId === "string" ? record.assemblyDefinitionId : null,
  };
}
function projected(
  visibility: string,
  viewer: { owner?: boolean; registered?: boolean; sharedCrew?: boolean; unlisted?: boolean },
) {
  return (
    Boolean(viewer.owner) ||
    visibility === "PUBLIC" ||
    (visibility === "REGISTERED_USERS" && viewer.registered) ||
    (visibility === "CREW_ONLY" && viewer.sharedCrew) ||
    (visibility === "UNLISTED" && viewer.unlisted)
  );
}

/**
 * Materializes receipts only. It never writes a Voyage event, membership or
 * shared inventory row; changing those domains cannot retroactively alter a
 * receipt's event-time recipient evidence.
 */
export async function materializePersonalArtifacts(playerProfileId: string) {
  const receipts = await db.artifactGrantReceipt.findMany({
    include: {
      session: {
        include: {
          version: { include: { tale: { select: { title: true } } } },
          events: { select: { id: true, sequence: true, createdAt: true } },
        },
      },
    },
    orderBy: [{ occurredAt: "asc" }, { createdAt: "asc" }],
  });
  const byGrant = new Map(receipts.map((receipt) => [receipt.grantId, receipt]));
  const rootFor = (receipt: (typeof receipts)[number]) => {
    let current = receipt;
    const seen = new Set<string>();
    while (current.correctionOfGrantId && !seen.has(current.grantId)) {
      seen.add(current.grantId);
      const parent = byGrant.get(current.correctionOfGrantId);
      if (!parent) break;
      current = parent;
    }
    return current;
  };
  const effective = new Map<string, (typeof receipts)[number]>();
  for (const receipt of receipts) effective.set(rootFor(receipt).grantId, receipt);
  let created = 0,
    updated = 0,
    unresolved = 0,
    witnessed = 0;
  for (const [rootGrantId, receipt] of effective) {
    const root = byGrant.get(rootGrantId)!;
    const historicalRecipient = receiptIds(root.resolvedRecipientProfileIds).includes(playerProfileId);
    const currentRecipient = receiptIds(receipt.resolvedRecipientProfileIds).includes(playerProfileId);
    if (!historicalRecipient && !currentRecipient) continue;
    const version = receipt.session.version;
    let artifact: ReturnType<typeof artifactSnapshot> = null;
    try {
      artifact = version ? artifactSnapshot(version, receipt.artifactDefinitionId) : null;
    } catch {
      artifact = null;
    }
    const event = root.session.events.find((item) => item.id === root.sourceEventId);
    if (!version || !artifact || !event) {
      unresolved++;
      continue;
    }
    const existing = await db.playerArtifactRecord.findUnique({
      where: { playerProfileId_sourceGrantEventId: { playerProfileId, sourceGrantEventId: root.sourceEventId } },
      select: { id: true },
    });
    const revoked = receipt.receiptState === "REVOKED";
    const data = {
      sourcePlaythroughId: root.sessionId,
      sourceGrantSequence: event.sequence,
      sourceBlockId: root.sourceBlockId,
      publishedVersionId: version.id,
      publishedVersionChecksum: version.checksum,
      chronicleTitleSnapshot: version.tale.title,
      artifactDefinitionId: receipt.artifactDefinitionId,
      artifactNameSnapshot: artifact.name,
      artifactTypeSnapshot: artifact.type,
      representationSnapshot: artifact.representation,
      collectionKeySnapshot: artifact.collection,
      assemblyKeySnapshot: receipt.assemblyDefinitionId ?? artifact.assembly,
      componentRoleSnapshot: receipt.componentRole,
      recipientPolicy: receipt.recipientPolicy,
      recipientEvidence: JSON.stringify({
        schemaVersion: receipt.schemaVersion,
        grantId: receipt.grantId,
        correctedGrantId: receipt.correctionOfGrantId,
        recipientCount: receiptIds(receipt.resolvedRecipientProfileIds).length,
      }),
      ownershipState: currentRecipient ? receipt.personalGrantState : "WITNESSED",
      custody: receipt.custodyKind,
      recordStatus: revoked ? "REVOKED" : receipt.correctionOfGrantId ? "CORRECTED" : "ACTIVE",
      grantedAt: receipt.occurredAt,
      discoveredAt:
        receipt.discoveringMembershipId &&
        receiptIds(receipt.resolvedRecipientMembershipIds).includes(receipt.discoveringMembershipId)
          ? receipt.occurredAt
          : null,
      witnessedAt: currentRecipient ? null : root.occurredAt,
      revokedAt: revoked ? receipt.occurredAt : null,
      correctedAt: receipt.correctionOfGrantId ? receipt.occurredAt : null,
      correctionReason: receipt.correctionReason,
      sourceFingerprint: hash({
        rootGrantId,
        receiptGrantId: receipt.grantId,
        artifact,
        state: receipt.receiptState,
        recipients: receiptIds(receipt.resolvedRecipientProfileIds),
        occurredAt: receipt.occurredAt,
      }),
      lastDerivedAt: new Date(),
    };
    await db.playerArtifactRecord.upsert({
      where: { playerProfileId_sourceGrantEventId: { playerProfileId, sourceGrantEventId: root.sourceEventId } },
      create: { playerProfileId, sourceGrantEventId: root.sourceEventId, ...data },
      update: data,
    });
    if (existing) updated++;
    else created++;
  }
  witnessed = await conservativelyBackfillWitnesses(playerProfileId);
  await materializeAssemblies(playerProfileId);
  await evaluateAchievements(playerProfileId);
  return { created, updated, unresolved, witnessed, oneVoyageRowsChanged: 0, sharedInventoryRowsChanged: 0 };
}

/** Existing shared-only events are evidence of witness, never ownership. */
async function conservativelyBackfillWitnesses(playerProfileId: string) {
  const memberships = await db.playthroughMembership.findMany({
    where: { playerProfileId },
    include: {
      playthrough: {
        include: {
          version: { include: { tale: { select: { title: true } } } },
          events: {
            where: { eventType: "artifactGranted" },
            select: { id: true, blockId: true, sequence: true, payload: true, createdAt: true },
          },
        },
      },
    },
  });
  let created = 0;
  for (const membership of memberships)
    for (const event of membership.playthrough.events) {
      if (
        (membership.joinedAt && membership.joinedAt > event.createdAt) ||
        (membership.removedAt && membership.removedAt <= event.createdAt)
      )
        continue;
      if (await db.artifactGrantReceipt.findUnique({ where: { sourceEventId: event.id }, select: { id: true } }))
        continue;
      const artifactId = json<Record<string, unknown>>(event.payload, {}).artifactId;
      if (typeof artifactId !== "string" || !membership.playthrough.version) continue;
      let artifact: ReturnType<typeof artifactSnapshot> = null;
      try {
        artifact = artifactSnapshot(membership.playthrough.version, artifactId);
      } catch {
        artifact = null;
      }
      if (!artifact) continue;
      const result = await db.playerArtifactRecord.upsert({
        where: { playerProfileId_sourceGrantEventId: { playerProfileId, sourceGrantEventId: event.id } },
        create: {
          playerProfileId,
          sourcePlaythroughId: membership.playthroughId,
          sourceGrantEventId: event.id,
          sourceGrantSequence: event.sequence,
          sourceBlockId: event.blockId,
          publishedVersionId: membership.playthrough.version.id,
          publishedVersionChecksum: membership.playthrough.version.checksum,
          chronicleTitleSnapshot: membership.playthrough.version.tale.title,
          artifactDefinitionId: artifactId,
          artifactNameSnapshot: artifact.name,
          artifactTypeSnapshot: artifact.type,
          representationSnapshot: artifact.representation,
          collectionKeySnapshot: artifact.collection,
          assemblyKeySnapshot: artifact.assembly,
          recipientPolicy: "LEGACY_SHARED_ONLY",
          recipientEvidence: JSON.stringify({ schemaVersion: 0, evidence: "shared inventory witness only" }),
          ownershipState: "WITNESSED",
          custody: "NARRATIVE",
          recordStatus: "UNRESOLVED",
          witnessedAt: event.createdAt,
          sourceFingerprint: hash({ legacy: event.id, artifactId, version: membership.playthrough.version.checksum }),
        },
        update: { lastDerivedAt: new Date() },
      });
      if (result.createdAt.getTime() === result.updatedAt.getTime()) created++;
    }
  return created;
}

async function materializeAssemblies(playerProfileId: string) {
  const records = await db.playerArtifactRecord.findMany({
    where: { playerProfileId, recordStatus: "ACTIVE", assemblyKeySnapshot: { not: null } },
  });
  const groups = new Map<string, typeof records>();
  for (const record of records) {
    const key = `${record.publishedVersionId}:${record.sourcePlaythroughId}:${record.assemblyKeySnapshot}`;
    groups.set(key, [...(groups.get(key) ?? []), record]);
  }
  for (const items of groups.values()) {
    const first = items[0];
    const components = items
      .map((item) => ({ artifactId: item.artifactDefinitionId, role: item.componentRoleSnapshot ?? null }))
      .sort((a, b) => a.artifactId.localeCompare(b.artifactId));
    const assembly = await db.playerArtifactAssembly.upsert({
      where: {
        playerProfileId_sourcePlaythroughId_assemblyKeySnapshot: {
          playerProfileId,
          sourcePlaythroughId: first.sourcePlaythroughId,
          assemblyKeySnapshot: first.assemblyKeySnapshot!,
        },
      },
      create: {
        playerProfileId,
        publishedVersionId: first.publishedVersionId,
        sourcePlaythroughId: first.sourcePlaythroughId,
        assemblyKeySnapshot: first.assemblyKeySnapshot!,
        assembledArtifactName: first.assemblyKeySnapshot!,
        recipeSnapshot: JSON.stringify({
          schemaVersion: 1,
          components,
          completeness: "CANONICAL_RECIPE_NOT_PUBLISHED",
        }),
        sourceFingerprint: hash(components),
      },
      update: {
        recipeSnapshot: JSON.stringify({
          schemaVersion: 1,
          components,
          completeness: "CANONICAL_RECIPE_NOT_PUBLISHED",
        }),
        sourceFingerprint: hash(components),
      },
    });
    for (const item of items)
      await db.playerArtifactContribution.upsert({
        where: { assemblyId_artifactRecordId: { assemblyId: assembly.id, artifactRecordId: item.id } },
        create: {
          assemblyId: assembly.id,
          artifactRecordId: item.id,
          componentKey: item.artifactDefinitionId,
          componentRole: item.componentRoleSnapshot,
        },
        update: { state: "ACTIVE" },
      });
  }
}

const achievementCriteria = z
  .object({
    kind: z.enum(["ARTIFACT_COUNT", "ASSEMBLY_COUNT", "COLLECTION_COUNT"]),
    minimum: z.number().int().min(1).max(10000),
    collectionKey: z.string().min(1).max(191).optional(),
  })
  .strict();
export async function evaluateAchievements(playerProfileId: string) {
  const now = new Date();
  const [definitions, records, assemblies] = await Promise.all([
    db.achievementDefinition.findMany({
      where: {
        OR: [{ activeFrom: null }, { activeFrom: { lte: now } }],
        AND: [{ OR: [{ inactiveAt: null }, { inactiveAt: { gt: now } }] }],
      },
    }),
    db.playerArtifactRecord.findMany({ where: { playerProfileId, recordStatus: "ACTIVE" } }),
    db.playerArtifactAssembly.findMany({ where: { playerProfileId, status: "COMPLETED" } }),
  ]);
  let earned = 0,
    revoked = 0;
  for (const definition of definitions) {
    const criteria = achievementCriteria.safeParse(json<unknown>(definition.criteria, {}));
    if (!criteria.success) continue;
    const qualifying =
      criteria.data.kind === "ARTIFACT_COUNT"
        ? records.length
        : criteria.data.kind === "ASSEMBLY_COUNT"
          ? assemblies.length
          : new Set(
              records
                .filter((record) => record.collectionKeySnapshot === criteria.data.collectionKey)
                .map((record) => record.artifactDefinitionId),
            ).size;
    const qualifies = qualifying >= criteria.data.minimum;
    const evidence = {
      definitionKey: definition.key,
      definitionVersion: definition.definitionVersion,
      criteria: criteria.data,
      qualifying,
      evaluatedAt: now.toISOString(),
    };
    const prior = await db.playerAchievement.findUnique({
      where: { playerProfileId_achievementDefinitionId: { playerProfileId, achievementDefinitionId: definition.id } },
    });
    await db.playerAchievement.upsert({
      where: { playerProfileId_achievementDefinitionId: { playerProfileId, achievementDefinitionId: definition.id } },
      create: {
        playerProfileId,
        achievementDefinitionId: definition.id,
        definitionVersion: definition.definitionVersion,
        state: qualifies ? "EARNED" : "REVOKED",
        evidenceSnapshot: JSON.stringify(evidence),
        sourceFingerprint: hash(evidence),
        earnedAt: qualifies ? now : null,
        revokedAt: qualifies ? null : now,
        correctionReason: qualifies ? null : "AUTHORITATIVE_FACTS_NO_LONGER_QUALIFY",
      },
      update: {
        state: qualifies ? "EARNED" : "REVOKED",
        evidenceSnapshot: JSON.stringify(evidence),
        sourceFingerprint: hash(evidence),
        earnedAt: qualifies && !prior?.earnedAt ? now : prior?.earnedAt,
        revokedAt: qualifies ? null : now,
        correctedAt: prior ? now : null,
        correctionReason: qualifies ? null : "AUTHORITATIVE_FACTS_NO_LONGER_QUALIFY",
      },
    });
    if (qualifies) earned++;
    else revoked++;
  }
  return { earned, revoked };
}

export async function listPersonalArtifacts(playerProfileId: string, options: unknown = {}) {
  const value = listSchema.parse(options);
  await materializePersonalArtifacts(playerProfileId);
  const cursor =
    value.cursor &&
    (await db.playerArtifactRecord.findFirst({ where: { id: value.cursor, playerProfileId }, select: { id: true } }));
  const orderBy =
    value.sort === "NAME"
      ? [{ artifactNameSnapshot: "asc" as const }, { id: "asc" as const }]
      : value.sort === "STATE"
        ? [{ ownershipState: "asc" as const }, { id: "asc" as const }]
        : [{ grantedAt: "desc" as const }, { id: "desc" as const }];
  const rows = await db.playerArtifactRecord.findMany({
    where: {
      playerProfileId,
      ...(value.state ? { ownershipState: value.state } : {}),
      ...(value.status ? { recordStatus: value.status } : {}),
      ...(value.search ? { artifactNameSnapshot: { contains: value.search } } : {}),
      ...(value.favorite ? { personalization: { is: { favorite: true } } } : {}),
    },
    include: { personalization: true, displayItems: { select: { displayCaseId: true } } },
    orderBy,
    ...(cursor ? { cursor: { id: cursor.id }, skip: 1 } : {}),
    take: value.limit + 1,
  });
  const nextCursor = rows.length > value.limit ? rows.pop()!.id : null;
  const [assemblies, achievements] = await Promise.all([
    db.playerArtifactAssembly.findMany({
      where: { playerProfileId },
      include: { contributions: { where: { state: "ACTIVE" }, select: { id: true } } },
      orderBy: { updatedAt: "desc" },
    }),
    db.playerAchievement.findMany({
      where: { playerProfileId },
      include: { definition: true },
      orderBy: { earnedAt: "desc" },
    }),
  ]);
  const collectionMap = new Map<string, Set<string>>();
  for (const row of rows)
    if (row.collectionKeySnapshot)
      collectionMap.set(
        row.collectionKeySnapshot,
        new Set([...(collectionMap.get(row.collectionKeySnapshot) ?? []), row.artifactDefinitionId]),
      );
  return {
    items: rows.map((row) => ({
      id: row.id,
      name: row.artifactNameSnapshot,
      type: row.artifactTypeSnapshot,
      state: row.ownershipState,
      status: row.recordStatus,
      chronicle: row.chronicleTitleSnapshot,
      grantedAt: row.grantedAt?.toISOString() ?? null,
      favorite: row.personalization?.favorite ?? false,
      visibility: row.personalization?.visibility ?? "ONLY_ME",
      displayed: row.displayItems.length > 0,
      representation: row.representationSnapshot,
      archived: Boolean(row.archivedAt),
    })),
    nextCursor,
    collections: [...collectionMap].map(([key, values]) => ({
      key,
      collected: values.size,
      completeness: "CANONICAL_COLLECTION_RECIPE_NOT_PUBLISHED",
    })),
    assemblies: assemblies.map((assembly) => ({
      id: assembly.id,
      name: assembly.assembledArtifactName,
      status: assembly.status,
      components: assembly.contributions.length,
      completedAt: assembly.completedAt?.toISOString() ?? null,
    })),
    achievements: achievements.map((achievement) => ({
      id: achievement.id,
      key: achievement.definition.key,
      title: achievement.definition.titleSnapshot,
      description: achievement.definition.descriptionSnapshot,
      state: achievement.state,
      showcased: achievement.showcased,
      visibility: achievement.visibility,
      earnedAt: achievement.earnedAt?.toISOString() ?? null,
    })),
  };
}

export async function personalArtifactDetail(playerProfileId: string, artifactId: string) {
  await materializePersonalArtifacts(playerProfileId);
  const row = await db.playerArtifactRecord.findFirst({
    where: { id: artifactId, playerProfileId },
    include: {
      personalization: true,
      displayItems: { include: { displayCase: true } },
      contributions: { include: { assembly: true } },
    },
  });
  if (!row) return null;
  return {
    id: row.id,
    artifact: {
      id: row.artifactDefinitionId,
      name: row.artifactNameSnapshot,
      type: row.artifactTypeSnapshot,
      representation: row.representationSnapshot,
      accessibleRepresentation: "Text metadata is always available when 2D or 3D media cannot be used.",
    },
    provenance: {
      chronicle: row.chronicleTitleSnapshot,
      publishedVersionChecksum: row.publishedVersionChecksum,
      sourcePlaythroughId: row.sourcePlaythroughId,
      sourceGrantEventId: row.sourceGrantEventId,
      sourceBlockId: row.sourceBlockId,
      recipientPolicy: row.recipientPolicy,
      state: row.ownershipState,
      custody: row.custody,
      status: row.recordStatus,
      grantedAt: row.grantedAt,
      witnessedAt: row.witnessedAt,
      discoveredAt: row.discoveredAt,
      revokedAt: row.revokedAt,
      correctedAt: row.correctedAt,
      correctionReason: row.correctionReason,
    },
    personalization: {
      favorite: row.personalization?.favorite ?? false,
      privateNote: row.personalization?.privateNote ?? null,
      chronicleMemoryId: row.personalization?.chronicleMemoryId ?? null,
      visibility: row.personalization?.visibility ?? "ONLY_ME",
      archived: Boolean(row.archivedAt),
    },
    displayCases: row.displayItems.map((item) => ({
      id: item.displayCase.id,
      name: item.displayCase.name,
      visibility: item.displayCase.visibility,
      position: item.position,
    })),
    assemblies: row.contributions.map((contribution) => ({
      id: contribution.assembly.id,
      name: contribution.assembly.assembledArtifactName,
      status: contribution.assembly.status,
      role: contribution.componentRole,
    })),
  };
}

export async function personalizeArtifact(playerProfileId: string, artifactId: string, input: unknown) {
  const value = artifactPersonalizationSchema.parse(input);
  const record = await db.playerArtifactRecord.findFirst({ where: { id: artifactId, playerProfileId } });
  if (!record) return null;
  if (value.chronicleMemoryId) {
    const memory = await db.chronicleMemory.findFirst({
      where: { id: value.chronicleMemoryId, playerProfileId, deletedAt: null },
      select: { id: true },
    });
    if (!memory) throw new Error("Choose a Memory from your own Chronicle history.");
  }
  await db.$transaction(async (tx) => {
    if (
      value.favorite !== undefined ||
      value.privateNote !== undefined ||
      value.chronicleMemoryId !== undefined ||
      value.visibility !== undefined
    )
      await tx.playerArtifactPersonalization.upsert({
        where: { artifactRecordId: artifactId },
        create: {
          artifactRecordId: artifactId,
          favorite: value.favorite ?? false,
          privateNote: value.privateNote ?? null,
          chronicleMemoryId: value.chronicleMemoryId ?? null,
          visibility: value.visibility ?? "ONLY_ME",
        },
        update: {
          ...(value.favorite !== undefined ? { favorite: value.favorite } : {}),
          ...(value.privateNote !== undefined ? { privateNote: value.privateNote } : {}),
          ...(value.chronicleMemoryId !== undefined ? { chronicleMemoryId: value.chronicleMemoryId } : {}),
          ...(value.visibility !== undefined ? { visibility: value.visibility } : {}),
        },
      });
    if (value.archive !== undefined)
      await tx.playerArtifactRecord.update({
        where: { id: artifactId },
        data: { archivedAt: value.archive ? new Date() : null },
      });
  });
  return { id: artifactId };
}

export async function listArtifactCases(playerProfileId: string) {
  return db.artifactDisplayCase.findMany({
    where: { playerProfileId },
    include: {
      items: {
        include: { artifact: { select: { id: true, artifactNameSnapshot: true } } },
        orderBy: { position: "asc" },
      },
    },
    orderBy: { updatedAt: "desc" },
  });
}
export async function saveArtifactCase(playerProfileId: string, input: unknown, caseId?: string) {
  const value = displayCaseSchema.parse(input);
  const data = { name: value.name, description: value.description ?? null, visibility: value.visibility };
  if (!caseId)
    return db.artifactDisplayCase.create({
      data: { playerProfileId, ...data, unlistedToken: value.visibility === "UNLISTED" ? randomUUID() : null },
    });
  const existing = await db.artifactDisplayCase.findFirst({ where: { id: caseId, playerProfileId } });
  if (!existing) return null;
  return db.artifactDisplayCase.update({
    where: { id: caseId },
    data: { ...data, unlistedToken: value.visibility === "UNLISTED" ? (existing.unlistedToken ?? randomUUID()) : null },
  });
}
export async function replaceArtifactCaseItems(playerProfileId: string, caseId: string, artifactRecordIds: unknown) {
  const values = ids.parse(artifactRecordIds);
  if (new Set(values).size !== values.length) throw new Error("Each artifact may appear once in a display case.");
  const existing = await db.artifactDisplayCase.findFirst({
    where: { id: caseId, playerProfileId },
    select: { id: true },
  });
  if (!existing) return null;
  const allowed = await db.playerArtifactRecord.findMany({
    where: { playerProfileId, id: { in: values }, recordStatus: "ACTIVE" },
    select: { id: true },
  });
  if (allowed.length !== values.length) throw new Error("Display cases may contain only your active artifacts.");
  await db.$transaction(async (tx) => {
    await tx.artifactDisplayItem.deleteMany({ where: { displayCaseId: caseId } });
    if (values.length)
      await tx.artifactDisplayItem.createMany({
        data: values.map((artifactRecordId, position) => ({ displayCaseId: caseId, artifactRecordId, position })),
      });
  });
  return listArtifactCases(playerProfileId);
}
export async function removeArtifactCase(playerProfileId: string, caseId: string) {
  const result = await db.artifactDisplayCase.deleteMany({ where: { id: caseId, playerProfileId } });
  return result.count > 0;
}
export async function updateAchievementPresentation(playerProfileId: string, achievementId: string, input: unknown) {
  const value = achievementPatchSchema.parse(input);
  const result = await db.playerAchievement.updateMany({ where: { id: achievementId, playerProfileId }, data: value });
  return result.count > 0;
}

export async function publicArtifactProjection(
  profileId: string,
  viewer: { owner?: boolean; registered?: boolean; sharedCrew?: boolean; unlistedCaseToken?: string } = {},
) {
  const cases = await db.artifactDisplayCase.findMany({
    where: { playerProfileId: profileId },
    include: { items: { include: { artifact: { include: { personalization: true } } }, orderBy: { position: "asc" } } },
  });
  const visibleCases = cases.filter((item) =>
    projected(item.visibility, {
      ...viewer,
      unlisted: Boolean(viewer.unlistedCaseToken && item.unlistedToken === viewer.unlistedCaseToken),
    }),
  );
  const achievements = await db.playerAchievement.findMany({
    where: { playerProfileId: profileId, state: "EARNED", showcased: true },
    include: { definition: true },
  });
  return {
    displayCases: visibleCases.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      visibility: item.visibility,
      items: item.items
        .filter(
          (entry) =>
            entry.artifact.recordStatus === "ACTIVE" &&
            projected(entry.artifact.personalization?.visibility ?? "ONLY_ME", viewer),
        )
        .map((entry) => ({
          id: entry.artifact.id,
          name: entry.artifact.artifactNameSnapshot,
          type: entry.artifact.artifactTypeSnapshot,
          representation: entry.artifact.representationSnapshot,
          position: entry.position,
        })),
    })),
    achievements: achievements
      .filter((item) => projected(item.visibility, viewer))
      .map((item) => ({
        key: item.definition.key,
        title: item.definition.titleSnapshot,
        description: item.definition.descriptionSnapshot,
        earnedAt: item.earnedAt,
      })),
  };
}
