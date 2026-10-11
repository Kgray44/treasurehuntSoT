import { z } from "zod";
import { draftSchema } from "@/parallax/authoring";
import { spatialId } from "@/parallax/contracts";
import { creatorAIUsageSchema as usageSchema } from "@/parallax/ai-policy";
import {
  assistantProposalSchema,
  assistantSceneDigest,
  materializeAssistantProposal,
  SpatialAssistantError,
} from "@/parallax/spatial-assistant";
import type { SpatialAssistantBase, SpatialAssistantPort, SpatialAssistantSavedDraft } from "./SpatialAssistant";

const baseSchema = z.object({
  draft: draftSchema,
  revision: z.number().int().min(1),
  editorGeneration: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
});
const replySchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("PROPOSED"), proposal: assistantProposalSchema, usage: usageSchema.optional() }),
  z.object({
    status: z.enum(["UNAVAILABLE", "UNCHANGED", "FAILED"]),
    code: z.string().max(100).optional(),
    message: z.string().max(1000).optional(),
    usage: usageSchema.optional(),
  }),
]);
const savedSchema = z.object({ status: z.literal("SAVED"), draft: draftSchema, revision: z.number().int().min(1) });
const safeMessages: Record<string, string> = {
  USER_MONTHLY_REQUESTS:
    "You've used your Spatial Assistant allowance for this month. Your drafts are safe; manual editing remains available.",
  USER_MONTHLY_BUDGET: "Your monthly Spatial Assistant allowance has been reached. Manual editing remains available.",
  GLOBAL_MONTHLY_REQUESTS:
    "Spatial Assistant is temporarily unavailable because the platform allowance has been reached.",
  GLOBAL_MONTHLY_BUDGET:
    "Spatial Assistant is temporarily unavailable because the platform AI budget has been reached.",
  AI_DISABLED: "Spatial Assistant is disabled. Manual editing remains available.",
  AI_SUSPENDED: "Spatial Assistant access is paused for your account. Manual editing remains available.",
  ADVANCED_UNAVAILABLE: "Advanced assistance is unavailable for this account.",
  MODEL_UNAVAILABLE: "The selected assistance model is unavailable.",
  CONTEXT_UNAVAILABLE: "The earlier task context is unavailable or expired. Start a new task using your current scene.",
  STALE_SCENE: "Your scene has changed. Regenerate the proposal to preserve your newer work.",
  DRAFT_CONFLICT: "The saved scene changed. Review its current revision before applying changes.",
  IDEMPOTENCY_CONFLICT: "This request identity belongs to another change. Review the current scene before retrying.",
  PROPOSAL_UNAVAILABLE: "The reviewed proposal is unavailable or expired. Request a fresh proposal.",
  PROPOSAL_ALREADY_APPLIED: "These changes were saved earlier. Reopen the current scene to preserve later work.",
  ADAPTIVE_SETUP_REQUIRED:
    "Enable adaptive placement with the guided controls before requesting semantic recipe changes.",
};
class HTTPFailure extends SpatialAssistantError {
  constructor(
    code: string,
    message: string,
    status: number,
    public readonly usage?: z.infer<typeof usageSchema>,
  ) {
    super(code, message, status);
  }
}
function assertSameBase(current: SpatialAssistantBase, expected: SpatialAssistantBase) {
  if (
    current.revision !== expected.revision ||
    current.editorGeneration !== expected.editorGeneration ||
    JSON.stringify(current.draft) !== JSON.stringify(expected.draft)
  )
    throw new SpatialAssistantError("STALE_SCENE", safeMessages.STALE_SCENE, 409);
}

/** Canonical Studio adapter. The host owns persistence/history; the existing
 * authenticated route owns inference and atomic saved application.
 * One stable adapter instance belongs to one account/draft.
 */
export function createSpatialAssistantPort(host: {
  scope: () => { accountId: string; definitionId: string };
  csrfToken: () => string;
  readBase: () => SpatialAssistantBase;
  prepareBase: () => Promise<SpatialAssistantBase>;
  // Synchronous: recheck expected generation, install ONE ordinary history
  // replacement and mark saved draft/revision before returning. Never autosave it again.
  installSaved: (saved: SpatialAssistantSavedDraft, expected: SpatialAssistantBase) => void;
  fetcher?: typeof fetch;
}): SpatialAssistantPort {
  const fetcher = host.fetcher ?? fetch;
  const initialScope = { ...host.scope() };
  function assertScope() {
    const currentScope = host.scope();
    if (currentScope.accountId !== initialScope.accountId || currentScope.definitionId !== initialScope.definitionId)
      throw new SpatialAssistantError(
        "SCOPE_CHANGED",
        "Reopen Spatial Assistant for the current account and scene.",
        409,
      );
  }
  function readBase() {
    assertScope();
    const base = baseSchema.safeParse(host.readBase());
    if (!base.success || base.data.draft.content.definitionId !== initialScope.definitionId)
      throw new SpatialAssistantError(
        "DRAFT_UNAVAILABLE",
        "Save your current working scene before requesting assistance.",
        409,
      );
    return base.data;
  }
  const applications = new Map<
    string,
    { identity: string; pending?: Promise<SpatialAssistantSavedDraft>; saved?: SpatialAssistantSavedDraft }
  >();
  async function post(body: unknown, signal?: AbortSignal) {
    if (signal?.aborted)
      throw new SpatialAssistantError("REQUEST_CANCELLED", "Assistance was cancelled. Your scene is unchanged.", 409);
    const csrf = host.csrfToken();
    if (!csrf)
      throw new SpatialAssistantError(
        "CREATOR_SESSION_REQUIRED",
        "Refresh your Creator session before requesting assistance.",
        401,
      );
    const serialized = JSON.stringify(body);
    if (new TextEncoder().encode(serialized).byteLength > 256 * 1024)
      throw new SpatialAssistantError("REQUEST_SIZE", "This spatial request exceeds the supported size.", 413);
    let response: Response;
    try {
      response = await fetcher("/api/studio/parallax", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        redirect: "error",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
        body: serialized,
        signal,
      });
    } catch {
      if (signal?.aborted)
        throw new SpatialAssistantError("REQUEST_CANCELLED", "Assistance was cancelled. Your scene is unchanged.", 409);
      throw new SpatialAssistantError(
        "STUDIO_CONNECTION_UNCERTAIN",
        "The Studio response did not arrive. Keep your local work; retry the same reviewed change if saving was uncertain.",
        503,
      );
    }
    let data: unknown;
    try {
      const text = await response.text();
      // A saved acknowledgement includes the existing bounded working draft,
      // which can be larger than a provider proposal. Retain small envelope headroom.
      if (new TextEncoder().encode(text).byteLength > 256 * 1024 + 4096) throw new Error("Bounded response exceeded");
      data = JSON.parse(text);
    } catch {
      if (signal?.aborted)
        throw new SpatialAssistantError("REQUEST_CANCELLED", "Assistance was cancelled. Your scene is unchanged.", 409);
      throw new SpatialAssistantError(
        "INVALID_STUDIO_RESPONSE",
        "The Studio response could not be verified. Retry the same reviewed change if saving was uncertain.",
        502,
      );
    }
    if (!response.ok) {
      const error = z.object({ code: z.string().max(100).optional() }).safeParse(data);
      const code =
        error.success && error.data.code && Object.hasOwn(safeMessages, error.data.code)
          ? error.data.code
          : "STUDIO_REQUEST_FAILED";
      const usage = z.object({ usage: usageSchema }).safeParse(data);
      throw new HTTPFailure(
        code,
        safeMessages[code] ??
          (response.status === 401 || response.status === 403
            ? "Refresh your Creator session before trying again."
            : response.status === 429
              ? "Spatial Assistant is busy. Please try again shortly."
              : "The Studio request could not finish. Your local scene is unchanged."),
        response.status,
        usage.success ? usage.data.usage : undefined,
      );
    }
    return data;
  }
  return {
    async prepareBase() {
      assertScope();
      const saved = baseSchema.parse(await host.prepareBase());
      assertSameBase(readBase(), saved);
      return saved;
    },
    async request(input, signal) {
      const expected = baseSchema.parse(input);
      assertSameBase(readBase(), expected);
      let raw: unknown;
      try {
        raw = await post(
          {
            action: "AI",
            kind: "ASSISTANT",
            draft: input.draft,
            revision: input.revision,
            editorGeneration: input.editorGeneration,
            requestId: input.requestId,
            idempotencyKey: input.idempotencyKey,
            request: input.request,
            selectedEntityId: input.selectedEntityId,
            previousRequestId: input.previousRequestId ?? null,
            mode: input.mode,
          },
          signal,
        );
      } catch (cause) {
        if (!(cause instanceof HTTPFailure)) throw cause;
        assertSameBase(readBase(), expected);
        return {
          status: cause.status >= 500 ? "UNAVAILABLE" : "FAILED",
          code: cause.code,
          message: cause.message,
          usage: cause.usage,
        };
      }
      assertSameBase(readBase(), expected);
      const checked = replySchema.safeParse(raw);
      if (!checked.success)
        throw new SpatialAssistantError(
          "INVALID_STUDIO_RESPONSE",
          "The assistance response could not be verified. Request a fresh proposal.",
          502,
        );
      const data = checked.data;
      if (
        data.status === "PROPOSED" &&
        (data.proposal.requestId !== input.requestId ||
          data.proposal.definitionId !== input.draft.content.definitionId ||
          data.proposal.sceneRevision !== input.revision ||
          data.proposal.editorGeneration !== input.editorGeneration ||
          data.proposal.sceneDigest !== (await assistantSceneDigest(input.draft)))
      )
        throw new SpatialAssistantError(
          "PROPOSAL_MISMATCH",
          "The response does not belong to this request. Request a fresh proposal.",
          409,
        );
      assertSameBase(readBase(), expected);
      return data;
    },
    apply(proposal, selectedOperationIds, idempotencyKey) {
      try {
        readBase();
        z.string()
          .regex(/^[A-Za-z0-9_-]{16,128}$/)
          .parse(idempotencyKey);
        z.array(spatialId).min(1).max(24).parse(selectedOperationIds);
      } catch (cause) {
        return Promise.reject(cause);
      }
      const identity = JSON.stringify({ proposal, selectedOperationIds: [...selectedOperationIds].sort() });
      const existing = applications.get(idempotencyKey);
      if (existing && existing.identity !== identity)
        return Promise.reject(
          new SpatialAssistantError("IDEMPOTENCY_CONFLICT", safeMessages.IDEMPOTENCY_CONFLICT, 409),
        );
      if (existing?.saved) return Promise.resolve(existing.saved);
      if (existing?.pending) return existing.pending;
      if (!existing && applications.size >= 32) {
        const idle = [...applications].find(([, value]) => !value.pending);
        if (!idle)
          return Promise.reject(
            new SpatialAssistantError(
              "APPLY_BUSY",
              "A reviewed change is still saving. Please wait before applying another.",
              409,
            ),
          );
        applications.delete(idle[0]);
      }
      const entry = existing ?? { identity };
      applications.set(idempotencyKey, entry);
      const pending = (async () => {
        const expected = readBase();
        const next = await materializeAssistantProposal(
          expected.draft,
          expected.revision,
          proposal,
          selectedOperationIds,
          expected.editorGeneration,
        );
        assertSameBase(readBase(), expected);
        const acknowledgement = savedSchema.safeParse(
          await post({ action: "ASSISTANT_APPLY", proposal, selectedOperationIds, idempotencyKey }),
        );
        if (!acknowledgement.success)
          throw new SpatialAssistantError(
            "SAVE_ACKNOWLEDGEMENT_INVALID",
            "The canonical save acknowledgement could not be verified. Retry this reviewed change before installing it.",
            409,
          );
        const saved = acknowledgement.data;
        if (saved.revision !== expected.revision + 1 || JSON.stringify(saved.draft) !== JSON.stringify(next))
          throw new SpatialAssistantError(
            "SAVE_ACKNOWLEDGEMENT_INVALID",
            "The canonical save acknowledgement could not be verified. Retry this reviewed change before installing it.",
            409,
          );
        assertSameBase(readBase(), expected);
        host.installSaved(saved, expected);
        entry.saved = saved;
        return saved;
      })();
      entry.pending = pending;
      void pending
        .finally(() => {
          entry.pending = undefined;
        })
        .catch(() => {});
      return pending;
    },
  };
}
