import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({
  $transaction: vi.fn(),
  taleDraft: { findFirst: vi.fn() },
  drydockScenario: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), findMany: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ db: prisma }));

import { canonicalChecksum } from "@/drydock/canonical";
import { DrydockScenarioRevisionConflictError, saveDrydockScenario } from "@/drydock/scenario-store";

const scenario = (revision = 1) => ({
  schemaVersion: 1,
  id: "scenario-store",
  revision,
  sourceChecksum: canonicalChecksum({ synthetic: true }),
  title: "Synthetic stored Scenario",
  purpose: "Prove private revision storage.",
  seed: "scenario-store-seed",
  initialState: { variables: {}, inventory: [], actorMode: "CREATOR" },
  environment: {
    virtualStart: "2026-08-12T00:00:00.000Z",
    locale: "en-US",
    viewport: "DESKTOP",
    reducedMotion: true,
    soundEnabled: false,
    keyboardOnly: true,
  },
  limits: { maxSteps: 4, maxStates: 4, maxTraceEntries: 4, maxVirtualMilliseconds: 4_000 },
  inputs: [{ kind: "CONTINUE" }],
  faults: [],
  assertions: [],
  tags: ["synthetic"],
});

describe("Drydock Scenario store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.$transaction.mockImplementation(async (operation: (tx: typeof prisma) => Promise<unknown>) =>
      operation(prisma),
    );
    prisma.taleDraft.findFirst.mockResolvedValue({ id: "draft-a" });
  });

  it("creates revision one through the owning Chronicle draft only", async () => {
    prisma.drydockScenario.findFirst.mockResolvedValue(null);
    prisma.drydockScenario.create.mockResolvedValue({
      revisions: [{ revision: 1, createdAt: new Date("2026-08-12T00:00:00.000Z") }],
    });

    await expect(saveDrydockScenario("tale-a", scenario())).resolves.toMatchObject({
      scenarioId: "scenario-store",
      revision: 1,
    });
    expect(prisma.taleDraft.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { taleId: "tale-a" } }));
    expect(prisma.drydockScenario.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ draftId: "draft-a", scenarioId: "scenario-store" }) }),
    );
  });

  it("rejects stale revision writes rather than overwriting Scenario history", async () => {
    prisma.drydockScenario.findFirst.mockResolvedValue({ id: "record-a", currentRevision: 3 });

    await expect(saveDrydockScenario("tale-a", scenario(3))).rejects.toBeInstanceOf(
      DrydockScenarioRevisionConflictError,
    );
    expect(prisma.drydockScenario.update).not.toHaveBeenCalled();
  });
});
