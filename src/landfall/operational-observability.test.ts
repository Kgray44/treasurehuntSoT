import { describe, expect, it } from "vitest";
import { recordLandfallOperation, observeLandfallOperation, landfallDurationBand } from "./operational-observability";
// @sounding-line-registration owner=project-landfall suite=unit.landfall contracts=landfall.player-live-position

describe("Landfall uses categorical platform operations logs", () => {
  it.each(["actorId", "sessionId", "latitude", "coordinate", "title", "query", "token", "payload", "url", "error"])(
    "rejects extra %s rather than trusting generic redaction",
    (field) => {
      const events: unknown[] = [];
      expect(
        recordLandfallOperation(
          { operation: "EVIDENCE", outcome: "SUCCEEDED", durationBand: "LT_1_S", count: 1, [field]: "private" },
          (event) => events.push(event),
        ),
      ).toBe(false);
      expect(events).toEqual([]);
    },
  );
  it.each([
    [200, "SUCCEEDED"],
    [401, "DENIED"],
    [403, "DENIED"],
    [409, "REJECTED"],
    [429, "RATE_LIMITED"],
    [503, "FAILED"],
  ] as const)("preserves the exact response/body/headers while reporting HTTP %d", async (status, outcome) => {
    const response = new Response("synthetic private response", {
      status,
      headers: { "Cache-Control": "private, no-store" },
    });
    const events: Record<string, unknown>[] = [];
    expect(
      await observeLandfallOperation(
        "EVIDENCE",
        async () => response,
        (event) => events.push(event),
      ),
    ).toBe(response);
    expect(await response.text()).toBe("synthetic private response");
    expect(JSON.stringify(events)).not.toMatch(/private|response|Cache-Control/);
    expect(events).toHaveLength(1);
    expect(events[0].outcome).toBe(outcome);
  });
  it("preserves failure even if the platform sink throws", async () => {
    const cause = new Error("synthetic private exception");
    await expect(
      observeLandfallOperation(
        "EVIDENCE",
        async () => {
          throw cause;
        },
        () => {
          throw new Error("sink down");
        },
      ),
    ).rejects.toBe(cause);
    const response = new Response("success");
    expect(
      await observeLandfallOperation(
        "EVIDENCE",
        async () => response,
        () => {
          throw new Error("sink down");
        },
      ),
    ).toBe(response);
  });
  it("rejects arbitrary labels and keeps timing categorical", () => {
    expect(
      recordLandfallOperation({
        operation: "participant-secret",
        outcome: "SUCCEEDED",
        durationBand: "LT_1_S",
        count: 1,
      }),
    ).toBe(false);
    expect([NaN, -1, 49, 50, 250, 1000, 5000, 30000].map(landfallDurationBand)).toEqual([
      "UNKNOWN",
      "UNKNOWN",
      "LT_50_MS",
      "LT_250_MS",
      "LT_1_S",
      "LT_5_S",
      "LT_30_S",
      "GE_30_S",
    ]);
  });
});
