// @vitest-environment node
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createSpatialDraft, draftSchema } from "./authoring";
import { canonicalChecksum } from "@/drydock/canonical";
import { AI_CONTROL_ID } from "./ai-ledger";
import { defaultAIGlobalPolicy } from "./ai-policy";
import { requestSpatialAssistant } from "./spatial-assistant-service";
import { spatialItemKind } from "./library-service";
import { prepareSpatialAssistantApplication, applySpatialAssistant } from "./spatial-assistant-application";
import { assistantProposalSchema } from "./spatial-assistant";
import { readAssistantConversation } from "./assistant-conversation";
import { aiQuotaUsageHistory } from "./ai-quota-projections";

const root = mkdtempSync(join(tmpdir(), "voyagewright-parallax-a1-service-"));
const store = new PrismaClient({
  datasources: { db: { url: `file:${join(root, "fixture.sqlite").replaceAll("\\", "/")}` } },
});
const draft = draftSchema.parse(createSpatialDraft("synthetic-service-draft"));
const accountId = "synthetic-service-owner";
const request = () => ({
  draft,
  revision: 1,
  editorGeneration: 0,
  requestId: "synthetic-service-request",
  idempotencyKey: "synthetic-service-idempotency",
  request: "Place the map near the entrance",
  selectedEntityId: draft.content.entities[0].id,
  mode: "STANDARD",
});
const interpretation = {
  intentType: "EDIT",
  summary: "Move the map",
  clarification: null,
  creatorExplanation: "Place the same readable map near the entrance.",
  assumptions: [],
  warnings: [],
  unsupportedCapabilities: [],
  accessibilityNotes: [],
  operations: [
    {
      id: "placement",
      type: "PLACEMENT",
      entityId: draft.content.entities[0].id,
      placement: "ENTRANCE",
      explanation: "Bring the map near the doorway.",
      dependsOn: [],
    },
  ],
};
const providerBody = (changes: Record<string, unknown> = {}) => ({
  id: "synthetic-provider-response",
  status: "completed",
  service_tier: "default",
  output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(interpretation) }] }],
  usage: { input_tokens: 1000, output_tokens: 250 },
  ...changes,
});
async function reviewedApplication() {
  const result = await requestSpatialAssistant(accountId, request(), {
    store,
    fetcher: vi.fn<typeof fetch>(async () => new Response(JSON.stringify(providerBody()))),
  });
  if (!("proposal" in result)) throw new Error("Synthetic provider did not return a reviewed proposal.");
  return {
    proposal: assistantProposalSchema.parse(result.proposal),
    selectedOperationIds: ["placement"],
    idempotencyKey: "synthetic-application-key",
  };
}
beforeAll(async () => {
  const sql =
    readFileSync(resolve("prisma/migrations/20261011180000_parallax_a1_ai_quotas/migration.sql"), "utf8") +
    "\n" +
    readFileSync(resolve("prisma/migrations/20261011210000_parallax_a1_application_receipt/migration.sql"), "utf8");
  for (const statement of sql
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean))
    await store.$executeRawUnsafe(statement);
  await store.$executeRawUnsafe(
    'CREATE TABLE "ReusableAuthoringItem" ("id" TEXT PRIMARY KEY, "ownerAccountId" TEXT NOT NULL, "kind" TEXT NOT NULL, "name" TEXT NOT NULL, "description" TEXT NOT NULL DEFAULT \'\', "tags" TEXT NOT NULL DEFAULT \'[]\', "status" TEXT NOT NULL DEFAULT \'ACTIVE\', "currentVersionNumber" INTEGER NOT NULL DEFAULT 1, "archivedAt" DATETIME, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)',
  );
  await store.$executeRawUnsafe(
    'CREATE TABLE "ReusableAuthoringItemVersion" ("id" TEXT PRIMARY KEY, "itemId" TEXT NOT NULL, "versionNumber" INTEGER NOT NULL, "envelope" TEXT NOT NULL, "checksum" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE("itemId", "versionNumber"))',
  );
});
beforeEach(async () => {
  vi.stubEnv("OPENAI_API_KEY", "synthetic-service-key");
  await store.aIUsageLedger.deleteMany();
  await store.aIQuotaControl.deleteMany();
  await store.reusableAuthoringItemVersion.deleteMany();
  await store.reusableAuthoringItem.deleteMany();
  await store.aIQuotaControl.create({
    // These orchestration cases isolate paid dispatch/replay; exact-count admission has its own case below.
    data: {
      id: AI_CONTROL_ID,
      policy: JSON.stringify({ ...defaultAIGlobalPolicy, enabled: true, maximumInputTokens: 32000 }),
    },
  });
  await store.reusableAuthoringItem.create({
    data: {
      id: draft.content.definitionId,
      ownerAccountId: accountId,
      kind: spatialItemKind,
      name: "Synthetic draft",
      versions: { create: { versionNumber: 0, envelope: JSON.stringify(draft), checksum: canonicalChecksum(draft) } },
    },
  });
});
afterEach(() => vi.unstubAllEnvs());
afterAll(async () => {
  await store.$disconnect();
  if (!resolve(root).startsWith(resolve(tmpdir()) + "/") && !resolve(root).startsWith(resolve(tmpdir()) + "\\"))
    throw new Error("Unsafe fixture cleanup target");
  rmSync(root, { recursive: true });
});

describe("Spatial Assistant atomic canonical Apply", () => {
  it("saves one revision and its receipt together, then replays from a fresh server without another save", async () => {
    const input = await reviewedApplication();
    const saved = await applySpatialAssistant(accountId, input, store);
    expect(saved).toMatchObject({ status: "SAVED", revision: 2 });
    const ledger = await store.aIUsageLedger.findFirstOrThrow();
    expect(ledger).toMatchObject({
      applicationKey: input.idempotencyKey,
      applicationRevision: 2,
      applicationChecksum: canonicalChecksum(saved.draft),
    });
    expect(ledger.appliedAt).toBeInstanceOf(Date);
    const freshServer = new PrismaClient({
      datasources: { db: { url: `file:${join(root, "fixture.sqlite").replaceAll("\\", "/")}` } },
    });
    try {
      expect(await applySpatialAssistant(accountId, input, freshServer)).toEqual(saved);
    } finally {
      await freshServer.$disconnect();
    }
    expect((await store.reusableAuthoringItem.findFirstOrThrow()).currentVersionNumber).toBe(2);
    expect(await store.aIUsageLedger.count()).toBe(1);
  });
  it("serializes concurrent repeat applications without a second revision", async () => {
    const input = await reviewedApplication();
    const result = await Promise.all([
      applySpatialAssistant(accountId, input, store),
      applySpatialAssistant(accountId, input, store),
    ]);
    expect(result[0]).toEqual(result[1]);
    expect((await store.reusableAuthoringItem.findFirstOrThrow()).currentVersionNumber).toBe(2);
  });
  it("rolls back the canonical save when the durable receipt cannot commit", async () => {
    const input = await reviewedApplication();
    await store.$executeRawUnsafe(
      'CREATE TRIGGER synthetic_receipt_failure BEFORE UPDATE ON "AIUsageLedger" WHEN NEW."applicationKey" IS NOT NULL BEGIN SELECT RAISE(ABORT, \'synthetic receipt failure\'); END',
    );
    try {
      await expect(applySpatialAssistant(accountId, input, store)).rejects.toThrow();
    } finally {
      await store.$executeRawUnsafe("DROP TRIGGER synthetic_receipt_failure");
    }
    expect((await store.reusableAuthoringItem.findFirstOrThrow()).currentVersionNumber).toBe(1);
    expect((await store.reusableAuthoringItemVersion.findFirstOrThrow()).checksum).toBe(canonicalChecksum(draft));
    expect((await store.aIUsageLedger.findFirstOrThrow()).applicationKey).toBeNull();
    expect((await applySpatialAssistant(accountId, input, store)).revision).toBe(2);
  });
  it("rejects altered retry contents and reapplication under a different identity", async () => {
    const input = await reviewedApplication();
    await applySpatialAssistant(accountId, input, store);
    await expect(
      applySpatialAssistant(accountId, { ...input, selectedOperationIds: ["unknown"] }, store),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
    await expect(
      applySpatialAssistant(accountId, { ...input, idempotencyKey: "synthetic-another-apply-key" }, store),
    ).rejects.toMatchObject({ code: "PROPOSAL_ALREADY_APPLIED" });
    expect((await store.reusableAuthoringItem.findFirstOrThrow()).currentVersionNumber).toBe(2);
  });
  it("never returns an old acknowledged draft over later saved Creator work", async () => {
    const input = await reviewedApplication();
    const saved = await applySpatialAssistant(accountId, input, store);
    const newer = structuredClone(saved.draft);
    newer.content.entities[0].content = "Newer synthetic Creator work";
    await store.$transaction(async (tx) => {
      await tx.reusableAuthoringItem.update({
        where: { id: draft.content.definitionId },
        data: { currentVersionNumber: 3 },
      });
      await tx.reusableAuthoringItemVersion.updateMany({
        where: { itemId: draft.content.definitionId, versionNumber: 0 },
        data: { envelope: JSON.stringify(newer), checksum: canonicalChecksum(newer) },
      });
    });
    await expect(applySpatialAssistant(accountId, input, store)).rejects.toMatchObject({
      code: "PROPOSAL_ALREADY_APPLIED",
    });
    expect(JSON.parse((await store.reusableAuthoringItemVersion.findFirstOrThrow()).envelope)).toEqual(newer);
  });
  it("rejects foreign, expired, stale and incomplete proposals before a save or receipt", async () => {
    const input = await reviewedApplication();
    await expect(applySpatialAssistant("synthetic-other-owner", input, store)).rejects.toMatchObject({
      code: "DRAFT_UNAVAILABLE",
    });
    await expect(
      applySpatialAssistant(accountId, { ...input, selectedOperationIds: ["absent"] }, store),
    ).rejects.toMatchObject({ code: "INVALID_SELECTION" });
    await store.reusableAuthoringItem.update({
      where: { id: draft.content.definitionId },
      data: { currentVersionNumber: 2 },
    });
    await expect(applySpatialAssistant(accountId, input, store)).rejects.toMatchObject({ code: "STALE_SCENE" });
    await store.aIUsageLedger.updateMany({ data: { resultExpiresAt: new Date(0) } });
    await expect(applySpatialAssistant(accountId, input, store)).rejects.toMatchObject({
      code: "PROPOSAL_UNAVAILABLE",
    });
    expect((await store.aIUsageLedger.findFirstOrThrow()).applicationKey).toBeNull();
    expect((await store.reusableAuthoringItemVersion.findFirstOrThrow()).checksum).toBe(canonicalChecksum(draft));
  });
});
describe("Spatial Assistant owner-bound server orchestration", () => {
  it("resolves a clarification using bounded private prior context without exposing it in replies or usage reports", async () => {
    const first = request(),
      clarification = {
        ...interpretation,
        intentType: "CLARIFICATION",
        summary: "Choose the map",
        clarification: "Which map should move?",
        operations: [],
      };
    first.request = "PRIVATE_TASK_DESCRIPTION move a map near the entrance";
    const initial = await requestSpatialAssistant(accountId, first, {
      store,
      fetcher: vi.fn<typeof fetch>(async () =>
        Response.json(
          providerBody({
            output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(clarification) }] }],
          }),
        ),
      ),
    });
    expect(initial).toMatchObject({ status: "PROPOSED", proposal: { intentType: "CLARIFICATION" } });
    expect(JSON.stringify(initial)).not.toContain("PRIVATE_TASK_DESCRIPTION");
    const second = {
      ...request(),
      request: "The selected map",
      requestId: "synthetic-followup-request",
      idempotencyKey: "synthetic-followup-key",
      previousRequestId: first.requestId,
    };
    const fetcher = vi.fn<typeof fetch>(async (_url, options) => {
      const body = JSON.parse(options!.body as string);
      const context = JSON.parse(body.input[0].content);
      expect(context.creatorRequest).toBe("The selected map");
      expect(context.sceneContext.recentTaskTurns).toEqual([
        expect.objectContaining({
          creatorRequest: first.request,
          clarification: "Which map should move?",
          authority: "ADVISORY_ONLY",
        }),
      ]);
      expect(options!.body).not.toContain(draft.content.entities[0].content);
      return Response.json(providerBody());
    });
    await requestSpatialAssistant(accountId, second, { store, fetcher });
    const replay = await requestSpatialAssistant(accountId, first, { store, fetcher });
    expect(replay).toMatchObject({ status: "PROPOSED", replay: true });
    expect(JSON.stringify(replay)).not.toContain("PRIVATE_TASK_DESCRIPTION");
    const history = await aiQuotaUsageHistory(
      { accountId, from: new Date(0), to: new Date(Date.now() + 86400000), take: 100 },
      store,
    );
    expect(JSON.stringify(history)).not.toMatch(/PRIVATE_TASK_DESCRIPTION|Which map should move/);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("rejects foreign, wrong-draft, expired and ambiguous conversation identities before dispatch", async () => {
    await requestSpatialAssistant(accountId, request(), {
      store,
      fetcher: vi.fn<typeof fetch>(async () => Response.json(providerBody())),
    });
    const original = await store.aIUsageLedger.findFirstOrThrow();
    for (const patch of [
      { accountId: "foreign-owner" },
      { definitionId: "foreign-draft" },
      { resultExpiresAt: new Date(0) },
    ]) {
      await store.aIUsageLedger.update({ where: { id: original.id }, data: patch });
      const fetcher = vi.fn<typeof fetch>();
      await expect(
        requestSpatialAssistant(
          accountId,
          {
            ...request(),
            requestId: crypto.randomUUID(),
            idempotencyKey: crypto.randomUUID(),
            previousRequestId: request().requestId,
          },
          { store, fetcher },
        ),
      ).rejects.toMatchObject({ code: "CONTEXT_UNAVAILABLE" });
      expect(fetcher).not.toHaveBeenCalled();
      const failed = await store.aIUsageLedger.findFirstOrThrow({ where: { failureCode: "CONTEXT_UNAVAILABLE" } });
      expect(failed.status).toBe("RELEASED");
      expect(failed.exposureNano).toBe(BigInt(0));
      await store.aIUsageLedger.update({
        where: { id: original.id },
        data: {
          accountId,
          definitionId: draft.content.definitionId,
          resultExpiresAt: original.resultExpiresAt,
          result: original.result,
        },
      });
    }
    await store.aIUsageLedger.create({
      data: { ...original, id: crypto.randomUUID(), idempotencyKey: "synthetic-ambiguous-context" },
    });
    await expect(readAssistantConversation(store, accountId, draft, request().requestId)).rejects.toMatchObject({
      code: "CONTEXT_UNAVAILABLE",
    });
  });
  it("bounds context to two advisory turns, excludes prior operation content and always derives object existence from the current scene", async () => {
    let previousRequestId: string | null = null;
    for (let i = 0; i < 4; i++) {
      const input: ReturnType<typeof request> & { previousRequestId: string | null } = {
        ...request(),
        request: `Follow-up instruction ${i}`,
        requestId: `synthetic-turn-${i}`,
        idempotencyKey: `synthetic-turn-key-${i}`,
        previousRequestId,
      };
      await requestSpatialAssistant(accountId, input, {
        store,
        fetcher: vi.fn<typeof fetch>(async () => Response.json(providerBody())),
      });
      previousRequestId = input.requestId;
    }
    const context = await readAssistantConversation(store, accountId, draft, previousRequestId);
    expect(context.map((turn) => turn.creatorRequest)).toEqual(["Follow-up instruction 2", "Follow-up instruction 3"]);
    expect(context.every((turn) => turn.authority === "ADVISORY_ONLY")).toBe(true);
    expect(context[0].operations).toEqual([
      { type: "PLACEMENT", entityId: draft.content.entities[0].id, existsInCurrentScene: true, proposedName: null },
    ]);
    const empty = structuredClone(draft);
    empty.content.entities = [];
    expect(
      (await readAssistantConversation(store, accountId, empty, previousRequestId))[0].operations[0]
        .existsInCurrentScene,
    ).toBe(false);
    expect(JSON.stringify(context)).not.toContain(draft.content.entities[0].content);
  });
  it("replays an admitted follow-up even after its older task context expires", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => Response.json(providerBody()));
    await requestSpatialAssistant(accountId, request(), { store, fetcher });
    const next = {
      ...request(),
      request: "Make it smaller",
      requestId: "synthetic-followup",
      idempotencyKey: "synthetic-followup-replay",
      previousRequestId: request().requestId,
    };
    await requestSpatialAssistant(accountId, next, { store, fetcher });
    await store.aIUsageLedger.updateMany({
      where: { requestId: request().requestId },
      data: { resultExpiresAt: new Date(0) },
    });
    expect(await requestSpatialAssistant(accountId, next, { store, fetcher })).toMatchObject({
      status: "PROPOSED",
      replay: true,
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("rejects malformed or circular retained context without trusting client conversation text", async () => {
    await requestSpatialAssistant(accountId, request(), {
      store,
      fetcher: vi.fn<typeof fetch>(async () => Response.json(providerBody())),
    });
    const row = await store.aIUsageLedger.findFirstOrThrow();
    const result = JSON.parse(row.result!);
    for (const retained of [
      "{broken-json",
      JSON.stringify({
        ...result,
        conversation: { request: "Private oversized task".repeat(1000), previousRequestId: null },
      }),
      JSON.stringify({ ...result, conversation: { request: "A prior task", previousRequestId: request().requestId } }),
    ]) {
      await store.aIUsageLedger.update({ where: { id: row.id }, data: { result: retained } });
      await expect(readAssistantConversation(store, accountId, draft, request().requestId)).rejects.toMatchObject({
        code: "CONTEXT_UNAVAILABLE",
      });
    }
    const fetcher = vi.fn<typeof fetch>();
    await expect(
      requestSpatialAssistant(
        accountId,
        { ...request(), conversation: [{ creatorRequest: "Client-invented authoritative history" }] },
        { store, fetcher },
      ),
    ).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("prepares only the retained owner proposal and selected canonical edits without saving", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => Response.json(providerBody()));
    const reply = await requestSpatialAssistant(accountId, request(), { store, fetcher });
    const proposal = assistantProposalSchema.parse((reply as { proposal?: unknown }).proposal);
    const application = await prepareSpatialAssistantApplication(
      accountId,
      { proposal, selectedOperationIds: ["placement"], idempotencyKey: "synthetic-application-key" },
      store,
    );
    expect(application.expectedRevision).toBe(1);
    expect(application.draft.content.anchors[0].transform.position.x).toBe(-1);
    expect((await store.reusableAuthoringItemVersion.findFirstOrThrow()).envelope).toBe(JSON.stringify(draft));
    expect((await store.reusableAuthoringItem.findFirstOrThrow()).currentVersionNumber).toBe(1);
  });
  it("refuses invented, altered or foreign reviewed proposals before application", async () => {
    const reply = await requestSpatialAssistant(accountId, request(), {
      store,
      fetcher: vi.fn<typeof fetch>(async () => Response.json(providerBody())),
    });
    const proposal = assistantProposalSchema.parse((reply as { proposal?: unknown }).proposal);
    const input = { proposal, selectedOperationIds: ["placement"], idempotencyKey: "synthetic-application-key" };
    await expect(prepareSpatialAssistantApplication("foreign-owner", input, store)).rejects.toMatchObject({
      code: "PROPOSAL_UNAVAILABLE",
    });
    await expect(
      prepareSpatialAssistantApplication(
        accountId,
        { ...input, proposal: { ...proposal, summary: "Forged explanation" } },
        store,
      ),
    ).rejects.toMatchObject({ code: "PROPOSAL_MISMATCH" });
    await expect(
      prepareSpatialAssistantApplication(accountId, { ...input, selectedOperationIds: ["invented-operation"] }, store),
    ).rejects.toMatchObject({ code: "INVALID_SELECTION" });
  });
  it("rejects expired proposals and saved revisions changed since inference", async () => {
    const reply = await requestSpatialAssistant(accountId, request(), {
      store,
      fetcher: vi.fn<typeof fetch>(async () => Response.json(providerBody())),
    });
    const proposal = assistantProposalSchema.parse((reply as { proposal?: unknown }).proposal);
    const input = { proposal, selectedOperationIds: ["placement"], idempotencyKey: "synthetic-application-key" };
    await store.reusableAuthoringItem.update({
      where: { id: draft.content.definitionId },
      data: { currentVersionNumber: 2 },
    });
    await expect(prepareSpatialAssistantApplication(accountId, input, store)).rejects.toMatchObject({
      code: "STALE_SCENE",
    });
    await store.aIUsageLedger.updateMany({ data: { resultExpiresAt: new Date(0) } });
    await expect(prepareSpatialAssistantApplication(accountId, input, store)).rejects.toMatchObject({
      code: "PROPOSAL_UNAVAILABLE",
    });
  });
  it("keeps valid unknown-usage proposals reviewable without releasing their conservative charge", async () => {
    const reply = await requestSpatialAssistant(accountId, request(), {
      store,
      fetcher: vi.fn<typeof fetch>(async () => Response.json(providerBody({ usage: null }))),
    });
    const proposal = assistantProposalSchema.parse((reply as { proposal?: unknown }).proposal);
    await prepareSpatialAssistantApplication(
      accountId,
      { proposal, selectedOperationIds: ["placement"], idempotencyKey: "synthetic-application-key" },
      store,
    );
    const ledger = await store.aIUsageLedger.findFirstOrThrow();
    expect(ledger.status).toBe("UNKNOWN");
    expect(ledger.exposureNano).toBe(ledger.reservationNano);
  });
  it("reserves and marks dispatch before one paid adapter call, retaining a valid proposal without applying it", async () => {
    const fetcher = vi.fn<typeof fetch>(async (_url, options) => {
      const ledger = await store.aIUsageLedger.findFirstOrThrow();
      expect(ledger.status).toBe("DISPATCHED");
      expect(ledger.exposureNano).toBeGreaterThan(BigInt(0));
      expect(options?.headers).toMatchObject({ Authorization: "Bearer synthetic-service-key" });
      expect(options?.body).not.toContain("synthetic-service-key");
      expect(options?.body).not.toContain(draft.content.entities[0].content);
      return Response.json(providerBody());
    });
    const result = await requestSpatialAssistant(accountId, request(), { store, fetcher });
    expect(result).toMatchObject({
      status: "PROPOSED",
      accounting: "SETTLED",
      proposal: { sceneRevision: 1, definitionId: draft.content.definitionId },
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect((await store.reusableAuthoringItemVersion.findFirstOrThrow()).envelope).toBe(JSON.stringify(draft));
    const replay = await requestSpatialAssistant(accountId, request(), { store, fetcher });
    expect(replay).toMatchObject({ status: "PROPOSED", replay: true });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("counts expanded input before paid dispatch and releases an over-limit request without inference", async () => {
    await store.aIQuotaControl.update({
      where: { id: AI_CONTROL_ID },
      data: { policy: JSON.stringify({ ...defaultAIGlobalPolicy, enabled: true }) },
    });
    const fetcher = vi.fn<typeof fetch>(async (url) => {
      const ledger = await store.aIUsageLedger.findFirstOrThrow();
      expect(ledger.status).toBe("RESERVED");
      expect(String(url)).toMatch(/\/input_tokens$/);
      return Response.json({ object: "response.input_tokens", input_tokens: 12000 });
    });
    await expect(requestSpatialAssistant(accountId, request(), { store, fetcher })).rejects.toMatchObject({
      code: "CONTEXT_TOO_LARGE",
      definitelyUnbilled: true,
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    const ledger = await store.aIUsageLedger.findFirstOrThrow();
    expect(ledger.status).not.toBe("DISPATCHED");
    expect(ledger.exposureNano).toBe(BigInt(0));
  });
  it("blocks foreign owners and stale saved revisions before admission", async () => {
    const fetcher = vi.fn<typeof fetch>();
    await expect(requestSpatialAssistant("another-owner", request(), { store, fetcher })).rejects.toMatchObject({
      code: "DRAFT_UNAVAILABLE",
    });
    await expect(
      requestSpatialAssistant(accountId, { ...request(), revision: 2 }, { store, fetcher }),
    ).rejects.toMatchObject({ code: "STALE_SCENE" });
    expect(await store.aIUsageLedger.count()).toBe(0);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("keeps manual drafts intact when credentials are absent or policy is disabled", async () => {
    const fetcher = vi.fn<typeof fetch>();
    vi.stubEnv("OPENAI_API_KEY", "");
    expect(await requestSpatialAssistant(accountId, request(), { store, fetcher })).toMatchObject({
      status: "UNAVAILABLE",
      code: "PROVIDER_UNCONFIGURED",
    });
    vi.stubEnv("OPENAI_API_KEY", "synthetic-key");
    await store.aIQuotaControl.update({
      where: { id: AI_CONTROL_ID },
      data: { policy: JSON.stringify(defaultAIGlobalPolicy) },
    });
    await expect(requestSpatialAssistant(accountId, request(), { store, fetcher })).rejects.toMatchObject({
      code: "AI_DISABLED",
    });
    expect(await store.aIUsageLedger.count()).toBe(0);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("accounts billed invalid semantic operations without changing the scene", async () => {
    const bad = { ...interpretation, operations: [{ ...interpretation.operations[0], entityId: "missing-object" }] };
    const fetcher = vi.fn<typeof fetch>(async () =>
      Response.json(
        providerBody({ output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(bad) }] }] }),
      ),
    );
    expect(await requestSpatialAssistant(accountId, request(), { store, fetcher })).toMatchObject({
      status: "FAILED",
      code: "REJECTED_OPERATION",
      accounting: "SETTLED",
    });
    const billed = await store.aIUsageLedger.findFirstOrThrow();
    expect(billed.status).toBe("SETTLED");
    expect(billed.result).not.toContain(request().request);
    expect(JSON.parse(billed.result!)).not.toHaveProperty("conversation");
    expect((await store.reusableAuthoringItemVersion.findFirstOrThrow()).checksum).toBe(canonicalChecksum(draft));
  });
  it("retains replayable proposals with conservative exposure when provider usage is missing", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => Response.json(providerBody({ usage: null })));
    expect(await requestSpatialAssistant(accountId, request(), { store, fetcher })).toMatchObject({
      status: "PROPOSED",
      accounting: "CONSERVATIVE_PENDING",
    });
    const ledger = await store.aIUsageLedger.findFirstOrThrow();
    expect(ledger.status).toBe("UNKNOWN");
    expect(ledger.exposureNano).toBe(ledger.reservationNano);
    expect(await requestSpatialAssistant(accountId, request(), { store, fetcher })).toMatchObject({
      status: "PROPOSED",
      replay: true,
      accounting: "CONSERVATIVE_PENDING",
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it.each([
    [401, "RELEASED"],
    [503, "UNKNOWN"],
  ])("preserves defensible accounting after HTTP %s", async (status, state) => {
    const fetcher = vi.fn<typeof fetch>(
      async () => new Response("PRIVATE_UPSTREAM_DETAIL", { status: status as number }),
    );
    await expect(requestSpatialAssistant(accountId, request(), { store, fetcher })).rejects.toMatchObject({
      code: status === 401 ? "PROVIDER_AUTHENTICATION" : "PROVIDER_UNAVAILABLE",
    });
    const ledger = await store.aIUsageLedger.findFirstOrThrow();
    expect(ledger.status).toBe(state);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(ledger.result).toBeNull();
    expect(ledger.failureCode).not.toContain("PRIVATE_UPSTREAM_DETAIL");
  });
});
