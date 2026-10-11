import { expect, it } from "vitest";
import { deviceLabStartupStageSchema, deviceLabAppleLifecycleDeliverySchema } from "./startup-diagnostics";

it("rejects arbitrary logs, native payloads and session data from startup diagnostics", () => {
  expect(deviceLabStartupStageSchema.parse({ stage: "WAITING_WORKER" })).toEqual({ stage: "WAITING_WORKER" });
  expect(() => deviceLabStartupStageSchema.parse({ stage: "private failure message" })).toThrow();
  expect(() => deviceLabStartupStageSchema.parse({ stage: "ENTRY", latitude: 44 })).toThrow();
  expect(() => deviceLabStartupStageSchema.parse({ stage: "ENTRY", csrfToken: "private" })).toThrow();
});

it("accepts bounded Apple delivery counters and rejects native payloads and uncontrolled diagnostics", () => {
  expect(
    deviceLabAppleLifecycleDeliverySchema.parse({
      foregroundQueued: 2,
      foregroundFailed: 1,
      foregroundNotifications: 3,
      foregroundRejected: 1,
      sceneForegroundNotifications: 2,
      sceneBackgroundNotifications: 2,
    }),
  ).toEqual({
    foregroundQueued: 2,
    foregroundFailed: 1,
    foregroundNotifications: 3,
    foregroundRejected: 1,
    sceneForegroundNotifications: 2,
    sceneBackgroundNotifications: 2,
  });
  for (const value of [
    { foregroundDelivered: 129 },
    { foregroundNotifications: 129 },
    { backgroundRejected: -1 },
    { sceneForegroundNotifications: 129 },
    { sceneBackgroundNotifications: -1 },
    { backgroundQueued: -1 },
    { foregroundQueued: 1.5 },
    { pendingHints: [] },
    { coordinate: [44, -72] },
    { error: "private navigation URL" },
  ])
    expect(deviceLabAppleLifecycleDeliverySchema.safeParse(value).success).toBe(false);
});
