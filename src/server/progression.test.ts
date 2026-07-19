import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => {
  const tx = {
    campaign: { findUniqueOrThrow: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
    saveStateSnapshot: { create: vi.fn(), findFirst: vi.fn(), delete: vi.fn() },
    progressEvent: { create: vi.fn(), findFirst: vi.fn() },
    campaignSnapshot: { create: vi.fn() },
    adminAuditLog: { create: vi.fn() },
  };
  return {
    tx,
    db: { $transaction: vi.fn() },
    publishCampaignEvent: vi.fn(),
    buildPublicSnapshot: vi.fn(),
  };
});

vi.mock("@/lib/db", () => ({ db: dependencies.db }));
vi.mock("@/lib/events", () => ({ publishCampaignEvent: dependencies.publishCampaignEvent }));
vi.mock("@/lib/snapshot", () => ({ buildPublicSnapshot: dependencies.buildPublicSnapshot }));

import { executeProgressionAction } from "./progression";

const campaign = {
  id: "campaign-1",
  slug: "test-voyage",
  status: "ACTIVE",
  currentSequence: 4,
  finaleState: "SEALED",
  finaleTeaser: null,
  finaleRequirements: "[]",
  chapters: [
    {
      id: "chapter-1",
      ordinal: 1,
      state: "ACTIVE",
      revealedAt: null,
      solvedAt: null,
      content: { title: "Chapter", narrative: "Narrative", objective: "Objective" },
      clues: [],
    },
  ],
  awards: [],
  artifacts: [],
  mapLocations: [],
  mapRoutes: [],
  sideQuests: [],
  journalEntries: [],
};

async function runIsolatedExpectedSequenceRace() {
  let reserved = false;
  dependencies.tx.campaign.updateMany.mockImplementation(async () => {
    if (reserved) return { count: 0 };
    reserved = true;
    return { count: 1 };
  });
  return Promise.allSettled([
    executeProgressionAction("test-voyage", "PAUSE", "gm-1", { expectedSequence: 4 }),
    executeProgressionAction("test-voyage", "PAUSE", "gm-2", { expectedSequence: 4 }),
  ]);
}

describe("progression sequence reservation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.db.$transaction.mockImplementation((operation: (tx: typeof dependencies.tx) => unknown) =>
      operation(dependencies.tx),
    );
    dependencies.tx.campaign.findUniqueOrThrow.mockResolvedValue(campaign);
    dependencies.tx.campaign.updateMany.mockResolvedValue({ count: 1 });
    dependencies.tx.campaign.update.mockResolvedValue({});
    dependencies.tx.saveStateSnapshot.create.mockResolvedValue({});
    dependencies.tx.progressEvent.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: "event-5", ...data, releaseAt: new Date("2026-07-18T12:00:00.000Z") }),
    );
    dependencies.tx.campaignSnapshot.create.mockResolvedValue({});
    dependencies.tx.adminAuditLog.create.mockResolvedValue({});
    dependencies.buildPublicSnapshot.mockResolvedValue({ sequence: 5 });
  });

  it("reserves exactly expectedSequence + 1 before business mutation and reuses it everywhere", async () => {
    const result = await executeProgressionAction("test-voyage", "PAUSE", "gm-1", {
      expectedSequence: 4,
      correlationId: "correlation-1",
      reason: "Pause for safety",
    });

    expect(dependencies.tx.campaign.updateMany).toHaveBeenCalledWith({
      where: { id: "campaign-1", currentSequence: 4 },
      data: { currentSequence: { increment: 1 } },
    });
    expect(dependencies.tx.saveStateSnapshot.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ sequence: 4 }) }),
    );
    expect(dependencies.tx.progressEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ sequence: 5, type: "CAMPAIGN_PAUSED" }) }),
    );
    expect(dependencies.tx.campaignSnapshot.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ sequence: 5 }) }),
    );
    expect(dependencies.tx.adminAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          correlationId: "correlation-1",
          metadata: expect.stringContaining('"reservedSequence":5'),
        }),
      }),
    );
    expect(result.event).toMatchObject({ id: "event-5", sequence: 5, type: "CAMPAIGN_PAUSED" });
  });

  it("preserves non-admin callers by deriving the reservation from current state when omitted", async () => {
    await executeProgressionAction("test-voyage", "PAUSE", "system-actor");
    expect(dependencies.tx.campaign.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "campaign-1", currentSequence: 4 } }),
    );
  });

  it("stops before state, event, snapshot, or audit mutation when the CAS loses", async () => {
    dependencies.tx.campaign.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      executeProgressionAction("test-voyage", "PAUSE", "gm-1", { expectedSequence: 4 }),
    ).rejects.toMatchObject({ code: "STALE_SEQUENCE" });
    expect(dependencies.tx.saveStateSnapshot.create).not.toHaveBeenCalled();
    expect(dependencies.tx.campaign.update).not.toHaveBeenCalled();
    expect(dependencies.tx.progressEvent.create).not.toHaveBeenCalled();
    expect(dependencies.tx.campaignSnapshot.create).not.toHaveBeenCalled();
    expect(dependencies.tx.adminAuditLog.create).not.toHaveBeenCalled();
  });

  it("provides an isolated concurrency helper proving only one same-sequence intent can reserve", async () => {
    const results = await runIsolatedExpectedSequenceRace();
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((result) => result.status === "rejected");
    expect(rejected).toMatchObject({ status: "rejected", reason: { code: "STALE_SEQUENCE" } });
    expect(dependencies.tx.progressEvent.create).toHaveBeenCalledTimes(1);
  });
});
