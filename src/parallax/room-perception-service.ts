import { createHash } from "node:crypto";
import { z } from "zod";
import type { PrismaClient } from "@prisma/client";
import { db } from "@/lib/db";
import { canonicalChecksum } from "@/drydock/canonical";
import type { PrivateProviderRuntime } from "@/private-content/providers";
import { readProtectedRoomPhoto } from "@/private-content/media/room-photo";
import { roomObservationSchema, roomObservationResponseSchema } from "@/watchglass/room-observation";
import { buildRoomPerceptionRequest } from "@/watchglass/room-perception";
import { draftSchema, type SpatialDraft } from "./authoring";
import { spatialId } from "./contracts";
import { roomEnvironmentSchema } from "./environment-contracts";
import { spatialItemKind, assertSpatialDraftAccess, saveSpatialDraftInTransaction } from "./library-service";
import { assistantSceneDigest, SpatialAssistantError } from "./spatial-assistant";
import {
  reserveAIUsage,
  markAIDispatched,
  settleAIUsage,
  failAIUsage,
  creatorAIUsage,
  readAIPolicy,
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
  if (
    !version ||
    row?.currentVersionNumber !== revision ||
    version.checksum !== canonicalChecksum(draft) ||
    version.checksum !== canonicalChecksum(JSON.parse(version.envelope))
  )
    throw new SpatialAssistantError("STALE_SCENE", "Save this owned scene before reconstructing its room.", 409);
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
  const input = roomPerceptionRequestSchema.parse(raw),
    store = options.store ?? db;
  await assertSavedRoomDraft(store, accountId, input.draft, input.revision);
  const existing = input.draft.content.studio?.environment;
  if (Buffer.byteLength(JSON.stringify(existing ?? {})) > 24_000)
    throw new SpatialAssistantError(
      "ROOM_CONTEXT_TOO_LARGE",
      "This room is too detailed for a retained photo proposal. Correct its features manually or use a simpler scene.",
      413,
    );
  if (existing && (!input.sharedFeatureId || !existing.features.some((f) => f.id === input.sharedFeatureId)))
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
  const admission = await reserveAIUsage(
    {
      accountId,
      requestId: input.requestId,
      idempotencyKey: input.idempotencyKey,
      fingerprint,
      definitionId: input.draft.content.definitionId,
      operationCategory: "ROOM_RECONSTRUCTION",
      mode: "STANDARD",
    },
    store,
  );
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
    const body = buildRoomPerceptionRequest({
      images,
      existing,
      sharedFeatureId: input.sharedFeatureId ?? undefined,
      model: admission.model,
      policy: admission.policy,
    });
    const tokens = await countOpenAIInputTokens(body, admission.policy.timeoutMs, options.signal, options.fetcher);
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
    const outcome = await invokeOpenAISpatialAssistant(
      body,
      admission.policy.timeoutMs,
      options.signal,
      options.fetcher,
      roomObservationResponseSchema,
    );
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
    if (outcome.usage)
      await settleAIUsage(
        admission.record.id,
        { usage: outcome.usage, providerResponseId: outcome.responseId, result },
        store,
      );
    else
      await failAIUsage(admission.record.id, "UNKNOWN_PROVIDER_USAGE", false, store, new Date(), {
        result,
        timings: {},
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
  await assertSavedRoomDraft(store, accountId, input.draft, input.revision);
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
  const saved = await store.$transaction((tx) => saveSpatialDraftInTransaction(accountId, draft, input.revision, tx));
  return { draft, revision: saved };
}
