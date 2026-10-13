import { createHash } from "node:crypto";
import { z } from "zod";
import type { PrismaClient } from "@prisma/client";
import { db } from "@/lib/db";
import { canonicalChecksum } from "@/drydock/canonical";
import { draftSchema } from "./authoring";
import { spatialId } from "./contracts";
import { editingGroupMemberSchema } from "./editing-group-contracts";
import { readAssistantConversation, publicAssistantResult } from "./assistant-conversation";
import { assertSpatialDraftAccess, spatialItemKind } from "./library-service";
import {
  assistantSceneDigest,
  assistantProposalSchema,
  materializeAssistantInterpretation,
  prepareAssistantContext,
  SpatialAssistantError,
} from "./spatial-assistant";
import {
  reserveAIUsage,
  markAIDispatched,
  settleAIUsage,
  failAIUsage,
  creatorAIUsage,
  readAIPolicy,
} from "./ai-ledger";
import {
  openAIProviderConfiguration,
  prepareOpenAIRequest,
  invokeOpenAISpatialAssistant,
  OpenAIProviderError,
} from "./openai-provider";

export const assistantRequestSchema = z.strictObject({
  draft: draftSchema,
  revision: z.number().int().min(1),
  editorGeneration: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  requestId: spatialId,
  idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{16,128}$/),
  request: z.string().trim().min(1).max(2000),
  selectedEntityId: spatialId.nullable(),
  selectedGroupId: spatialId.nullable().optional(),
  selectedMembers: z.array(editingGroupMemberSchema).max(288).optional(),
  previousRequestId: spatialId.nullable().optional(),
  mode: z.enum(["STANDARD", "ADVANCED"]),
});
export type AssistantRequest = z.infer<typeof assistantRequestSchema>;

/** Paid inference is allowed only for an owner-bound, saved exact revision. The API authenticates/CSRF-checks first. */
export async function requestSpatialAssistant(
  accountId: string,
  raw: unknown,
  options: { signal?: AbortSignal; fetcher?: typeof fetch; store?: PrismaClient } = {},
) {
  const started = performance.now(),
    input = assistantRequestSchema.parse(raw),
    store = options.store ?? db;
  await assertSpatialDraftAccess(input.draft);
  const row = await store.reusableAuthoringItem.findFirst({
    where: { id: input.draft.content.definitionId, ownerAccountId: accountId, kind: spatialItemKind, archivedAt: null },
    include: { versions: { where: { versionNumber: 0 } } },
  });
  const version = row?.versions[0];
  if (!row || !version)
    throw new SpatialAssistantError(
      "DRAFT_UNAVAILABLE",
      "Save your owned working draft before requesting assistance.",
      404,
    );
  if (
    row.currentVersionNumber !== input.revision ||
    version.checksum !== canonicalChecksum(input.draft) ||
    version.checksum !== canonicalChecksum(JSON.parse(version.envelope))
  )
    throw new SpatialAssistantError(
      "STALE_SCENE",
      "Your scene has changed. Save and review its current state before requesting assistance.",
      409,
    );
  const fingerprint = createHash("sha256").update(JSON.stringify(input)).digest("hex");
  const { policy } = await readAIPolicy(store);
  const configuration = openAIProviderConfiguration(policy);
  if (!configuration.configured)
    return {
      status: "UNAVAILABLE" as const,
      code: "PROVIDER_UNCONFIGURED",
      message: "Spatial Assistant is not configured. Manual editing remains available.",
      usage: await creatorAIUsage(accountId, store),
    };
  if (options.signal?.aborted)
    throw new SpatialAssistantError("REQUEST_CANCELLED", "Assistance was cancelled. Your scene is unchanged.", 409);
  const admission = await reserveAIUsage(
    {
      accountId,
      requestId: input.requestId,
      idempotencyKey: input.idempotencyKey,
      fingerprint,
      definitionId: input.draft.content.definitionId,
      operationCategory: "AUTHORING",
      mode: input.mode,
    },
    store,
  );
  if (admission.replay) {
    if (admission.record.result && (!admission.record.resultExpiresAt || admission.record.resultExpiresAt > new Date()))
      return {
        ...publicAssistantResult(JSON.parse(admission.record.result)),
        usage: await creatorAIUsage(accountId, store),
        replay: true,
      };
    return {
      status: "UNCHANGED" as const,
      code: "REQUEST_ALREADY_ADMITTED",
      message:
        "This request was already admitted. It will not be sent or charged again. Submit a new instruction when ready.",
      usage: await creatorAIUsage(accountId, store),
      replay: true,
    };
  }
  const timings: Record<string, number> = { admissionMs: performance.now() - started };
  try {
    const contextStarted = performance.now();
    // Replay does not depend on older context still existing. New requests resolve
    // bounded private discussion before dispatch; failures release undispatched capacity.
    const conversation = await readAssistantConversation(store, accountId, input.draft, input.previousRequestId);
    const context = {
      ...prepareAssistantContext(input.draft, input.selectedEntityId, input.selectedGroupId, input.selectedMembers),
      recentTaskTurns: conversation,
    };
    const body = await prepareOpenAIRequest(
      {
        request: input.request,
        context,
        mode: input.mode,
        model: admission.model,
        policy: admission.policy,
      },
      options.signal,
      options.fetcher,
    );
    const sceneDigest = await assistantSceneDigest(input.draft);
    timings.contextMs = performance.now() - contextStarted;
    await markAIDispatched(admission.record.id, store);
    const providerStarted = performance.now();
    const outcome = await invokeOpenAISpatialAssistant(
      body,
      admission.policy.timeoutMs,
      options.signal,
      options.fetcher,
    );
    timings.providerMs = performance.now() - providerStarted;
    let result: Record<string, unknown>;
    if (outcome.failure) result = { status: "FAILED", ...outcome.failure };
    else {
      const validateStarted = performance.now();
      try {
        const materializationStarted = performance.now();
        materializeAssistantInterpretation(input.draft, outcome.interpretation);
        timings.materializationMs = performance.now() - materializationStarted;
        const proposal = assistantProposalSchema.parse({
          ...(outcome.interpretation as object),
          schemaVersion: 1,
          requestId: input.requestId,
          definitionId: input.draft.content.definitionId,
          sceneRevision: input.revision,
          editorGeneration: input.editorGeneration,
          sceneDigest,
        });
        result = { status: "PROPOSED", proposal };
      } catch {
        result = {
          status: "FAILED",
          code: "REJECTED_OPERATION",
          message:
            "The proposed changes did not pass spatial validation. Your scene is unchanged. Try a more specific supported change.",
        };
      }
      timings.validationMs = performance.now() - validateStarted;
    }
    const retained =
      result.status === "PROPOSED"
        ? {
            ...result,
            conversation: { request: input.request, previousRequestId: input.previousRequestId ?? null },
          }
        : result;
    if (outcome.usage)
      await settleAIUsage(
        admission.record.id,
        { usage: outcome.usage, providerResponseId: outcome.responseId, result: retained, timings },
        store,
      );
    else
      await failAIUsage(admission.record.id, "UNKNOWN_PROVIDER_USAGE", false, store, new Date(), {
        result: { ...retained, accounting: "CONSERVATIVE_PENDING" },
        timings,
      });
    return {
      ...result,
      usage: await creatorAIUsage(accountId, store),
      accounting: outcome.usage ? "SETTLED" : "CONSERVATIVE_PENDING",
    };
  } catch (cause) {
    const failure =
      cause instanceof OpenAIProviderError
        ? cause
        : cause instanceof SpatialAssistantError
          ? cause
          : new SpatialAssistantError(
              "ASSISTANT_FAILURE",
              "Spatial Assistant could not finish this request. Your scene is unchanged.",
              503,
            );
    await failAIUsage(
      admission.record.id,
      failure.code,
      cause instanceof OpenAIProviderError && cause.definitelyUnbilled,
      store,
    );
    throw failure;
  }
}
