import { describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  execute: vi.fn(),
}));

vi.mock("@/compatibility/legacy-quartermaster", () => ({
  executeLegacyQuartermasterCommand: dependencies.execute,
  LegacyQuartermasterConflict: class LegacyQuartermasterConflict extends Error {
    constructor(
      message: string,
      public readonly code: string,
    ) {
      super(message);
    }
  },
}));

import { commandRequestFingerprint, executeAdminCommand } from "./admin-command";

const input = {
  command: "RELEASE_CHAPTER" as const,
  campaignSlug: "development-forever-treasure",
  expectedSequence: 4,
  idempotencyKey: "canonical-command-key-001",
  payload: {},
};

const receipt = {
  kind: "PROGRESSION_EVENT" as const,
  event: { id: "event-5", type: "CHAPTER_RELEASED", sequence: 5, payload: {}, releaseAt: "2026-07-21T00:00:00.000Z" },
  correlationId: "correlation-1",
  persistence: "COMMITTED" as const,
  publication: "PROCESS_PUBLISHED" as const,
  delivery: "PUBLISHED" as const,
  deliveryScope: "PROCESS_SUBSCRIBERS_ONLY" as const,
  playerDelivery: "UNCONFIRMED" as const,
  playerPresentation: "UNCONFIRMED" as const,
  playerAcknowledgment: "UNCONFIRMED" as const,
  playerEvent: { id: "event-5", type: "CHAPTER_RELEASED", sequence: 5 },
};

describe("canonical Captain command boundary", () => {
  it("delegates the historical GM request shape to the canonical Chronicle dispatcher", async () => {
    dependencies.execute.mockResolvedValue(receipt);

    await expect(executeAdminCommand(input, "captain-1", { correlationId: "correlation-1" })).resolves.toEqual(receipt);

    expect(dependencies.execute).toHaveBeenCalledWith(input, "captain-1", "correlation-1");
  });

  it("converts a canonical command conflict into the stable GM route error", async () => {
    const { LegacyQuartermasterConflict } = await import("@/compatibility/legacy-quartermaster");
    dependencies.execute.mockRejectedValue(new LegacyQuartermasterConflict("state changed", "STALE_SEQUENCE"));

    await expect(executeAdminCommand(input, "captain-1")).rejects.toMatchObject({
      message: "state changed",
      code: "STALE_SEQUENCE",
    });
  });

  it("uses a deterministic request fingerprint for safe command provenance", () => {
    expect(commandRequestFingerprint(input)).toBe(commandRequestFingerprint({ ...input, payload: {} }));
    expect(commandRequestFingerprint(input)).not.toBe(commandRequestFingerprint({ ...input, expectedSequence: 5 }));
  });
});
