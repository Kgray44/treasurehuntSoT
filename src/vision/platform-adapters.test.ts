import { afterEach, describe, expect, it, vi } from "vitest";
import { MockVisionPlatformAdapter, WebCompanionPlatformAdapter } from "@/vision/platform-adapters";

afterEach(() => vi.restoreAllMocks());
describe("Vision platform adapters", () => {
  it("truthfully reports the future web companion as unavailable", async () => {
    await expect(new WebCompanionPlatformAdapter().connect()).resolves.toMatchObject({
      available: false,
      reason: "COMPANION_UNAVAILABLE",
    });
  });
  it("uses the governed HTTP boundary for deterministic mock attempts", async () => {
    const responses = [
      {
        id: "attempt-1234",
        attemptState: "ARMED",
        result: null,
        guidanceCode: null,
        eventDeliveryStatus: "PENDING",
        duplicateResultRejected: false,
      },
      {
        id: "attempt-1234",
        attemptState: "EVENT_DELIVERED",
        result: "VERIFIED",
        guidanceCode: "MATCH_CONFIRMED",
        eventDeliveryStatus: "DELIVERED",
        duplicateResultRejected: true,
      },
    ];
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(
      async () =>
        new Response(JSON.stringify(responses.shift()), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    );
    const progress: string[] = [];
    const result = await new MockVisionPlatformAdapter("PWA").beginPlayerScan({
      sessionId: "session-1234",
      blockId: "block-12345",
      waypointVersionId: "version-1234",
      scenario: "duplicate_result_delivery",
      onProgress: (state) => progress.push(state),
    });
    expect(result).toMatchObject({ result: "VERIFIED", duplicateResultRejected: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({
      platform: "PWA",
      adapterType: "MOCK",
      scenario: "duplicate_result_delivery",
    });
    expect(progress).toEqual(["ARMED", "CAPTURING", "EVENT_DELIVERED"]);
  });
});
