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
  ]),
});
export type DeviceLabStartupStage = z.infer<typeof deviceLabStartupStageSchema>["stage"];

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
