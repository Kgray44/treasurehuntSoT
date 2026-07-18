import { createHash, randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { safeAuditMetadata } from "@/platform/audit";
import {
  defaultDraftConfiguration,
  developmentVisionPackageSchema,
  mockVisionScenarioSchema,
  storyWaypointBindingSchema,
  verificationProfileSchema,
  visionWaypointDraftConfigurationSchema,
  VisionDomainError,
  waypointRuntimeModeSchema,
  waypointLifecycleSchema,
  waypointSharingScopeSchema,
  waypointTypeSchema,
  type MockVisionScenario,
} from "@/vision/domain";

const jsonObject = z.record(z.string(), z.unknown());

export const createWaypointSchema = z
  .object({
    name: z.string().trim().min(2).max(160),
    description: z.string().trim().max(4_000).default(""),
    type: waypointTypeSchema,
    locationTags: z.array(z.string().trim().min(1).max(80)).max(64).default([]),
    sharingScope: waypointSharingScopeSchema.default("PRIVATE"),
    verificationProfile: verificationProfileSchema.default("BALANCED"),
  })
  .strict();

export const updateWaypointMetadataSchema = createWaypointSchema
  .pick({ name: true, description: true, type: true, locationTags: true, sharingScope: true })
  .partial()
  .strict();

export const bindingInputSchema = storyWaypointBindingSchema;

function parseJson(value: string | null | undefined) {
  try {
    return JSON.parse(value ?? "{}");
  } catch {
    return {};
  }
}

async function audit(
  tx: Prisma.TransactionClient,
  input: {
    actorId: string;
    action: string;
    resourceType: string;
    resourceId: string;
    correlationId?: string;
    metadata?: Record<string, unknown>;
  },
) {
  return tx.platformAuditEvent.create({
    data: {
      actorType: "CREATOR",
      actorId: input.actorId,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      correlationId: input.correlationId ?? randomUUID(),
      metadata: JSON.stringify(safeAuditMetadata(input.metadata)),
    },
  });
}

function publicVersion(version: {
  id: string;
  waypointId: string;
  versionNumber: number;
  parentVersionId: string | null;
  lifecycleStatus: string;
  verificationProfile: string;
  packageSchemaVersion: number;
  draftConfiguration: string;
  packageArtifactReference: string | null;
  compatibilityMetadata: string;
  certificationReference: string | null;
  createdBy: string;
  publishedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
  deprecatedAt: Date | null;
  publication?: {
    id: string;
    packageHash: string;
    packageSchemaVersion: number;
    compatibilityRange: string;
    status: string;
  } | null;
}) {
  return {
    ...version,
    draftConfiguration: parseJson(version.draftConfiguration),
    compatibilityMetadata: parseJson(version.compatibilityMetadata),
    publication: version.publication
      ? { ...version.publication, compatibilityRange: parseJson(version.publication.compatibilityRange) }
      : null,
    createdAt: version.createdAt.toISOString(),
    updatedAt: version.updatedAt.toISOString(),
    publishedAt: version.publishedAt?.toISOString() ?? null,
    deprecatedAt: version.deprecatedAt?.toISOString() ?? null,
  };
}

export async function listVisionWaypoints(input: {
  actorId: string;
  includeArchived?: boolean;
  query?: string;
  lifecycle?: string;
  cursor?: string;
  limit?: number;
}) {
  const limit = z
    .number()
    .int()
    .min(1)
    .max(100)
    .catch(50)
    .parse(input.limit ?? 50);
  const lifecycle = input.lifecycle ? waypointLifecycleSchema.parse(input.lifecycle) : undefined;
  const records = await db.visionWaypoint.findMany({
    where: {
      ownerId: input.actorId,
      ...(input.includeArchived ? {} : { archivedAt: null }),
      ...(input.query ? { OR: [{ name: { contains: input.query } }, { description: { contains: input.query } }] } : {}),
      ...(lifecycle ? { versions: { some: { lifecycleStatus: lifecycle } } } : {}),
    },
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    take: limit + 1,
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    include: {
      versions: { orderBy: { versionNumber: "desc" }, include: { publication: true } },
      _count: { select: { bindings: true } },
    },
  });
  const hasMore = records.length > limit;
  return {
    items: records.slice(0, limit).map((waypoint) => ({
      id: waypoint.id,
      name: waypoint.name,
      description: waypoint.description,
      type: waypoint.type,
      locationTags: parseJson(waypoint.locationTags),
      sharingScope: waypoint.sharingScope,
      archivedAt: waypoint.archivedAt?.toISOString() ?? null,
      createdAt: waypoint.createdAt.toISOString(),
      updatedAt: waypoint.updatedAt.toISOString(),
      usageCount: waypoint._count.bindings,
      versions: waypoint.versions.map(publicVersion),
    })),
    nextCursor: hasMore ? (records[limit - 1]?.id ?? null) : null,
  };
}

export async function getVisionWaypoint(waypointId: string, actorId: string) {
  const waypoint = await db.visionWaypoint.findFirstOrThrow({
    where: { id: waypointId, ownerId: actorId },
    include: {
      versions: { orderBy: { versionNumber: "desc" }, include: { publication: true } },
      bindings: { include: { story: { select: { title: true, slug: true } }, block: { select: { title: true } } } },
    },
  });
  return {
    id: waypoint.id,
    ownerId: waypoint.ownerId,
    name: waypoint.name,
    description: waypoint.description,
    type: waypoint.type,
    locationTags: parseJson(waypoint.locationTags),
    sharingScope: waypoint.sharingScope,
    archivedAt: waypoint.archivedAt?.toISOString() ?? null,
    createdAt: waypoint.createdAt.toISOString(),
    updatedAt: waypoint.updatedAt.toISOString(),
    versions: waypoint.versions.map(publicVersion),
    usage: waypoint.bindings.map((binding) => ({
      id: binding.id,
      storyId: binding.storyId,
      storyTitle: binding.story.title,
      storySlug: binding.story.slug,
      blockId: binding.blockId,
      blockTitle: binding.block.title,
      waypointVersionId: binding.waypointVersionId,
      runtimeMode: binding.runtimeMode,
    })),
  };
}

export async function getVisionWaypointVersion(versionId: string, actorId: string) {
  const version = await db.visionWaypointVersion.findFirst({
    where: { id: versionId, waypoint: { ownerId: actorId } },
    include: { waypoint: true, publication: true, buildArtifacts: true },
  });
  if (!version) throw new VisionDomainError("WAYPOINT_VERSION_NOT_FOUND", "Vision Waypoint version not found.");
  return publicVersion(version);
}

export async function createWaypoint(unchecked: unknown, actorId: string) {
  const input = createWaypointSchema.parse(unchecked);
  const configuration = defaultDraftConfiguration(input.type, input.verificationProfile);
  return db.$transaction(async (tx) => {
    const waypoint = await tx.visionWaypoint.create({
      data: {
        ownerId: actorId,
        name: input.name,
        description: input.description,
        type: input.type,
        locationTags: JSON.stringify(input.locationTags),
        sharingScope: input.sharingScope,
      },
    });
    const version = await tx.visionWaypointVersion.create({
      data: {
        waypointId: waypoint.id,
        versionNumber: 1,
        lifecycleStatus: "DRAFT",
        verificationProfile: input.verificationProfile,
        packageSchemaVersion: 1,
        draftConfiguration: JSON.stringify(configuration),
        compatibilityMetadata: JSON.stringify({ protocol: "1.0", packageSchemaVersion: 1 }),
        createdBy: actorId,
      },
    });
    await audit(tx, {
      actorId,
      action: "VISION_WAYPOINT_CREATED",
      resourceType: "VISION_WAYPOINT",
      resourceId: waypoint.id,
      metadata: { versionId: version.id, type: input.type, sharingScope: input.sharingScope },
    });
    return { waypointId: waypoint.id, draftVersionId: version.id, versionNumber: version.versionNumber };
  });
}

export async function updateWaypointMetadata(waypointId: string, unchecked: unknown, actorId: string) {
  const input = updateWaypointMetadataSchema.parse(unchecked);
  const owned = await db.visionWaypoint.findFirst({ where: { id: waypointId, ownerId: actorId } });
  if (!owned) throw new VisionDomainError("WAYPOINT_NOT_FOUND", "Vision Waypoint not found.");
  return db.$transaction(async (tx) => {
    const updated = await tx.visionWaypoint.update({
      where: { id: waypointId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.sharingScope !== undefined ? { sharingScope: input.sharingScope } : {}),
        ...(input.locationTags ? { locationTags: JSON.stringify(input.locationTags) } : {}),
      },
    });
    await audit(tx, {
      actorId,
      action: "VISION_WAYPOINT_METADATA_UPDATED",
      resourceType: "VISION_WAYPOINT",
      resourceId: waypointId,
      metadata: { fields: Object.keys(input) },
    });
    return { id: updated.id, updatedAt: updated.updatedAt.toISOString() };
  });
}

export async function archiveWaypoint(waypointId: string, actorId: string) {
  const owned = await db.visionWaypoint.findFirst({ where: { id: waypointId, ownerId: actorId } });
  if (!owned) throw new VisionDomainError("WAYPOINT_NOT_FOUND", "Vision Waypoint not found.");
  return db.$transaction(async (tx) => {
    const archived = await tx.visionWaypoint.update({ where: { id: waypointId }, data: { archivedAt: new Date() } });
    await audit(tx, {
      actorId,
      action: "VISION_WAYPOINT_ARCHIVED",
      resourceType: "VISION_WAYPOINT",
      resourceId: waypointId,
      metadata: { preservedBindings: true },
    });
    return { id: archived.id, archivedAt: archived.archivedAt?.toISOString() ?? null };
  });
}

export async function createDraftVersion(waypointId: string, actorId: string, parentVersionId?: string) {
  return db.$transaction(async (tx) => {
    const waypoint = await tx.visionWaypoint.findFirstOrThrow({ where: { id: waypointId, ownerId: actorId } });
    const currentDraft = await tx.visionWaypointVersion.findFirst({
      where: { waypointId, publishedAt: null, lifecycleStatus: { notIn: ["DEPRECATED", "INCOMPATIBLE"] } },
    });
    if (currentDraft)
      throw new VisionDomainError("DRAFT_ALREADY_EXISTS", "This waypoint already has an editable draft.");
    const parent = parentVersionId
      ? await tx.visionWaypointVersion.findFirstOrThrow({
          where: { id: parentVersionId, waypointId, publishedAt: { not: null } },
        })
      : await tx.visionWaypointVersion.findFirst({
          where: { waypointId, publishedAt: { not: null } },
          orderBy: { versionNumber: "desc" },
        });
    const latest = await tx.visionWaypointVersion.findFirst({
      where: { waypointId },
      orderBy: { versionNumber: "desc" },
    });
    const configuration = parent
      ? visionWaypointDraftConfigurationSchema.parse(parseJson(parent.draftConfiguration))
      : defaultDraftConfiguration(waypoint.type as Parameters<typeof defaultDraftConfiguration>[0]);
    const created = await tx.visionWaypointVersion.create({
      data: {
        waypointId,
        versionNumber: (latest?.versionNumber ?? 0) + 1,
        parentVersionId: parent?.id ?? null,
        lifecycleStatus: "DRAFT",
        verificationProfile: parent?.verificationProfile ?? configuration.verificationProfile,
        packageSchemaVersion: 1,
        draftConfiguration: JSON.stringify(configuration),
        compatibilityMetadata: parent?.compatibilityMetadata ?? JSON.stringify({ protocol: "1.0" }),
        createdBy: actorId,
      },
    });
    await audit(tx, {
      actorId,
      action: "VISION_WAYPOINT_DRAFT_CREATED",
      resourceType: "VISION_WAYPOINT_VERSION",
      resourceId: created.id,
      metadata: { waypointId, parentVersionId: parent?.id ?? null, versionNumber: created.versionNumber },
    });
    return publicVersion(created);
  });
}

export async function updateDraftConfiguration(versionId: string, unchecked: unknown, actorId: string) {
  const configuration = visionWaypointDraftConfigurationSchema.parse(unchecked);
  return db.$transaction(async (tx) => {
    const version = await tx.visionWaypointVersion.findFirstOrThrow({
      where: { id: versionId, waypoint: { ownerId: actorId } },
      include: { waypoint: true },
    });
    if (version.publishedAt || version.lifecycleStatus !== "DRAFT")
      throw new VisionDomainError("PUBLISHED_VERSION_IMMUTABLE", "Only an unpublished draft may be edited.");
    if (configuration.waypointType !== version.waypoint.type)
      throw new VisionDomainError("WAYPOINT_TYPE_MISMATCH", "Draft type must match the stable waypoint type.");
    const updated = await tx.visionWaypointVersion.update({
      where: { id: versionId },
      data: {
        draftConfiguration: JSON.stringify(configuration),
        verificationProfile: configuration.verificationProfile,
      },
    });
    await audit(tx, {
      actorId,
      action: "VISION_WAYPOINT_DRAFT_UPDATED",
      resourceType: "VISION_WAYPOINT_VERSION",
      resourceId: versionId,
      metadata: { waypointId: version.waypointId, verificationProfile: configuration.verificationProfile },
    });
    return publicVersion(updated);
  });
}

export async function publishDraftVersion(
  versionId: string,
  actorId: string,
  scenario: MockVisionScenario = "verified",
) {
  const parsedScenario = mockVisionScenarioSchema.parse(scenario);
  return db.$transaction(async (tx) => {
    const version = await tx.visionWaypointVersion.findFirstOrThrow({
      where: { id: versionId, waypoint: { ownerId: actorId } },
      include: { waypoint: true, publication: true },
    });
    if (version.publication || version.publishedAt || version.lifecycleStatus !== "DRAFT")
      throw new VisionDomainError("PUBLISHED_VERSION_IMMUTABLE", "This version is already sealed.");
    visionWaypointDraftConfigurationSchema.parse(parseJson(version.draftConfiguration));
    const packageValue = developmentVisionPackageSchema.parse({
      packageSchemaVersion: 1,
      packageType: "development-mock",
      waypointId: version.waypointId,
      waypointVersionId: version.id,
      waypointVersion: version.versionNumber,
      mockScenario: parsedScenario,
      compatibility: { protocol: "1.0", minimumAppVersion: "0.3.0-b1" },
    });
    const serializedPackage = JSON.stringify(packageValue);
    const packageHash = createHash("sha256").update(serializedPackage).digest("hex");
    const publishedAt = new Date();
    const artifactReference = `development-package://sha256/${packageHash}`;
    const updated = await tx.visionWaypointVersion.update({
      where: { id: version.id },
      data: {
        lifecycleStatus: "PUBLISHED",
        publishedBy: actorId,
        publishedAt,
        packageArtifactReference: artifactReference,
        compatibilityMetadata: JSON.stringify({
          protocol: "1.0",
          packageSchemaVersion: 1,
          minimumAppVersion: "0.3.0-b1",
          developmentMock: true,
        }),
      },
    });
    const publication = await tx.visionWaypointPublication.create({
      data: {
        waypointVersionId: version.id,
        packageHash,
        packageSchemaVersion: 1,
        publishedAt,
        publishedBy: actorId,
        compatibilityRange: JSON.stringify({ protocol: "1.0", packageSchemaVersion: [1] }),
      },
    });
    await tx.visionBuildArtifact.create({
      data: {
        waypointVersionId: version.id,
        artifactType: "DEVELOPMENT_MOCK_PACKAGE",
        storageReference: artifactReference,
        contentHash: packageHash,
        fileSize: Buffer.byteLength(serializedPackage),
        schemaVersion: 1,
      },
    });
    await audit(tx, {
      actorId,
      action: "VISION_WAYPOINT_VERSION_PUBLISHED",
      resourceType: "VISION_WAYPOINT_VERSION",
      resourceId: version.id,
      metadata: {
        waypointId: version.waypointId,
        versionNumber: version.versionNumber,
        packageHash,
        mockScenario: parsedScenario,
      },
    });
    return publicVersion({ ...updated, publication });
  });
}

export async function deprecatePublishedVersion(versionId: string, actorId: string) {
  return db.$transaction(async (tx) => {
    const version = await tx.visionWaypointVersion.findFirstOrThrow({
      where: { id: versionId, waypoint: { ownerId: actorId }, publishedAt: { not: null } },
      include: { publication: true },
    });
    if (!version.publication)
      throw new VisionDomainError("VERSION_NOT_PUBLISHED", "Only a published version can be deprecated.");
    const deprecatedAt = version.deprecatedAt ?? new Date();
    const updated = await tx.visionWaypointVersion.update({
      where: { id: versionId },
      data: { lifecycleStatus: "DEPRECATED", deprecatedAt },
    });
    await tx.visionWaypointPublication.update({
      where: { waypointVersionId: versionId },
      data: { status: "DEPRECATED" },
    });
    await audit(tx, {
      actorId,
      action: "VISION_WAYPOINT_VERSION_DEPRECATED",
      resourceType: "VISION_WAYPOINT_VERSION",
      resourceId: versionId,
      metadata: { waypointId: version.waypointId, retainedBindings: true },
    });
    return { id: updated.id, deprecatedAt: deprecatedAt.toISOString(), lifecycleStatus: updated.lifecycleStatus };
  });
}

export async function getLatestDraft(waypointId: string, actorId: string) {
  const version = await db.visionWaypointVersion.findFirst({
    where: { waypointId, waypoint: { ownerId: actorId }, publishedAt: null },
    orderBy: { versionNumber: "desc" },
    include: { publication: true },
  });
  return version ? publicVersion(version) : null;
}

export async function getPublishedVersions(waypointId: string, actorId: string) {
  const versions = await db.visionWaypointVersion.findMany({
    where: { waypointId, waypoint: { ownerId: actorId }, publishedAt: { not: null } },
    orderBy: { versionNumber: "desc" },
    include: { publication: true },
  });
  return versions.map(publicVersion);
}

export async function getWaypointUsage(waypointId: string, actorId: string) {
  const waypoint = await db.visionWaypoint.findFirstOrThrow({ where: { id: waypointId, ownerId: actorId } });
  const bindings = await db.storyWaypointBinding.findMany({
    where: { waypointId: waypoint.id },
    include: {
      story: { select: { id: true, title: true, slug: true } },
      block: { select: { id: true, title: true } },
      waypointVersion: true,
    },
  });
  return bindings.map((binding) => ({
    id: binding.id,
    story: binding.story,
    block: binding.block,
    waypointVersion: {
      id: binding.waypointVersion.id,
      versionNumber: binding.waypointVersion.versionNumber,
      lifecycleStatus: binding.waypointVersion.lifecycleStatus,
    },
    runtimeMode: binding.runtimeMode,
    updatedAt: binding.updatedAt.toISOString(),
  }));
}

async function validateBindingTarget(
  tx: Prisma.TransactionClient,
  input: z.infer<typeof bindingInputSchema>,
  actorId: string,
) {
  if (input.runtimeMode !== "DEVELOPMENT_MOCK")
    throw new VisionDomainError("RUNTIME_MODE_DISABLED", "B-1 permits only DEVELOPMENT_MOCK bindings.");
  const [story, block, version] = await Promise.all([
    tx.tallTale.findFirst({ where: { id: input.storyId, creatorId: actorId } }),
    tx.storyBlock.findFirst({ where: { id: input.blockId, chapter: { draft: { taleId: input.storyId } } } }),
    tx.visionWaypointVersion.findUnique({ where: { id: input.waypointVersionId }, include: { waypoint: true } }),
  ]);
  if (!story || !block) throw new VisionDomainError("STORY_BLOCK_NOT_FOUND", "The story block is unavailable.");
  if (!version?.publishedAt)
    throw new VisionDomainError(
      "PUBLISHED_VERSION_REQUIRED",
      "Story blocks must reference an immutable published version.",
    );
  if (version.waypoint.ownerId !== actorId)
    throw new VisionDomainError("WAYPOINT_PERMISSION_DENIED", "This waypoint cannot be bound by the current creator.");
  return { story, block, version };
}

export async function bindWaypointVersionToStory(unchecked: unknown, actorId: string) {
  const input = bindingInputSchema.parse(unchecked);
  return db.$transaction(async (tx) => {
    const { version } = await validateBindingTarget(tx, input, actorId);
    const binding = await tx.storyWaypointBinding.create({
      data: {
        storyId: input.storyId,
        blockId: input.blockId,
        waypointId: version.waypointId,
        waypointVersionId: version.id,
        runtimeMode: input.runtimeMode,
        scanInteraction: JSON.stringify(input.scanInteraction),
        successEvent: input.successEvent,
        retryMessageConfiguration: JSON.stringify(input.retryMessageConfiguration),
        failureMessageConfiguration: JSON.stringify(input.failureMessageConfiguration),
        captainFallbackPolicy: JSON.stringify(input.captainFallbackPolicy),
        offlineBehavior: input.offlineBehavior,
      },
    });
    await audit(tx, {
      actorId,
      action: "VISION_WAYPOINT_BOUND_TO_STORY",
      resourceType: "STORY_WAYPOINT_BINDING",
      resourceId: binding.id,
      metadata: { storyId: input.storyId, blockId: input.blockId, waypointVersionId: version.id },
    });
    return binding;
  });
}

export async function replaceStoryWaypointBinding(bindingId: string, unchecked: unknown, actorId: string) {
  const input = bindingInputSchema.parse(unchecked);
  return db.$transaction(async (tx) => {
    const prior = await tx.storyWaypointBinding.findFirstOrThrow({
      where: { id: bindingId, story: { creatorId: actorId } },
    });
    const { version } = await validateBindingTarget(tx, input, actorId);
    const binding = await tx.storyWaypointBinding.update({
      where: { id: bindingId },
      data: {
        storyId: input.storyId,
        blockId: input.blockId,
        waypointId: version.waypointId,
        waypointVersionId: version.id,
        runtimeMode: input.runtimeMode,
        scanInteraction: JSON.stringify(input.scanInteraction),
        successEvent: input.successEvent,
        retryMessageConfiguration: JSON.stringify(input.retryMessageConfiguration),
        failureMessageConfiguration: JSON.stringify(input.failureMessageConfiguration),
        captainFallbackPolicy: JSON.stringify(input.captainFallbackPolicy),
        offlineBehavior: input.offlineBehavior,
      },
    });
    await audit(tx, {
      actorId,
      action: "VISION_WAYPOINT_BINDING_REPLACED",
      resourceType: "STORY_WAYPOINT_BINDING",
      resourceId: binding.id,
      metadata: { priorVersionId: prior.waypointVersionId, waypointVersionId: version.id, storyId: input.storyId },
    });
    return binding;
  });
}

export async function deleteStoryWaypointBinding(bindingId: string, actorId: string) {
  return db.$transaction(async (tx) => {
    const binding = await tx.storyWaypointBinding.findFirstOrThrow({
      where: { id: bindingId, story: { creatorId: actorId } },
    });
    await tx.storyWaypointBinding.delete({ where: { id: binding.id } });
    await audit(tx, {
      actorId,
      action: "VISION_WAYPOINT_BINDING_REMOVED",
      resourceType: "STORY_WAYPOINT_BINDING",
      resourceId: binding.id,
      metadata: { storyId: binding.storyId, blockId: binding.blockId, waypointVersionId: binding.waypointVersionId },
    });
    return { deleted: true };
  });
}

export async function syncVisionBindingsForDraft(
  tx: Prisma.TransactionClient,
  storyId: string,
  blocks: Array<{ id: string; type: string; configuration: Record<string, unknown> }>,
  actorId: string,
) {
  for (const block of blocks.filter(
    (candidate) =>
      candidate.type === "visionWaypoint" || candidate.configuration.verificationProvider === "visionLocation",
  )) {
    const versionId = String(block.configuration.waypointVersionId ?? "");
    if (!versionId) continue;
    const version = await tx.visionWaypointVersion.findUnique({
      where: { id: versionId },
      include: { waypoint: true },
    });
    if (!version?.publishedAt)
      throw new VisionDomainError(
        "PUBLISHED_VERSION_REQUIRED",
        `Vision block ${block.id} must reference an immutable published waypoint version.`,
      );
    if (version.waypoint.ownerId !== actorId)
      throw new VisionDomainError("WAYPOINT_PERMISSION_DENIED", "The selected waypoint is not owned by this creator.");
    const runtimeMode = waypointRuntimeModeSchema.parse(block.configuration.runtimeMode ?? "DEVELOPMENT_MOCK");
    if (runtimeMode !== "DEVELOPMENT_MOCK")
      throw new VisionDomainError("RUNTIME_MODE_DISABLED", "B-1 permits only DEVELOPMENT_MOCK story blocks.");
    const scanInteraction = {
      mode: block.configuration.scanMode ?? "HOLD",
      holdDurationMs: Number(block.configuration.holdDurationMs ?? 5_000),
      progressAnnouncementIntervalMs: Number(block.configuration.progressAnnouncementIntervalMs ?? 1_000),
    };
    const fallback = {
      enabled: Boolean(block.configuration.captainFallbackEnabled ?? true),
      allowManualApprove: true,
      allowManualReject: true,
      requireReason: true,
    };
    const retryMessages = jsonObject.parse({
      insufficient: block.configuration.insufficientMessage ?? "Move slowly and inspect the surroundings again.",
      ambiguous: block.configuration.ambiguousMessage ?? "Show more of the surrounding landmarks.",
    });
    const failureMessages = jsonObject.parse({
      notAtTarget: block.configuration.notAtTargetMessage ?? "The compass remains silent here.",
      systemError: block.configuration.systemErrorMessage ?? "The vision helper is unavailable. Ask the Captain.",
    });
    const binding = await tx.storyWaypointBinding.create({
      data: {
        storyId,
        blockId: block.id,
        waypointId: version.waypointId,
        waypointVersionId: version.id,
        runtimeMode,
        scanInteraction: JSON.stringify(scanInteraction),
        successEvent: String(block.configuration.successEvent ?? "vision.verification_succeeded"),
        retryMessageConfiguration: JSON.stringify(retryMessages),
        failureMessageConfiguration: JSON.stringify(failureMessages),
        captainFallbackPolicy: JSON.stringify(fallback),
        offlineBehavior: String(block.configuration.offlineBehavior ?? "CAPTAIN_FALLBACK"),
      },
    });
    await audit(tx, {
      actorId,
      action: "VISION_WAYPOINT_BINDING_SYNCHRONIZED",
      resourceType: "STORY_WAYPOINT_BINDING",
      resourceId: binding.id,
      metadata: { storyId, blockId: block.id, waypointVersionId: version.id },
    });
  }
}
