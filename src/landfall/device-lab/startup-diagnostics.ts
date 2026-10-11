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
