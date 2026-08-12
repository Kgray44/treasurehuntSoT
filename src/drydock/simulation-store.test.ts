import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({
  $transaction: vi.fn(),
  taleDraft: { findFirst: vi.fn() },
  drydockScenario: { findFirst: vi.fn() },
  drydockSimulationRun: { create: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ db: prisma }));

import { canonicalChecksum } from "@/drydock/canonical";
import { scheduleDrydockSimulation, DrydockSimulationSourceChangedError } from "@/drydock/simulation-store";
import { drydockSimulationSourceChecksum } from "@/drydock/simulation/source";
import type { PublishedTaleSnapshot } from "@/chronicle/types";

const snapshot: PublishedTaleSnapshot = {
  schemaVersion: 1,
  tale: { id: "tale", slug: "tale", title: "Tale", subtitle: null, shortDescription: null, longDescription: null, coverAssetId: null, theme: "default", visibility: "PRIVATE", playerCountMin: 1, playerCountMax: 1, estimatedDuration: null, contentWarnings: null },
  chapters: [], assets: [], locations: [], artifacts: [], publishedAt: "2026-08-12T00:00:00.000Z",
};
const scenario = { schemaVersion: 1, id: "scenario", revision: 1, sourceChecksum: drydockSimulationSourceChecksum(snapshot), title: "Run", purpose: "Prove durable source binding", seed: "seed", initialState: { variables: {}, inventory: [], actorMode: "CREATOR" }, environment: { virtualStart: "2026-08-12T00:00:00.000Z", locale: "en-US", viewport: "DESKTOP", reducedMotion: false, soundEnabled: true, keyboardOnly: false }, limits: { maxSteps: 1, maxStates: 1, maxTraceEntries: 1, maxVirtualMilliseconds: 1 }, inputs: [], faults: [], assertions: [], tags: [] };

describe("Drydock simulation store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.$transaction.mockImplementation(async (operation: (tx: typeof prisma) => Promise<unknown>) => operation(prisma));
    prisma.taleDraft.findFirst.mockResolvedValue({ id: "draft", revisionNumber: 7 });
    prisma.drydockScenario.findFirst.mockResolvedValue({ revisions: [{ id: "scenario-revision", revision: 1, sourceChecksum: scenario.sourceChecksum, scenario: JSON.stringify(scenario) }] });
    prisma.drydockSimulationRun.create.mockResolvedValue({ runId: "run", sourceChecksum: scenario.sourceChecksum, sourceRevision: 7, status: "QUEUED", resultDigest: null, coverageDigest: null, completedInputs: 0, cancellationRequestedAt: null, createdAt: new Date("2026-08-12T00:00:00.000Z"), completedAt: null });
  });

  it("freezes the server-derived source snapshot with the selected immutable Scenario revision", async () => {
    const queued = await scheduleDrydockSimulation({ taleId: "tale", scenarioId: "scenario", snapshot });

    expect(queued).toMatchObject({ runId: "run", scenarioId: "scenario", scenarioRevision: 1, status: "QUEUED" });
    expect(prisma.drydockSimulationRun.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ sourceSnapshot: JSON.stringify(snapshot), sourceRevision: 7 }) }));
  });

  it("does not queue a stored Scenario against a changed source", async () => {
    prisma.drydockScenario.findFirst.mockResolvedValueOnce({ revisions: [{ id: "scenario-revision", revision: 1, sourceChecksum: canonicalChecksum({ stale: true }), scenario: JSON.stringify({ ...scenario, sourceChecksum: canonicalChecksum({ stale: true }) }) }] });

    await expect(scheduleDrydockSimulation({ taleId: "tale", scenarioId: "scenario", snapshot })).rejects.toBeInstanceOf(DrydockSimulationSourceChangedError);
    expect(prisma.drydockSimulationRun.create).not.toHaveBeenCalled();
  });
});
