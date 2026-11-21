import { createHash } from "node:crypto";
import { z } from "zod";
import type { PrismaClient } from "@prisma/client";
import { db } from "@/lib/db";
import { canonicalChecksum } from "@/drydock/canonical";
import type { PrivateProviderRuntime } from "@/private-content/providers";
import { readProtectedRoomPhoto } from "@/private-content/media/room-photo";
import { roomObservationSchema, roomObservationResponseSchema } from "@/watchglass/room-observation";
import { buildRoomPerceptionRequest, roomPerceptionContext } from "@/watchglass/room-perception";
import { draftSchema, type SpatialDraft } from "./authoring";
import { spatialId } from "./contracts";
import { roomEnvironmentSchema } from "./environment-contracts";
import { environmentDraftSchema } from "./library-lifecycle-contracts";
import { environmentPreviewDraft } from "./environment-workspace";
import { saveEnvironmentDraftInTransaction } from "./library-lifecycle-service";
import { spatialItemKind, assertSpatialDraftAccess, saveSpatialDraftInTransaction } from "./library-service";
import { assistantSceneDigest, SpatialAssistantError } from "./spatial-assistant";
import {
  reserveAIUsage,
  markAIDispatched,
  settleAIUsage,
  failAIUsage,
  creatorAIUsage,
  readAIPolicy,
  lockAIControl,
} from "./ai-ledger";
import {
  countOpenAIInputTokens,
  invokeOpenAISpatialAssistant,
  openAIProviderConfiguration,
  OpenAIProviderError,
} from "./openai-provider";
import { reconstructRoomFromObservation, RoomReconstructionError } from "./room-reconstruction";
import { syntheticRoomGeometry } from "./room-geometry";
import { verifyConstructedEnvironment } from "./construction-verification";

export const roomPerceptionRequestSchema = z.strictObject({
  draft: draftSchema,
  revision: z.number().int().min(1),
  editorGeneration: z.number().int().nonnegative(),
  requestId: spatialId,
  idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{16,128}$/),
  mediaIds: z
    .array(spatialId)
    .min(1)
    .max(2)
    .refine((ids) => new Set(ids).size === ids.length),
  sharedFeatureId: spatialId.nullable(),
});
export const roomPerceptionProposalSchema = z.strictObject({
  schemaVersion: z.literal(1),
  requestId: spatialId,
  definitionId: spatialId,
  sceneRevision: z.number().int().min(1),
  editorGeneration: z.number().int().nonnegative(),
  sceneDigest: z.string().regex(/^[a-f0-9]{64}$/),
  room: roomEnvironmentSchema,
  warnings: z.array(z.string().max(500)).max(24),
});
export type RoomPerceptionProposal = z.infer<typeof roomPerceptionProposalSchema>;

async function assertSavedRoomDraft(store: PrismaClient, accountId: string, draft: SpatialDraft, revision: number) {
  await assertSpatialDraftAccess(draft);
  const row = await store.reusableAuthoringItem.findFirst({
    where: {
      id: draft.content.definitionId,
      ownerAccountId: accountId,
      kind: spatialItemKind,
      archivedAt: null,
    },
    include: { versions: { where: { versionNumber: 0 } } },
  });
  const version = row?.versions[0];
  const stored = version ? JSON.parse(version.envelope) : null;
  const environment = stored?.format === "PARALLAX_ENVIRONMENT_DRAFT_1" ? environmentDraftSchema.parse(stored) : null;
  const comparable = environment ? environmentPreviewDraft(environment) : stored;
  if (
    !version ||
    row?.currentVersionNumber !== revision ||
    canonicalChecksum(comparable) !== canonicalChecksum(draft) ||
    version.checksum !== canonicalChecksum(stored)
  )
    throw new SpatialAssistantError("STALE_SCENE", "Save this owned scene before reconstructing its room.", 409);
  return environment;
}

/** Watchglass observes; deterministic Parallax proposes; ordinary Save/CAS remains scene authority. */
export async function requestRoomPerception(
  accountId: string,
  raw: unknown,
  options: {
    runtime: PrivateProviderRuntime;
    signal?: AbortSignal;
    fetcher?: typeof fetch;
    store?: PrismaClient;
  },
) {
  const started = performance.now();
  const timings: Record<string, number> = {};
  const input = roomPerceptionRequestSchema.parse(raw),
    store = options.store ?? db;
  await assertSavedRoomDraft(store, accountId, input.draft, input.revision);
  const existing = input.draft.content.studio?.environment;
  if (
    Buffer.byteLength(
      JSON.stringify(
        roomPerceptionContext({ images: [], existing, sharedFeatureId: input.sharedFeatureId ?? undefined }),
      ),
    ) > 24_000
  )
    throw new SpatialAssistantError(
      "ROOM_CONTEXT_TOO_LARGE",
      "This room's semantic description is too detailed for photo refinement. Simplify its features or edit the room manually.",
      413,
    );
  if (
    existing &&
    (!input.sharedFeatureId ||
      !existing.features.some((f) => f.id === input.sharedFeatureId && f.classification !== "EXCLUSION_ZONE"))
  )
    throw new SpatialAssistantError(
      "ROOM_ALIGNMENT_REQUIRED",
      "Select a feature recognizable in the additional photograph to refine this same room.",
      400,
    );
  if (!existing && input.sharedFeatureId)
    throw new SpatialAssistantError(
      "ROOM_ALIGNMENT_REQUIRED",
      "The first photograph establishes the new room frame.",
      400,
    );
  const { policy } = await readAIPolicy(store);
  if (!openAIProviderConfiguration(policy).configured)
    return {
      status: "UNAVAILABLE" as const,
      code: "PROVIDER_UNCONFIGURED",
      message: "Room reconstruction is not configured. Manual room editing remains available.",
    };
  // Authorize all bytes before admission; no raw image enters the quota ledger or browser result.
  const images = await Promise.all(
    input.mediaIds.map((mediaId) =>
      readProtectedRoomPhoto({
        ownerAccountId: accountId,
        definitionId: input.draft.content.definitionId,
        mediaId,
        runtime: options.runtime,
        signal: options.signal,
        store,
      }),
    ),
  );
  const fingerprint = createHash("sha256").update(JSON.stringify(input)).digest("hex");
  timings.contextPreparationMs = Math.round(performance.now() - started);
  const admissionStarted = performance.now();
  const priorOperation = await store.aIUsageLedger.findFirst({
    where: { accountId, definitionId: input.draft.content.definitionId, operationCategory: "ROOM_RECONSTRUCTION" },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  const admission = await reserveAIUsage(
    {
      accountId,
      requestId: input.requestId,
      idempotencyKey: input.idempotencyKey,
      fingerprint,
      definitionId: input.draft.content.definitionId,
      operationCategory: "ROOM_RECONSTRUCTION",
      logicalParentId: priorOperation?.id,
      // Room model selection is category-specific in the canonical admission.
      // Text Assistant requests keep their independent standard/advanced policy.
      mode: "STANDARD",
    },
    store,
  );
  timings.admissionMs = Math.round(performance.now() - admissionStarted);
  if (admission.replay) {
    if (admission.record.result && (!admission.record.resultExpiresAt || admission.record.resultExpiresAt > new Date()))
      return { ...JSON.parse(admission.record.result), usage: await creatorAIUsage(accountId, store), replay: true };
    return {
      status: "UNCHANGED" as const,
      message: "This request was already admitted and will not be sent again.",
      replay: true,
    };
  }
  try {
    const countingStarted = performance.now();
    const body = buildRoomPerceptionRequest({
      images,
      existing,
      sharedFeatureId: input.sharedFeatureId ?? undefined,
      model: admission.model,
      policy: admission.policy,
    });
    const tokens = await countOpenAIInputTokens(body, admission.policy.timeoutMs, options.signal, options.fetcher);
    timings.inputCountingMs = Math.round(performance.now() - countingStarted);
    if (tokens > admission.policy.maximumInputTokens)
      throw new OpenAIProviderError(
        "CONTEXT_TOO_LARGE",
        "The room images exceed the configured input allowance. Try one simpler view or ask the administrator to review the allowance.",
        true,
        413,
      );
    if (options.signal?.aborted)
      throw new OpenAIProviderError(
        "REQUEST_CANCELLED",
        "Room reconstruction was cancelled. Your scene is unchanged.",
        true,
        409,
      );
    // Consent can be withdrawn while token counting is pending. Revalidate before billable generation.
    for (const mediaId of input.mediaIds)
      await readProtectedRoomPhoto({
        ownerAccountId: accountId,
        definitionId: input.draft.content.definitionId,
        mediaId,
        runtime: options.runtime,
        signal: options.signal,
        store,
      });
    await markAIDispatched(admission.record.id, store);
    const providerStarted = performance.now();
    const outcome = await invokeOpenAISpatialAssistant(
      body,
      admission.policy.timeoutMs,
      options.signal,
      options.fetcher,
      roomObservationResponseSchema,
    );
    timings.providerMs = Math.round(performance.now() - providerStarted);
    const validationStarted = performance.now();
    let result: Record<string, unknown>;
    if (outcome.failure) result = { status: "FAILED", ...outcome.failure };
    else {
      try {
        const mapped = reconstructRoomFromObservation({
          observation: roomObservationSchema.parse(outcome.interpretation),
          roomId: existing?.id ?? `${input.draft.content.definitionId.slice(0, 64)}:photo-room`,
          sourceMediaIds: input.mediaIds,
          existing,
          sharedFeatureId: input.sharedFeatureId ?? undefined,
        });
        if (mapped.status === "CLARIFICATION") result = mapped;
        else {
          draftSchema.parse({
            ...input.draft,
            content: { ...input.draft.content, studio: { ...input.draft.content.studio, environment: mapped.room } },
          });
          result = {
            status: "PROPOSED",
            proposal: roomPerceptionProposalSchema.parse({
              schemaVersion: 1,
              requestId: input.requestId,
              definitionId: input.draft.content.definitionId,
              sceneRevision: input.revision,
              editorGeneration: input.editorGeneration,
              sceneDigest: await assistantSceneDigest(input.draft),
              room: mapped.room,
              warnings: mapped.warnings,
            }),
          };
        }
      } catch (cause) {
        result = {
          status: "FAILED",
          code: "ROOM_EVIDENCE_REJECTED",
          message:
            cause instanceof RoomReconstructionError
              ? `${cause.message} Your scene is unchanged; try a clearer view or correct the room manually.`
              : "The image estimates could not form a safe editable room. Your scene is unchanged; try a clearer view or correct the room manually.",
        };
      }
    }
    // Retain only the typed, image-free interpretation for owner-scoped diagnosis.
    // A rejected build must remain reproducible without paying for another generation.
    if (!outcome.failure && outcome.interpretation)
      result = {
        ...result,
        diagnostics: {
          stage: result.status === "FAILED" ? "LOCAL_EVIDENCE_VALIDATION" : "LOCAL_CONSTRUCTION_VALIDATION",
          observation: roomObservationSchema.parse(outcome.interpretation),
          physicalAccuracy: "NOT_VERIFIED",
        },
      };
    timings.validationMs = Math.round(performance.now() - validationStarted);
    timings.totalMs = Math.round(performance.now() - started);
    if (outcome.usage)
      await settleAIUsage(
        admission.record.id,
        {
          usage: outcome.usage,
          reportedUsage: outcome.reportedUsage,
          providerResponseId: outcome.responseId,
          result,
          timings,
        },
        store,
      );
    else
      await failAIUsage(admission.record.id, "UNKNOWN_PROVIDER_USAGE", false, store, new Date(), {
        result,
        timings,
        reportedUsage: outcome.reportedUsage,
        providerResponseId: outcome.responseId,
      });
    return {
      ...result,
      usage: await creatorAIUsage(accountId, store),
      accounting: outcome.usage ? "SETTLED" : "CONSERVATIVE_PENDING",
    };
  } catch (error) {
    await failAIUsage(
      admission.record.id,
      error instanceof SpatialAssistantError ? error.code : "ROOM_PERCEPTION_FAILURE",
      error instanceof OpenAIProviderError && error.definitelyUnbilled,
      store,
      new Date(),
      {
        result: {
          status: "FAILED",
          code: error instanceof SpatialAssistantError ? error.code : "ROOM_PERCEPTION_FAILURE",
          message: "Room reconstruction could not finish. Your scene is unchanged.",
        },
        timings: { ...timings, totalMs: Math.round(performance.now() - started) },
      },
    );
    throw error;
  }
}

export async function applyRoomPerception(
  accountId: string,
  input: {
    draft: SpatialDraft;
    revision: number;
    editorGeneration: number;
    proposal: RoomPerceptionProposal;
  },
  store: PrismaClient = db,
) {
  const proposal = roomPerceptionProposalSchema.parse(input.proposal);
  const environment = await assertSavedRoomDraft(store, accountId, input.draft, input.revision);
  const ledger = await store.aIUsageLedger.findFirst({
    where: {
      accountId,
      requestId: proposal.requestId,
      definitionId: input.draft.content.definitionId,
      operationCategory: "ROOM_RECONSTRUCTION",
    },
  });
  const stored = ledger?.result ? JSON.parse(ledger.result) : null;
  if (
    !ledger ||
    !stored?.proposal ||
    canonicalChecksum(stored.proposal) !== canonicalChecksum(proposal) ||
    (ledger.resultExpiresAt && ledger.resultExpiresAt <= new Date()) ||
    proposal.sceneRevision !== input.revision ||
    proposal.editorGeneration !== input.editorGeneration ||
    proposal.sceneDigest !== (await assistantSceneDigest(input.draft))
  )
    throw new SpatialAssistantError(
      "STALE_SCENE",
      "This room proposal no longer matches the saved scene. Review a new proposal.",
      409,
    );
  const construction = verifyConstructedEnvironment(
    proposal.room,
    syntheticRoomGeometry({ ...proposal.room, horizontal: true, vertical: true }),
  );
  if (construction.status === "NEEDS_CORRECTION")
    throw new SpatialAssistantError(
      "ROOM_GEOMETRY_INVALID",
      "This room proposal has construction problems. Review a corrected proposal before saving.",
      422,
    );
  const draft = draftSchema.parse({
    ...input.draft,
    content: { ...input.draft.content, studio: { ...input.draft.content.studio, environment: proposal.room } },
  });
  // Discovery is restored in the acknowledged draft, never through an unseen storage-only mutation.
  delete draft.content.studio!.environmentLibraryArchived;
  if (environment) {
    const document = environmentDraftSchema.parse({
      ...environment,
      room: { ...proposal.room, id: environment.id, name: environment.name },
      category: "RECONSTRUCTED",
    });
    const saved = await store.$transaction(async (tx) => {
      await lockAIControl(tx);
      const revision = await saveEnvironmentDraftInTransaction(accountId, document, input.revision, tx);
      await tx.aIUsageLedger.updateMany({
        where: { id: ledger.id, acceptedAt: null },
        data: {
          outcome: "ACCEPTED",
          outcomeAt: new Date(),
          acceptedAt: new Date(),
          acceptedResourceId: document.id,
          acceptedVersion: canonicalChecksum(document.room),
          outcomeEvidence: JSON.stringify({
            authority: "PARALLAX_ROOM_ACCEPT_AND_SAVE",
            revision,
            checksum: canonicalChecksum(document),
          }),
        },
      });
      return revision;
    });
    return { draft: environmentPreviewDraft(document), environmentDraft: document, revision: saved };
  }
  const saved = await store.$transaction(async (tx) => {
    await lockAIControl(tx);
    const revision = await saveSpatialDraftInTransaction(accountId, draft, input.revision, tx);
    await tx.aIUsageLedger.updateMany({
      where: { id: ledger.id, acceptedAt: null },
      data: {
        outcome: "ACCEPTED",
        outcomeAt: new Date(),
        acceptedAt: new Date(),
        acceptedResourceId: draft.content.definitionId,
        acceptedVersion: canonicalChecksum(proposal.room),
        outcomeEvidence: JSON.stringify({
          authority: "PARALLAX_ROOM_ACCEPT_AND_SAVE",
          revision,
          checksum: canonicalChecksum(draft),
        }),
      },
    });
    return revision;
  });
  return { draft, revision: saved };
}
