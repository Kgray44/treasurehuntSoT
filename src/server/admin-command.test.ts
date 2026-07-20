import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicSnapshot } from "@/domain/story";

const dependencies = vi.hoisted(() => {
  class ProgressionConflict extends Error {
    constructor(
      message: string,
      public code = "COMMAND_CONFLICT",
    ) {
      super(message);
    }
  }
  const transaction = {
    campaign: { findUniqueOrThrow: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
    preparedAction: { create: vi.fn() },
    adminAuditLog: { create: vi.fn() },
    progressEvent: { create: vi.fn() },
    campaignSnapshot: { create: vi.fn() },
  };
  return {
    db: {
      campaign: { findUniqueOrThrow: vi.fn() },
      commandExecution: {
        findUnique: vi.fn(),
        findUniqueOrThrow: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      adminAuditLog: { findFirst: vi.fn(), create: vi.fn() },
      progressEvent: { findFirst: vi.fn() },
      preparedAction: { findFirst: vi.fn() },
      sideQuest: { findFirst: vi.fn() },
      $transaction: vi.fn(),
    },
    transaction,
    executeProgressionAction: vi.fn(),
    publishCampaignEvent: vi.fn(),
    buildPublicSnapshot: vi.fn(),
    ProgressionConflict,
  };
});

vi.mock("@/lib/db", () => ({ db: dependencies.db }));
vi.mock("@/server/progression", () => ({
  executeProgressionAction: dependencies.executeProgressionAction,
  ProgressionConflict: dependencies.ProgressionConflict,
}));
vi.mock("@/lib/events", () => ({ publishCampaignEvent: dependencies.publishCampaignEvent }));
vi.mock("@/lib/snapshot", () => ({ buildPublicSnapshot: dependencies.buildPublicSnapshot }));

import {
  CommandConflict,
  CommandFailure,
  commandReceipt,
  commandRequestFingerprint,
  executeAdminCommand,
  stagedCommandReceipt,
} from "./admin-command";

const input = {
  command: "AWARD_ARTIFACT" as const,
  campaignSlug: "test-voyage",
  expectedSequence: 4,
  idempotencyKey: "quartermaster-123456",
  targetKey: "safe-artifact",
  payload: {},
  reason: "Release the tested artifact",
};

const preparedInput = {
  command: "PREPARE_HINT" as const,
  campaignSlug: "test-voyage",
  expectedSequence: 4,
  idempotencyKey: "prepare-hint-12345",
  targetKey: "hint-1",
  payload: { body: "Prepared but not released." },
};

const publicEvent = {
  id: "event-5",
  type: "ARTIFACT_AWARDED" as const,
  sequence: 5,
  payload: { key: "safe-artifact", name: "Safe artifact" },
  releaseAt: "2026-07-18T12:00:00.000Z",
};

const publicSnapshot = {
  campaign: { slug: "test-voyage", title: "Test Voyage", status: "ACTIVE" },
  sequence: 5,
  chapter: {
    ordinal: 1,
    state: "ACTIVE",
    title: "Chapter One",
    narrative: "A safe narrative.",
    objective: "Find the safe artifact.",
    riddle: "A safe riddle.",
    teaser: "A safe teaser.",
    hints: [{ ordinal: 1, body: "A released hint.", releasedAt: "2026-07-18T12:00:00.000Z", unseen: false }],
    annotations: [
      {
        key: "annotation-1",
        title: "Captain's note",
        body: "A safe note.",
        createdAt: "2026-07-18T12:00:00.000Z",
        unseen: false,
      },
    ],
    related: { mapKey: "safe-map", artifactKey: "safe-artifact", sideQuestKey: "safe-quest" },
    unseen: false,
  },
  chapters: [{ ordinal: 1, state: "ACTIVE", title: "Chapter One", unseen: false }],
  artifacts: [
    {
      key: "safe-artifact",
      state: "AWARDED",
      name: "Safe Artifact",
      safeName: "Safe silhouette",
      category: "Compass",
      description: "A safe description.",
      discoveryText: "A safe discovery.",
      silhouetteLabel: "Compass silhouette",
      displayX: 10,
      displayY: 20,
      assemblyGroup: "compass",
      assemblyPosition: "north",
      connectedArtifactKey: "safe-artifact-2",
      chapterOrdinal: 1,
      awardedAt: "2026-07-18T12:00:00.000Z",
      unseen: false,
    },
  ],
  mapLocations: [
    {
      key: "safe-map",
      state: "REVEALED",
      label: "Safe Map",
      name: "Safe Map",
      regionLabel: "Safe Region",
      locationType: "island",
      description: "A safe map description.",
      exactness: "exact",
      x: 10,
      y: 20,
      mobileX: 15,
      mobileY: 25,
      chapterOrdinal: 1,
      sideQuestKey: "safe-quest",
      unseen: false,
    },
  ],
  mapRoutes: [
    {
      key: "safe-route",
      fromKey: "safe-map",
      toKey: "safe-map-2",
      ordinal: 1,
      state: "REVEALED",
      annotation: "A safe route.",
      unseen: false,
    },
  ],
  sideQuests: [
    {
      key: "safe-quest",
      state: "ACTIVE",
      title: "Safe Quest",
      teaser: "A safe quest teaser.",
      description: "A safe quest description.",
      objectives: [{ ordinal: 1, body: "Complete the safe objective.", complete: false }],
      reward: { type: "ARTIFACT", label: "Safe reward" },
      completionSummary: "A safe summary.",
      chapterOrdinal: 1,
      mapLocationKey: "safe-map",
      artifactKey: "safe-artifact",
      unseen: false,
    },
  ],
  sideQuest: { title: "Safe Quest", state: "ACTIVE" },
  log: [
    {
      key: "event-5",
      sequence: 5,
      title: "Artifact recovered",
      summary: "The safe artifact was recovered.",
      timestamp: "2026-07-18T12:00:00.000Z",
      symbol: "artifact",
      importance: "notable",
      section: "treasures",
      targetKey: "safe-artifact",
      unseen: false,
    },
  ],
  finale: {
    state: "TEASED",
    teaser: "A safe finale teaser.",
    requirements: [{ key: "artifact", label: "Recover artifact", current: 1, target: 2, optional: false }],
    unseen: false,
  },
  unseen: { journal: 0, chart: 0, treasures: 0, quests: 0, log: 0, finale: 0 },
  latestChapterReleasePresentation: {
    eventId: "chapter-release-1",
    eventType: "CHAPTER_RELEASED",
    sequence: 4,
    occurredAt: "2026-07-18T11:00:00.000Z",
    sceneName: "chapter-release",
    payloadVersion: 1,
    payload: {
      ordinal: 1,
      title: "Chapter One",
      narrative: "A safe narrative.",
      objective: "Find the safe artifact.",
      riddle: "A safe riddle.",
    },
    replayPolicy: "presentation-only",
  },
  presentationHistory: [publicEvent],
} satisfies PublicSnapshot;

function succeededEnvelope() {
  const call = dependencies.db.commandExecution.update.mock.calls.find(
    ([argument]) => argument.data.status === "SUCCEEDED",
  );
  expect(call).toBeDefined();
  return String(call![0].data.result);
}

function pendingEnvelope(request: Parameters<typeof commandRequestFingerprint>[0]) {
  return JSON.stringify({ version: 1, state: "PENDING", fingerprint: commandRequestFingerprint(request) });
}

type FingerprintInput = Parameters<typeof commandRequestFingerprint>[0];

function completeEnvelope(receipt: object, request: FingerprintInput = input) {
  return JSON.stringify({
    version: 1,
    state: "COMPLETE",
    fingerprint: commandRequestFingerprint(request),
    receipt,
  });
}

function useSucceededStoredResult(result: string, request: FingerprintInput = input) {
  dependencies.db.commandExecution.findUnique.mockResolvedValue({
    id: "execution-stored",
    campaignId: "campaign-1",
    correlationId: "correlation-stored",
    command: request.command,
    expectedSequence: request.expectedSequence,
    status: "SUCCEEDED",
    result,
  });
}

function mutableRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected a mutable test record.");
  return value as Record<string, unknown>;
}

describe("admin command receipts and concurrency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.db.campaign.findUniqueOrThrow.mockResolvedValue({ id: "campaign-1", currentSequence: 4 });
    dependencies.db.commandExecution.findUnique.mockResolvedValue(null);
    dependencies.db.commandExecution.create.mockResolvedValue({ id: "execution-1" });
    dependencies.db.commandExecution.update.mockResolvedValue({});
    dependencies.db.adminAuditLog.findFirst.mockResolvedValue(null);
    dependencies.db.preparedAction.findFirst.mockResolvedValue(null);
    dependencies.executeProgressionAction.mockResolvedValue({ event: publicEvent, snapshot: publicSnapshot });
    dependencies.buildPublicSnapshot.mockResolvedValue(publicSnapshot);
    dependencies.db.$transaction.mockImplementation((operation: (tx: typeof dependencies.transaction) => unknown) =>
      operation(dependencies.transaction),
    );
    dependencies.transaction.campaign.findUniqueOrThrow.mockResolvedValue({
      id: "campaign-1",
      currentSequence: 4,
      status: "ACTIVE",
      chapters: [],
      sideQuests: [],
      journalEntries: [],
    });
    dependencies.transaction.campaign.updateMany.mockResolvedValue({ count: 1 });
    dependencies.transaction.preparedAction.create.mockResolvedValue({
      id: "prepared-5",
      campaignId: "campaign-1",
      command: "PREPARE_HINT",
      targetKey: "hint-1",
      expectedSequence: 5,
      status: "PREPARED",
      preparedAt: new Date("2026-07-18T12:00:00.000Z"),
    });
    dependencies.transaction.adminAuditLog.create.mockResolvedValue({});
  });

  it("does not convert process publication into Crew delivery or presentation claims", () => {
    expect(commandReceipt({ event: publicEvent }, "correlation-1")).toMatchObject({
      kind: "PROGRESSION_EVENT",
      persistence: "COMMITTED",
      publication: "PROCESS_PUBLISHED",
      deliveryScope: "PROCESS_SUBSCRIBERS_ONLY",
      playerDelivery: "UNCONFIRMED",
      playerPresentation: "UNCONFIRMED",
      playerAcknowledgment: "UNCONFIRMED",
      playerEvent: { id: "event-5", type: "ARTIFACT_AWARDED", sequence: 5 },
    });
  });

  it("stores and replays the full versioned request fingerprint without mutating twice", async () => {
    const first = await executeAdminCommand(input, "gm-1");
    expect(JSON.parse(String(dependencies.db.commandExecution.create.mock.calls[0][0].data.result))).toEqual({
      version: 1,
      state: "PENDING",
      fingerprint: commandRequestFingerprint(input),
    });
    const envelope = succeededEnvelope();
    expect(JSON.parse(envelope)).toMatchObject({
      version: 1,
      state: "COMPLETE",
      fingerprint: commandRequestFingerprint(input),
      receipt: { kind: "PROGRESSION_EVENT", correlationId: first.correlationId, persistence: "COMMITTED" },
    });

    dependencies.db.commandExecution.findUnique.mockResolvedValue({
      id: "execution-1",
      campaignId: "campaign-1",
      correlationId: first.correlationId,
      command: input.command,
      expectedSequence: input.expectedSequence,
      status: "SUCCEEDED",
      result: envelope,
    });
    dependencies.executeProgressionAction.mockClear();

    await expect(executeAdminCommand(input, "gm-1")).resolves.toEqual({ ...first, idempotentReplay: true });
    expect(dependencies.executeProgressionAction).not.toHaveBeenCalled();
  });

  it("rejects idempotency-key reuse when command, sequence, target, payload, or reason changes", async () => {
    const receipt = commandReceipt({ event: publicEvent }, "correlation-1");
    const envelope = JSON.stringify({
      version: 1,
      state: "COMPLETE",
      fingerprint: commandRequestFingerprint(input),
      receipt,
    });
    dependencies.db.commandExecution.findUnique.mockResolvedValue({
      command: input.command,
      expectedSequence: input.expectedSequence,
      status: "SUCCEEDED",
      result: envelope,
    });

    for (const changed of [
      { ...input, command: "REVEAL_MAP" as const },
      { ...input, expectedSequence: 5 },
      { ...input, targetKey: "different-artifact" },
      { ...input, payload: { value: "different" } },
      { ...input, reason: "Different intent" },
    ]) {
      await expect(executeAdminCommand(changed, "gm-1")).rejects.toMatchObject({
        code: "IDEMPOTENCY_KEY_REUSE",
      } satisfies Partial<CommandConflict>);
    }
    expect(dependencies.executeProgressionAction).not.toHaveBeenCalled();
  });

  it("rejects a changed RUNNING retry before audit recovery can return or rewrite the original receipt", async () => {
    dependencies.db.commandExecution.findUnique.mockResolvedValue({
      id: "execution-1",
      campaignId: "campaign-1",
      correlationId: "correlation-original",
      command: input.command,
      expectedSequence: input.expectedSequence,
      status: "RUNNING",
      result: pendingEnvelope(input),
    });

    await expect(executeAdminCommand({ ...input, targetKey: "different-artifact" }, "gm-1")).rejects.toMatchObject({
      code: "IDEMPOTENCY_KEY_REUSE",
    });

    expect(dependencies.db.adminAuditLog.findFirst).not.toHaveBeenCalled();
    expect(dependencies.db.commandExecution.update).not.toHaveBeenCalled();
    expect(dependencies.executeProgressionAction).not.toHaveBeenCalled();
  });

  it("allows a backwards-compatible empty legacy receipt but rejects unverifiable legacy payload intent", async () => {
    const legacyInput = { ...input, targetKey: undefined, payload: {}, reason: undefined };
    const stored = {
      event: publicEvent,
      snapshot: publicSnapshot,
      correlationId: "correlation-legacy",
      persistence: "COMMITTED",
      delivery: "PUBLISHED",
    };
    dependencies.db.commandExecution.findUnique.mockResolvedValue({
      command: legacyInput.command,
      expectedSequence: legacyInput.expectedSequence,
      status: "SUCCEEDED",
      result: JSON.stringify(stored),
    });
    await expect(executeAdminCommand(legacyInput, "gm-1")).resolves.toMatchObject({
      kind: "PROGRESSION_EVENT",
      event: publicEvent,
      playerEvent: { id: publicEvent.id, type: publicEvent.type, sequence: publicEvent.sequence },
      correlationId: "correlation-legacy",
      publication: "PROCESS_PUBLISHED",
      idempotentReplay: true,
    });
    await expect(executeAdminCommand(input, "gm-1")).rejects.toMatchObject({ code: "IDEMPOTENCY_KEY_REUSE" });
  });

  it("passes expectedSequence into the progression transaction contract", async () => {
    await executeAdminCommand(input, "gm-1", { correlationId: "request-correlation-1" });
    expect(dependencies.db.commandExecution.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ correlationId: "request-correlation-1", result: pendingEnvelope(input) }),
    });
    expect(dependencies.executeProgressionAction).toHaveBeenCalledWith(
      "test-voyage",
      "AWARD_ARTIFACT",
      "gm-1",
      expect.objectContaining({
        correlationId: "request-correlation-1",
        expectedSequence: 4,
        targetKey: "safe-artifact",
      }),
    );
  });

  it("persists and audits the early request correlation while redacting an unexpected failure", async () => {
    dependencies.executeProgressionAction.mockRejectedValue(new Error("sensitive database failure"));

    await expect(
      executeAdminCommand(input, "gm-1", { correlationId: "request-correlation-failure" }),
    ).rejects.toMatchObject({
      correlationId: "request-correlation-failure",
      message: "The command could not be completed.",
    } satisfies Partial<CommandFailure>);

    expect(dependencies.db.commandExecution.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        correlationId: "request-correlation-failure",
        result: pendingEnvelope(input),
      }),
    });
    expect(dependencies.db.commandExecution.update).toHaveBeenCalledWith({
      where: { id: "execution-1" },
      data: expect.not.objectContaining({ result: expect.anything() }),
    });
    expect(dependencies.db.adminAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        correlationId: "request-correlation-failure",
        outcome: "FAILED",
        metadata: JSON.stringify({ code: "COMMAND_FAILED" }),
      }),
    });
  });

  it("reports a committed event when post-commit process publication fails", async () => {
    dependencies.executeProgressionAction.mockRejectedValue(new Error("listener failed after transaction commit"));
    dependencies.db.adminAuditLog.findFirst.mockResolvedValue({
      metadata: JSON.stringify({ eventId: publicEvent.id, sequence: publicEvent.sequence }),
    });
    dependencies.db.progressEvent.findFirst.mockResolvedValue({
      id: publicEvent.id,
      type: publicEvent.type,
      sequence: publicEvent.sequence,
      payload: JSON.stringify(publicEvent.payload),
      releaseAt: new Date(publicEvent.releaseAt),
    });
    dependencies.publishCampaignEvent.mockImplementation(() => {
      throw new Error("process subscriber failed");
    });

    const result = await executeAdminCommand(input, "gm-1");

    expect(result).toMatchObject({
      event: publicEvent,
      persistence: "COMMITTED",
      publication: "PROCESS_PUBLICATION_FAILED",
      delivery: "PUBLICATION_FAILED",
      playerDelivery: "UNCONFIRMED",
      playerPresentation: "UNCONFIRMED",
      playerAcknowledgment: "UNCONFIRMED",
    });
    expect(dependencies.db.adminAuditLog.create).not.toHaveBeenCalled();
  });

  it("recovers an exact RUNNING retry from committed audit evidence", async () => {
    dependencies.db.commandExecution.findUnique.mockResolvedValue({
      id: "execution-1",
      campaignId: "campaign-1",
      correlationId: "correlation-recovery",
      command: input.command,
      expectedSequence: input.expectedSequence,
      status: "RUNNING",
      result: pendingEnvelope(input),
    });
    dependencies.db.adminAuditLog.findFirst.mockResolvedValue({
      metadata: JSON.stringify({ eventId: publicEvent.id, sequence: publicEvent.sequence }),
    });
    dependencies.db.progressEvent.findFirst.mockResolvedValue({
      id: publicEvent.id,
      type: publicEvent.type,
      sequence: publicEvent.sequence,
      payload: JSON.stringify(publicEvent.payload),
      releaseAt: new Date(publicEvent.releaseAt),
    });

    await expect(executeAdminCommand(input, "gm-1")).resolves.toMatchObject({
      kind: "PROGRESSION_EVENT",
      event: publicEvent,
      idempotentReplay: true,
    });
    expect(dependencies.executeProgressionAction).not.toHaveBeenCalled();
    expect(JSON.parse(succeededEnvelope())).toMatchObject({
      version: 1,
      state: "COMPLETE",
      fingerprint: commandRequestFingerprint(input),
    });
  });

  it("recovers the exact winner after a P2002 create race", async () => {
    dependencies.db.commandExecution.create.mockRejectedValue({ code: "P2002" });
    dependencies.db.commandExecution.findUniqueOrThrow.mockResolvedValue({
      id: "winner-execution",
      campaignId: "campaign-1",
      correlationId: "correlation-winner",
      command: input.command,
      expectedSequence: input.expectedSequence,
      status: "RUNNING",
      result: pendingEnvelope(input),
    });
    dependencies.db.adminAuditLog.findFirst.mockResolvedValue({
      metadata: JSON.stringify({ eventId: publicEvent.id }),
    });
    dependencies.db.progressEvent.findFirst.mockResolvedValue({
      id: publicEvent.id,
      type: publicEvent.type,
      sequence: publicEvent.sequence,
      payload: JSON.stringify(publicEvent.payload),
      releaseAt: new Date(publicEvent.releaseAt),
    });

    await expect(executeAdminCommand(input, "gm-1")).resolves.toMatchObject({
      correlationId: "correlation-winner",
      idempotentReplay: true,
    });
    expect(dependencies.executeProgressionAction).not.toHaveBeenCalled();
    expect(dependencies.db.commandExecution.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "winner-execution" } }),
    );
  });

  it.each([
    ["unsupported version", { version: 2, state: "COMPLETE", fingerprint: "a".repeat(64), receipt: {} }],
    ["corrupt v1 shape", { version: 1, state: "COMPLETE", fingerprint: "a".repeat(64) }],
  ])("fails closed for an %s envelope", async (_label, storedResult) => {
    dependencies.db.commandExecution.findUnique.mockResolvedValue({
      id: "execution-1",
      campaignId: "campaign-1",
      correlationId: "correlation-invalid",
      command: input.command,
      expectedSequence: input.expectedSequence,
      status: "SUCCEEDED",
      result: JSON.stringify(storedResult),
    });

    await expect(executeAdminCommand(input, "gm-1")).rejects.toMatchObject({
      code: "IDEMPOTENCY_RECORD_INVALID",
    });
    expect(dependencies.db.adminAuditLog.findFirst).not.toHaveBeenCalled();
  });

  it.each([
    ["partial event", (receipt: Record<string, unknown>) => delete mutableRecord(receipt.event).payload],
    ["extra event field", (receipt: Record<string, unknown>) => (mutableRecord(receipt.event).unexpected = true)],
    ["wrong event sequence type", (receipt: Record<string, unknown>) => (mutableRecord(receipt.event).sequence = "5")],
    [
      "extra player-event field",
      (receipt: Record<string, unknown>) => (mutableRecord(receipt.playerEvent).unexpected = true),
    ],
    ["extra receipt field", (receipt: Record<string, unknown>) => (receipt.unexpected = true)],
    ["partial receipt", (receipt: Record<string, unknown>) => delete receipt.playerAcknowledgment],
    ["wrong receipt field type", (receipt: Record<string, unknown>) => (receipt.correlationId = 42)],
    ["partial snapshot", (receipt: Record<string, unknown>) => (receipt.snapshot = { sequence: 5 })],
    [
      "extra nested snapshot field",
      (receipt: Record<string, unknown>) => (mutableRecord(mutableRecord(receipt.snapshot).campaign).unexpected = true),
    ],
  ])("rejects a current v1 receipt with a %s", async (_label, mutate) => {
    const receipt = JSON.parse(
      JSON.stringify(commandReceipt({ event: publicEvent, snapshot: publicSnapshot }, "correlation-adversarial")),
    ) as Record<string, unknown>;
    mutate(receipt);
    useSucceededStoredResult(completeEnvelope(receipt));

    await expect(executeAdminCommand(input, "gm-1")).rejects.toMatchObject({
      code: "IDEMPOTENCY_RECORD_INVALID",
    });
  });

  it.each(["not-an-iso-date", "2026-02-30T12:00:00.000Z"])(
    "rejects a staged receipt with malformed or nonexistent preparedAt %s",
    async (preparedAt) => {
      const receipt = JSON.parse(
        JSON.stringify(
          stagedCommandReceipt(
            {
              id: "prepared-adversarial",
              command: "PREPARE_HINT",
              targetKey: "hint-1",
              reservedSequence: 5,
              status: "PREPARED",
              preparedAt: new Date("2026-07-18T12:00:00.000Z"),
            },
            "correlation-stage-adversarial",
            publicSnapshot,
          ),
        ),
      ) as Record<string, unknown>;
      mutableRecord(receipt.stagedAction).preparedAt = preparedAt;
      useSucceededStoredResult(completeEnvelope(receipt, preparedInput), preparedInput);

      await expect(executeAdminCommand(preparedInput, "gm-1")).rejects.toMatchObject({
        code: "IDEMPOTENCY_RECORD_INVALID",
      });
    },
  );

  it.each([
    [
      "extra staged identity field",
      (receipt: Record<string, unknown>) => (mutableRecord(receipt.stagedAction).unexpected = true),
    ],
    [
      "wrong staged target type",
      (receipt: Record<string, unknown>) => (mutableRecord(receipt.stagedAction).targetKey = 42),
    ],
    [
      "mismatched prepared-action identity",
      (receipt: Record<string, unknown>) => (receipt.preparedActionId = "different-prepared-action"),
    ],
  ])("rejects a staged receipt with a %s", async (_label, mutate) => {
    const receipt = JSON.parse(
      JSON.stringify(
        stagedCommandReceipt(
          {
            id: "prepared-adversarial",
            command: "PREPARE_HINT",
            targetKey: "hint-1",
            reservedSequence: 5,
            status: "PREPARED",
            preparedAt: new Date("2026-07-18T12:00:00.000Z"),
          },
          "correlation-stage-adversarial",
          publicSnapshot,
        ),
      ),
    ) as Record<string, unknown>;
    mutate(receipt);
    useSucceededStoredResult(completeEnvelope(receipt, preparedInput), preparedInput);

    await expect(executeAdminCommand(preparedInput, "gm-1")).rejects.toMatchObject({
      code: "IDEMPOTENCY_RECORD_INVALID",
    });
  });

  it.each([
    { label: "partial snapshot", snapshot: { sequence: 5 } },
    { label: "extra snapshot field", snapshot: { ...publicSnapshot, unexpected: true } },
    { label: "partial event", snapshot: publicSnapshot, event: { ...publicEvent, payload: undefined } },
    { label: "extra receipt field", snapshot: publicSnapshot, extra: { unexpected: true } },
  ])("rejects a legacy receipt with a malformed $label", async ({ snapshot, event = publicEvent, extra = {} }) => {
    const legacyInput = { ...input, targetKey: undefined, payload: {}, reason: undefined };
    useSucceededStoredResult(
      JSON.stringify({
        event,
        snapshot,
        correlationId: "correlation-legacy-adversarial",
        persistence: "COMMITTED",
        delivery: "PUBLISHED",
        ...extra,
      }),
      legacyInput,
    );

    await expect(executeAdminCommand(legacyInput, "gm-1")).rejects.toMatchObject({
      code: "IDEMPOTENCY_RECORD_INVALID",
    });
  });

  it("marks PREPARE_HINT committed without claiming any Crew publication", async () => {
    const result = await executeAdminCommand(preparedInput, "gm-1");

    expect(result).toMatchObject({
      kind: "STAGED_ACTION",
      event: null,
      preparedActionId: "prepared-5",
      stagedAction: {
        preparedActionId: "prepared-5",
        command: "PREPARE_HINT",
        targetKey: "hint-1",
        reservedSequence: 5,
        status: "PREPARED",
        preparedAt: "2026-07-18T12:00:00.000Z",
      },
      persistence: "COMMITTED",
      publication: "NOT_APPLICABLE",
      delivery: "NOT_ATTEMPTED",
      deliveryScope: "NO_PLAYER_EVENT",
      playerEvent: null,
    });
    expect(Object.isFrozen(result.kind === "STAGED_ACTION" ? result.stagedAction : null)).toBe(true);
    const envelope = succeededEnvelope();
    dependencies.db.commandExecution.findUnique.mockResolvedValue({
      id: "execution-1",
      campaignId: "campaign-1",
      correlationId: result.correlationId,
      command: preparedInput.command,
      expectedSequence: preparedInput.expectedSequence,
      status: "SUCCEEDED",
      result: envelope,
    });
    const replay = await executeAdminCommand(preparedInput, "gm-1");
    expect(replay).toMatchObject({ kind: "STAGED_ACTION", event: null, idempotentReplay: true });
    expect(Object.isFrozen(replay.kind === "STAGED_ACTION" ? replay.stagedAction : null)).toBe(true);
    expect(dependencies.transaction.campaign.updateMany).toHaveBeenCalledWith({
      where: { id: "campaign-1", currentSequence: 4 },
      data: { currentSequence: { increment: 1 } },
    });
    expect(dependencies.publishCampaignEvent).not.toHaveBeenCalled();
  });

  it("recovers a committed prepared action left behind by an interrupted command receipt update", async () => {
    dependencies.db.commandExecution.findUnique.mockResolvedValue({
      id: "execution-1",
      campaignId: "campaign-1",
      correlationId: "correlation-stage",
      command: "PREPARE_HINT",
      expectedSequence: 4,
      status: "RUNNING",
      result: pendingEnvelope(preparedInput),
    });
    dependencies.db.adminAuditLog.findFirst.mockResolvedValue({
      metadata: JSON.stringify({ preparedActionId: "prepared-5", reservedSequence: 5 }),
    });
    dependencies.db.preparedAction.findFirst.mockResolvedValue({
      id: "prepared-5",
      campaignId: "campaign-1",
      command: "PREPARE_HINT",
      targetKey: "hint-1",
      expectedSequence: 5,
      status: "PREPARED",
      preparedAt: new Date("2026-07-18T12:00:00.000Z"),
    });

    await expect(executeAdminCommand(preparedInput, "gm-1")).resolves.toMatchObject({
      kind: "STAGED_ACTION",
      event: null,
      preparedActionId: "prepared-5",
      idempotentReplay: true,
      publication: "NOT_APPLICABLE",
      delivery: "NOT_ATTEMPTED",
      playerEvent: null,
    });
    expect(dependencies.transaction.preparedAction.create).not.toHaveBeenCalled();
    expect(dependencies.db.commandExecution.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "SUCCEEDED" }) }),
    );
  });

  it("rejects a lost append-event sequence reservation before any event mutation", async () => {
    dependencies.transaction.campaign.updateMany.mockResolvedValue({ count: 0 });
    const reconciliation = {
      command: "REQUEST_RECONCILIATION" as const,
      campaignSlug: "test-voyage",
      expectedSequence: 4,
      idempotencyKey: "reconcile-123456",
      payload: {},
    };

    await expect(executeAdminCommand(reconciliation, "gm-1")).rejects.toMatchObject({ code: "STALE_SEQUENCE" });
    expect(dependencies.transaction.progressEvent.create).not.toHaveBeenCalled();
  });
});
