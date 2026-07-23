import { beforeEach, describe, expect, it, vi } from "vitest";

const { create } = vi.hoisted(() => ({ create: vi.fn() }));

vi.mock("@/lib/db", () => ({ db: { compatibilityObservation: { create } } }));

import { recordCompatibilityObservation } from "./compatibility-observation";

const observation = {
  correlationId: "phase2-test-correlation",
  operation: "LEGACY_PLAYER_READ" as const,
  routeKey: "player-compatibility",
  disposition: "ADAPTED" as const,
  canonicalSessionId: "session-1",
  canonicalAccountId: "account-1",
  testTraffic: true,
};

describe("Phase 2 compatibility observation", () => {
  beforeEach(() => create.mockReset());

  it("persists only the frozen privacy-safe contract", async () => {
    create.mockResolvedValue({ id: "observation-1" });
    await expect(recordCompatibilityObservation(observation)).resolves.toEqual({ recorded: true });
    expect(create).toHaveBeenCalledWith({ data: observation });
  });
});
