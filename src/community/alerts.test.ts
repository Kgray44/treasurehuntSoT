import { describe, expect, it, vi } from "vitest";
import { communityOperationalAlerts, emitCommunityOperationalAlert } from "./alerts";

describe("community operational alerts", () => {
  it("emits only bounded health and queue counts", () => {
    const alerts = communityOperationalAlerts(
      [{ healthy: true }, { healthy: false }],
      { queueDepth: 8, deadLetters: 2 },
      "2026-08-27T12:00:00.000Z",
    );
    expect(alerts).toEqual([
      expect.objectContaining({ code: "COMMUNITY_PROVIDER_DEGRADED", providerCount: 1 }),
      expect.objectContaining({ code: "COMMUNITY_QUEUE_BACKLOG", severity: "CRITICAL", deadLetterCount: 2 }),
    ]);
    const emit = vi.fn();
    emitCommunityOperationalAlert(alerts[1]!, emit);
    expect(emit).toHaveBeenCalledWith(expect.stringContaining('"event":"community.operational-alert"'));
  });
});
