import { describe, expect, it } from "vitest";
import { commandCapability, describePresence } from "./admin";

describe("truthful player presence", () => {
  it("distinguishes synchronized active devices from a browser merely seen before", () => {
    const now = new Date("2026-07-16T20:00:00Z").getTime();
    expect(
      describePresence(
        [{ lastHeartbeatAt: new Date(now - 5_000), disconnectedAt: null, acknowledgedSequence: 8, route: "/journal" }],
        8,
        now,
      ),
    ).toMatchObject({ state: "CONNECTED", synchronized: true, activeDevices: 1, lag: 0 });
    expect(
      describePresence(
        [{ lastHeartbeatAt: new Date(now - 90_000), disconnectedAt: null, acknowledgedSequence: 7, route: null }],
        8,
        now,
      ),
    ).toMatchObject({ state: "RECENTLY_LOST", synchronized: false, lag: 1 });
  });

  it("expires stale devices and never calls unknown state connected", () => {
    const now = new Date("2026-07-16T20:00:00Z").getTime();
    expect(
      describePresence(
        [{ lastHeartbeatAt: new Date(now - 180_000), disconnectedAt: null, acknowledgedSequence: 2, route: null }],
        9,
        now,
      ).state,
    ).toBe("STALE");
    expect(describePresence([], 0, now).state).toBe("UNKNOWN");
  });
});

describe("capability mapping", () => {
  it("keeps preparation, release, recovery, and diagnostics separate", () => {
    expect(commandCapability("PREPARE_CHAPTER")).toBe("PREPARE_PROGRESSION");
    expect(commandCapability("RELEASE_CHAPTER")).toBe("RELEASE_PROGRESSION");
    expect(commandCapability("UNDO_LAST")).toBe("REVERSE_PROGRESSION");
    expect(commandCapability("REQUEST_RECONCILIATION")).toBe("VIEW_DIAGNOSTICS");
  });
});
