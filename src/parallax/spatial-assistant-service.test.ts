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
import { prepareSpatialAssistantApplication } from "./spatial-assistant-application";
import { assistantProposalSchema } from "./spatial-assistant";

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
beforeAll(async () => {
  const sql = readFileSync(resolve("prisma/migrations/20261011180000_parallax_a1_ai_quotas/migration.sql"), "utf8");
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
    data: { id: AI_CONTROL_ID, policy: JSON.stringify({ ...defaultAIGlobalPolicy, enabled: true }) },
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
describe("Spatial Assistant owner-bound server orchestration", () => {
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
    expect((await store.aIUsageLedger.findFirstOrThrow()).status).toBe("SETTLED");
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
