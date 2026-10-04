import { describe, expect, it } from "vitest";
import { nativeReturnLogObservation, nativeReturnObservationSchema } from "./native-return-observation";
// @sounding-line-registration owner=project-landfall suite=unit.landfall-device-lab contracts=landfall.device-lab-evidence
const event = {
  level: 30,
  event: "landfall.operation",
  operation: "NOTIFICATION_RETURN",
  count: 1,
  msg: "Landfall operational outcome",
  outcome: "UNAVAILABLE",
  durationBand: "LT_50_MS",
};
describe("owned native cold-return platform evidence", () => {
  it("exports finite server outcomes without log metadata, claims or private identifiers", () => {
    expect(
      nativeReturnLogObservation(
        JSON.stringify({
          ...event,
          handle: "private-claim",
          pid: 9999,
          hostname: "private-host",
          time: 1234,
          scope: { player: "private-player" },
        }),
      ),
    ).toEqual({ outcome: "UNAVAILABLE", durationBand: "LT_50_MS" });
  });
  it("rejects unrelated, malformed and unbounded log data", () => {
    for (const line of [
      "not json",
      "x".repeat(16385),
      ...[
        { ...event, operation: "BACKGROUND_SETUP" },
        { ...event, event: "other" },
        { ...event, count: 2 },
        { ...event, level: 40 },
        { ...event, outcome: "private-claim" },
        { ...event, durationBand: "private-epoch" },
        { ...event, msg: "other" },
      ].map((value) => JSON.stringify(value)),
    ])
      expect(nativeReturnLogObservation(line)).toBeNull();
  });
  it("rejects private extensions and excess events in saved observations", () => {
    const observation = {
      version: 1,
      sourceSha: "a".repeat(40),
      events: [{ outcome: "RETURNED", durationBand: "LT_1_S" }],
    };
    expect(nativeReturnObservationSchema.safeParse(observation).success).toBe(true);
    expect(nativeReturnObservationSchema.safeParse({ ...observation, handle: "private" }).success).toBe(false);
    expect(
      nativeReturnObservationSchema.safeParse({ ...observation, events: Array(33).fill(observation.events[0]) })
        .success,
    ).toBe(false);
  });
});
