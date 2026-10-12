import { expect, it } from "vitest";
import {
  deviceLabStartupStageSchema,
  deviceLabAppleLifecycleDeliverySchema,
  deviceLabAppleLifecycleTraceSchema,
} from "./startup-diagnostics";

it("rejects arbitrary logs, native payloads and session data from startup diagnostics", () => {
  expect(deviceLabStartupStageSchema.parse({ stage: "WAITING_WORKER" })).toEqual({ stage: "WAITING_WORKER" });
  expect(() => deviceLabStartupStageSchema.parse({ stage: "private failure message" })).toThrow();
  expect(() => deviceLabStartupStageSchema.parse({ stage: "ENTRY", latitude: 44 })).toThrow();
  expect(() => deviceLabStartupStageSchema.parse({ stage: "ENTRY", csrfToken: "private" })).toThrow();
});

const observedTrace = {
  version: 1,
  instance: "04e9971e-7620-4f70-b144-7cb8674b5103",
  truncated: false,
  events: [
    {
      sequence: 1,
      elapsedMs: 100,
      event: "DOCUMENT_COMMITTED",
      appState: "ACTIVE",
      owningSceneState: "FOREGROUND_ACTIVE",
      foreground: true,
      documentEpoch: 1,
    },
    {
      sequence: 2,
      elapsedMs: 200,
      event: "BACKGROUND_DELIVERED",
      appState: "BACKGROUND",
      owningSceneState: "BACKGROUND",
      foreground: false,
      documentEpoch: 1,
      dispatchDocumentEpoch: 1,
      javascriptDispatchResult: true,
    },
    {
      sequence: 3,
      elapsedMs: 300,
      event: "SCENE_ACTIVE",
      appState: "ACTIVE",
      owningSceneState: "FOREGROUND_ACTIVE",
      foreground: false,
      documentEpoch: 1,
      notificationSceneOwned: true,
    },
  ],
};

it("retains native observation order without interpreting dispatch as listener acknowledgement", () => {
  expect(deviceLabAppleLifecycleTraceSchema.parse(observedTrace)).toEqual(observedTrace);
  expect(
    deviceLabAppleLifecycleTraceSchema.safeParse({
      ...observedTrace,
      events: [observedTrace.events[1], observedTrace.events[0]],
    }).success,
  ).toBe(false);
  expect(
    deviceLabAppleLifecycleTraceSchema.safeParse({
      ...observedTrace,
      events: observedTrace.events.map((event, index) => ({ ...event, elapsedMs: 300 - index })),
    }).success,
  ).toBe(false);
  expect(deviceLabAppleLifecycleTraceSchema.safeParse({ ...observedTrace, truncated: true }).success).toBe(false);
});

it("rejects identifying data, raw content and unbounded native traces", () => {
  for (const extra of [
    { url: "https://private.example/voyage" },
    { latitude: 44 },
    { csrfToken: "private" },
    { error: "private failure" },
    { listenerAcknowledged: true },
  ]) {
    expect(deviceLabAppleLifecycleTraceSchema.safeParse({ ...observedTrace, ...extra }).success).toBe(false);
    expect(
      deviceLabAppleLifecycleTraceSchema.safeParse({
        ...observedTrace,
        events: [{ ...observedTrace.events[0], ...extra }],
      }).success,
    ).toBe(false);
  }
  for (const extra of [
    { elapsedMs: 3600001 },
    { documentEpoch: 129 },
    { sequence: 0 },
    { event: "private log" },
    { instance: "stable-device-identifier" },
  ]) {
    expect(
      deviceLabAppleLifecycleTraceSchema.safeParse({
        ...observedTrace,
        events: [{ ...observedTrace.events[0], ...extra }],
      }).success,
    ).toBe(false);
  }
  expect(
    deviceLabAppleLifecycleTraceSchema.safeParse({
      ...observedTrace,
      events: Array.from({ length: 65 }, (_, index) => ({ ...observedTrace.events[0], sequence: index + 1 })),
    }).success,
  ).toBe(false);
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
