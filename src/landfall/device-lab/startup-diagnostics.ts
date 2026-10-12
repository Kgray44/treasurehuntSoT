import { z } from "zod";

export const deviceLabStartupStageSchema = z.strictObject({
  stage: z.enum([
    "ENTRY",
    "RESTORE_LEASE",
    "LEASE_RESTORED",
    "REGISTER_WORKER",
    "WAITING_WORKER",
    "WAITING_CONTROL",
    "WORKER_CONTROLLED",
    "SCENARIO_RECEIVED",
    "PASSIVE_PERMISSION",
    "PERMISSION_READ",
    "READY_POST",
    "LIFECYCLE_BACKGROUND",
    "LIFECYCLE_FOREGROUND",
    "CONTROL_STEP_RECEIVED",
    "CONTROL_RESULT_PREPARED",
  ]),
});
export type DeviceLabStartupStage = z.infer<typeof deviceLabStartupStageSchema>["stage"];

const lifecycleCounter = z.number().int().min(0).max(128).optional();
/** Only bounded categorical delivery counters can leave the owned native app. */
export const deviceLabAppleLifecycleDeliverySchema = z.strictObject({
  foregroundNotifications: lifecycleCounter,
  backgroundNotifications: lifecycleCounter,
  sceneForegroundNotifications: lifecycleCounter,
  sceneBackgroundNotifications: lifecycleCounter,
  foregroundQueued: lifecycleCounter,
  backgroundQueued: lifecycleCounter,
  foregroundDelivered: lifecycleCounter,
  backgroundDelivered: lifecycleCounter,
  foregroundFailed: lifecycleCounter,
  backgroundFailed: lifecycleCounter,
  foregroundRejected: lifecycleCounter,
  backgroundRejected: lifecycleCounter,
  contentProcessTerminations: lifecycleCounter,
});

/** Ordered, loopback-only native observations; JavaScript dispatch is not a listener ACK. */
export const deviceLabAppleLifecycleTraceSchema = z
  .strictObject({
    version: z.literal(1),
    instance: z.string().uuid(),
    truncated: z.boolean(),
    events: z
      .array(
        z.strictObject({
          sequence: z.number().int().min(1).max(64),
          elapsedMs: z.number().int().min(0).max(3600000),
          event: z.enum([
            "APPLICATION_ACTIVE",
            "APPLICATION_BACKGROUND",
            "APPLICATION_WILL_ENTER_FOREGROUND",
            "SCENE_ACTIVE",
            "SCENE_BACKGROUND",
            "SCENE_WILL_ENTER_FOREGROUND",
            "RESUME_ACCEPTED",
            "RESUME_REFUSED",
            "FOREGROUND_QUEUED",
            "BACKGROUND_QUEUED",
            "FOREGROUND_DELIVERED",
            "BACKGROUND_DELIVERED",
            "FOREGROUND_FAILED",
            "BACKGROUND_FAILED",
            "FOREGROUND_REJECTED",
            "BACKGROUND_REJECTED",
            "DISPATCH_REFUSED",
            "DOCUMENT_STARTED",
            "DOCUMENT_COMMITTED",
            "DOCUMENT_FINISHED",
            "NAVIGATION_ALLOWED",
            "NAVIGATION_CANCELLED",
            "CONTENT_PROCESS_TERMINATED",
          ]),
          appState: z.enum(["ACTIVE", "INACTIVE", "BACKGROUND", "UNKNOWN"]),
          owningSceneState: z.enum([
            "UNATTACHED",
            "FOREGROUND_ACTIVE",
            "FOREGROUND_INACTIVE",
            "BACKGROUND",
            "UNAVAILABLE",
            "UNKNOWN",
          ]),
          foreground: z.boolean(),
          documentEpoch: z.number().int().min(0).max(128),
          notificationSceneOwned: z.boolean().optional(),
          dispatchDocumentEpoch: z.number().int().min(0).max(128).optional(),
          javascriptDispatchResult: z.boolean().optional(),
        }),
      )
      .max(64),
  })
  .superRefine((trace, context) => {
    for (let index = 0; index < trace.events.length; index += 1) {
      const event = trace.events[index];
      if (event.sequence !== index + 1 || (index > 0 && event.elapsedMs < trace.events[index - 1].elapsedMs)) {
        context.addIssue({ code: "custom", path: ["events", index], message: "Ordered native observations required" });
      }
    }
    if (trace.truncated && trace.events.length !== 64) {
      context.addIssue({ code: "custom", path: ["truncated"], message: "Truncation requires a full bounded trace" });
    }
  });

/** Diagnostic delivery cannot change readiness or retain native/session data. */
export function reportDeviceLabStartupStage(stage: DeviceLabStartupStage) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  void fetch("/lab/client-stage", {
    method: "POST",
    body: JSON.stringify(deviceLabStartupStageSchema.parse({ stage })),
    signal: controller.signal,
  })
    .catch(() => undefined)
    .finally(() => clearTimeout(timer));
}
