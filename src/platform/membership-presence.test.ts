import { describe, expect, it } from "vitest";
import { aggregateMembershipPresence } from "./membership-presence";

const now = new Date("2026-08-10T20:00:00.000Z");
const device = (
  patch: Partial<{
    lastHeartbeatAt: Date;
    acknowledgedSequence: number;
    safeActivity: string | null;
    disconnectedAt: Date | null;
    updatedAt: Date;
  }> = {},
) => ({
  lastHeartbeatAt: new Date("2026-08-10T19:59:45.000Z"),
  acknowledgedSequence: 7,
  safeActivity: "JOURNAL",
  disconnectedAt: null,
  updatedAt: new Date("2026-08-10T19:59:45.000Z"),
  ...patch,
});

describe("membership presence aggregation", () => {
  it("preserves no-evidence as unknown even when a legacy Voyage aggregate could exist", () => {
    expect(aggregateMembershipPresence([], 7, now)).toMatchObject({
      state: "UNKNOWN",
      synchronizationState: "UNKNOWN",
      acknowledgedSequence: null,
      eventLag: null,
    });
  });

  it("keeps member aggregates independent rather than copying one heartbeat to the crew", () => {
    const playerA = aggregateMembershipPresence([device({ acknowledgedSequence: 7 })], 7, now);
    const playerB = aggregateMembershipPresence([], 7, now);
    expect(playerA.state).toBe("CONNECTED");
    expect(playerB).toMatchObject({ state: "UNKNOWN", acknowledgedSequence: null, activeDeviceCount: 0 });
  });

  it("derives connected, synchronized and catching-up states from current device evidence", () => {
    expect(aggregateMembershipPresence([device()], 7, now)).toMatchObject({
      state: "CONNECTED",
      synchronizationState: "SYNCHRONIZED",
      eventLag: 0,
      activeDeviceCount: 1,
    });
    expect(aggregateMembershipPresence([device({ acknowledgedSequence: 4 })], 7, now)).toMatchObject({
      state: "CONNECTED",
      synchronizationState: "CATCHING_UP",
      eventLag: 3,
    });
  });

  it("uses the freshest acknowledged device and ignores a disconnected tab", () => {
    const projection = aggregateMembershipPresence(
      [device({ acknowledgedSequence: 3 }), device({ acknowledgedSequence: 7, disconnectedAt: now })],
      7,
      now,
    );
    expect(projection).toMatchObject({ state: "CONNECTED", acknowledgedSequence: 3, activeDeviceCount: 1 });
  });

  it("classifies recent loss and stale evidence from member-scoped timestamps", () => {
    expect(
      aggregateMembershipPresence([device({ lastHeartbeatAt: new Date("2026-08-10T19:56:00.000Z") })], 7, now),
    ).toMatchObject({ state: "RECENTLY_LOST", synchronizationState: "UNKNOWN" });
    expect(
      aggregateMembershipPresence([device({ lastHeartbeatAt: new Date("2026-08-10T19:50:00.000Z") })], 7, now),
    ).toMatchObject({ state: "STALE", synchronizationState: "UNKNOWN" });
  });
});
