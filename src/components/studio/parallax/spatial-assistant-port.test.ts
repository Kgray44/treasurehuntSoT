// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { createSpatialDraft, draftSchema } from "@/parallax/authoring";
import {
  assistantSceneDigest,
  materializeAssistantProposal,
  type AssistantProposal,
} from "@/parallax/spatial-assistant";
import type { AssistantRequest } from "@/parallax/spatial-assistant-service";
import type { SpatialAssistantBase } from "./SpatialAssistant";
import { createSpatialAssistantPort } from "./spatial-assistant-port";

const draft = draftSchema.parse(createSpatialDraft("synthetic-port-draft"));
const input = (): AssistantRequest => ({
  draft,
  revision: 1,
  editorGeneration: 0,
  requestId: "synthetic-port-request",
  idempotencyKey: "synthetic-port-inference",
  request: "Move the map near the entrance",
  selectedEntityId: draft.content.entities[0].id,
  previousRequestId: "synthetic-prior-task",
  mode: "STANDARD",
});
async function proposal(): Promise<AssistantProposal> {
  return {
    schemaVersion: 1,
    requestId: input().requestId,
    definitionId: draft.content.definitionId,
    sceneRevision: 1,
    editorGeneration: 0,
    sceneDigest: await assistantSceneDigest(draft),
    intentType: "EDIT",
    summary: "Move the map",
    creatorExplanation: "Bring the map near the doorway",
    clarification: null,
    assumptions: [],
    warnings: [],
    unsupportedCapabilities: [],
    accessibilityNotes: [],
    operations: [
      {
        id: "move",
        type: "PLACEMENT",
        entityId: draft.content.entities[0].id,
        placement: "ENTRANCE",
        explanation: "Bring the map near the doorway",
        dependsOn: [],
      },
    ],
  };
}
function setup(fetcher: typeof fetch, csrfToken = "synthetic-csrf") {
  let base: SpatialAssistantBase = { draft, revision: 1, editorGeneration: 0 };
  let accountId = "synthetic-port-owner";
  const installSaved = vi.fn((saved: { draft: typeof draft; revision: number }) => {
    base = { draft: saved.draft, revision: saved.revision, editorGeneration: base.editorGeneration + 1 };
  });
  const prepareBase = vi.fn(async () => base);
  const port = createSpatialAssistantPort({
    scope: () => ({ accountId, definitionId: base.draft.content.definitionId }),
    csrfToken: () => csrfToken,
    readBase: () => base,
    prepareBase,
    installSaved,
    fetcher,
  });
  return {
    port,
    installSaved,
    prepareBase,
    changeBase: (next: Partial<SpatialAssistantBase>) => {
      base = { ...base, ...next };
    },
    changeAccount: () => {
      accountId = "another-synthetic-owner";
    },
  };
}
const applyKey = "synthetic-port-application";
async function acknowledgement(checked: AssistantProposal) {
  return { status: "SAVED", draft: await materializeAssistantProposal(draft, 1, checked, ["move"], 0), revision: 2 };
}

describe("Prepared canonical Spatial Assistant port", () => {
  it("prepares the first saved revision but rejects a snapshot superseded while persistence drains", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const host = setup(fetcher);
    host.changeBase({ revision: 0 });
    host.prepareBase.mockImplementationOnce(async () => {
      host.changeBase({ revision: 1, editorGeneration: 1 });
      return { draft, revision: 1, editorGeneration: 1 };
    });
    expect(await host.port.prepareBase()).toMatchObject({ revision: 1, editorGeneration: 1 });
    host.prepareBase.mockImplementationOnce(async () => {
      const snapshot = { draft, revision: 1, editorGeneration: 1 };
      host.changeBase({ editorGeneration: 2 });
      return snapshot;
    });
    await expect(host.port.prepareBase()).rejects.toMatchObject({ code: "STALE_SCENE" });
    expect(fetcher).not.toHaveBeenCalled();
    expect(host.installSaved).not.toHaveBeenCalled();
  });
  it("does not dispatch a cancelled request or one without a Creator CSRF token", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const aborted = new AbortController();
    aborted.abort();
    await expect(setup(fetcher).port.request(input(), aborted.signal)).rejects.toMatchObject({
      code: "REQUEST_CANCELLED",
    });
    await expect(setup(fetcher, "").port.request(input(), new AbortController().signal)).rejects.toMatchObject({
      code: "CREATOR_SESSION_REQUIRED",
    });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("uses only the existing authenticated Studio route with explicit request identity and cancellation", async () => {
    const checked = await proposal();
    const fetcher = vi.fn<typeof fetch>(async () =>
      Response.json({ status: "PROPOSED", proposal: checked, conversation: { request: "PRIVATE_RETAINED_TASK" } }),
    );
    const host = setup(fetcher);
    expect(await host.port.prepareBase()).toMatchObject({ draft, revision: 1, editorGeneration: 0 });
    const signal = new AbortController().signal;
    const reply = await host.port.request(input(), signal);
    expect(reply).toEqual({ status: "PROPOSED", proposal: checked });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][0]).toBe("/api/studio/parallax");
    expect(fetcher.mock.calls[0][1]).toMatchObject({
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      redirect: "error",
      signal,
      headers: { "x-csrf-token": "synthetic-csrf" },
    });
    expect(JSON.parse(fetcher.mock.calls[0][1]!.body as string)).toEqual({
      ...input(),
      selectedGroupId: null,
      selectedMembers: [],
      action: "AI",
      kind: "ASSISTANT",
    });
    expect(host.installSaved).not.toHaveBeenCalled();
  });
  it("rejects the wrong request binding and generation changes after dispatch", async () => {
    const checked = await proposal();
    const foreign = setup(
      vi.fn<typeof fetch>(async () =>
        Response.json({ status: "PROPOSED", proposal: { ...checked, requestId: "another-request" } }),
      ),
    );
    await expect(foreign.port.request(input(), new AbortController().signal)).rejects.toMatchObject({
      code: "PROPOSAL_MISMATCH",
    });
    const altered = setup(
      vi.fn<typeof fetch>(async () => {
        altered.changeBase({ editorGeneration: 2 });
        return Response.json({ status: "PROPOSED", proposal: checked });
      }),
    );
    await expect(altered.port.request(input(), new AbortController().signal)).rejects.toMatchObject({
      code: "STALE_SCENE",
    });
  });
  it("verifies the saved scene before one ordinary host install, including repeated and concurrent acknowledgements", async () => {
    const checked = await proposal(),
      saved = await acknowledgement(checked);
    const fetcher = vi.fn<typeof fetch>(async () => Response.json(saved));
    const host = setup(fetcher);
    const [a, b] = await Promise.all([
      host.port.apply(checked, ["move"], applyKey),
      host.port.apply(checked, ["move"], applyKey),
    ]);
    expect(a).toEqual(saved);
    expect(b).toEqual(saved);
    expect(await host.port.apply(checked, ["move"], applyKey)).toEqual(saved);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(host.installSaved).toHaveBeenCalledTimes(1);
    expect(host.installSaved).toHaveBeenCalledWith(saved, { draft, revision: 1, editorGeneration: 0 });
    expect(JSON.parse(fetcher.mock.calls[0][1]!.body as string)).toEqual({
      action: "ASSISTANT_APPLY",
      proposal: checked,
      selectedOperationIds: ["move"],
      idempotencyKey: applyKey,
    });
  });
  it("preserves the same application identity after an uncertain response and installs only after retry succeeds", async () => {
    const checked = await proposal(),
      saved = await acknowledgement(checked);
    const fetcher = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError("Synthetic connection lost"))
      .mockResolvedValue(Response.json(saved));
    const host = setup(fetcher);
    await expect(host.port.apply(checked, ["move"], applyKey)).rejects.toMatchObject({
      code: "STUDIO_CONNECTION_UNCERTAIN",
    });
    expect(host.installSaved).not.toHaveBeenCalled();
    await host.port.apply(checked, ["move"], applyKey);
    expect(fetcher.mock.calls[0][1]!.body).toBe(fetcher.mock.calls[1][1]!.body);
    expect(host.installSaved).toHaveBeenCalledTimes(1);
  });
  it("accepts a full bounded canonical working scene larger than the small provider response budget", async () => {
    const large = structuredClone(draft);
    large.content.entities = Array.from({ length: 32 }, (_, index) => ({
      ...draft.content.entities[0],
      id: index === 0 ? draft.content.entities[0].id : `synthetic-large-entity-${index}`,
      content: "C".repeat(2000),
      alternativeText: "A".repeat(2000),
    }));
    large.content.studio!.layers = large.content.entities.map((entity) => ({
      ...draft.content.studio!.layers[0],
      entityId: entity.id,
    }));
    const checked = { ...(await proposal()), sceneDigest: await assistantSceneDigest(large) };
    const saved = {
      status: "SAVED",
      draft: await materializeAssistantProposal(large, 1, checked, ["move"], 0),
      revision: 2,
    };
    expect(new TextEncoder().encode(JSON.stringify(saved)).byteLength).toBeGreaterThan(128 * 1024);
    const host = setup(vi.fn<typeof fetch>(async () => Response.json(saved)));
    host.changeBase({ draft: large });
    expect(await host.port.apply(checked, ["move"], applyKey)).toEqual(saved);
    expect(host.installSaved).toHaveBeenCalledTimes(1);
  });
  it.each(["wrong-scene", "wrong-revision", "malformed"])("does not install a %s acknowledgement", async (kind) => {
    const checked = await proposal(),
      saved = await acknowledgement(checked);
    const body =
      kind === "wrong-scene"
        ? { ...saved, draft }
        : kind === "wrong-revision"
          ? { ...saved, revision: 3 }
          : { status: "ACCEPTED" };
    const host = setup(vi.fn<typeof fetch>(async () => Response.json(body)));
    await expect(host.port.apply(checked, ["move"], applyKey)).rejects.toMatchObject({
      code: "SAVE_ACKNOWLEDGEMENT_INVALID",
    });
    expect(host.installSaved).not.toHaveBeenCalled();
  });
  it("preserves intervening local work instead of installing a late valid server acknowledgement", async () => {
    const checked = await proposal(),
      saved = await acknowledgement(checked);
    const host = setup(
      vi.fn<typeof fetch>(async () => {
        host.changeBase({ editorGeneration: 2 });
        return Response.json(saved);
      }),
    );
    await expect(host.port.apply(checked, ["move"], applyKey)).rejects.toMatchObject({ code: "STALE_SCENE" });
    expect(host.installSaved).not.toHaveBeenCalled();
  });
  it("rejects changed operations under one application identity before another dispatch", async () => {
    const checked = await proposal(),
      saved = await acknowledgement(checked);
    const fetcher = vi.fn<typeof fetch>(async () => Response.json(saved));
    const host = setup(fetcher);
    await host.port.apply(checked, ["move"], applyKey);
    await expect(
      host.port.apply({ ...checked, summary: "Different proposal" }, ["move"], applyKey),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(host.installSaved).toHaveBeenCalledTimes(1);
  });
  it("does not reuse private acknowledgements or prepare persistence after an account switch", async () => {
    const checked = await proposal(),
      saved = await acknowledgement(checked);
    const host = setup(vi.fn<typeof fetch>(async () => Response.json(saved)));
    await host.port.apply(checked, ["move"], applyKey);
    host.changeAccount();
    await expect(host.port.apply(checked, ["move"], applyKey)).rejects.toMatchObject({ code: "SCOPE_CHANGED" });
    await expect(host.port.prepareBase()).rejects.toMatchObject({ code: "SCOPE_CHANGED" });
    expect(host.prepareBase).not.toHaveBeenCalled();
    expect(host.installSaved).toHaveBeenCalledTimes(1);
  });
  it("shows safe quota/reset metadata without forwarding private server error bodies", async () => {
    const usage = {
      enabled: true,
      advancedEnabled: false,
      allowance: 500,
      used: 500,
      remaining: 0,
      resetAt: "2026-11-01T00:00:00Z",
      source: "INHERITED",
      nearingLimit: true,
    };
    const host = setup(
      vi.fn<typeof fetch>(async () =>
        Response.json(
          {
            code: "USER_MONTHLY_REQUESTS",
            error: "PRIVATE_DIAGNOSTIC",
            usage: { ...usage, internalBudgetNano: 100000 },
          },
          { status: 429 },
        ),
      ),
    );
    const reply = await host.port.request(input(), new AbortController().signal);
    expect(reply).toMatchObject({ status: "FAILED", code: "USER_MONTHLY_REQUESTS", usage });
    expect(JSON.stringify(reply)).not.toMatch(/PRIVATE_DIAGNOSTIC|internalBudgetNano/);
    expect(host.installSaved).not.toHaveBeenCalled();
  });
});
