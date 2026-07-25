import type { PrivateJobType } from "./contracts";
import { privateFailure } from "./core";
import type { PrivateProviderRuntime } from "./providers";
import type { PrivateDurableJob, PrivateJobHandlerRegistry } from "./worker";
import { PrivateOperationalMetrics, type DeterministicPrivateAlertSink } from "./observability";

const allTypes: readonly PrivateJobType[] = [
  "PRIVATE_UPLOAD_VERIFY",
  "PRIVATE_PACKAGE_INSPECT",
  "PRIVATE_PACKAGE_NORMALIZE",
  "PRIVATE_IMPORT_MATERIALIZE",
  "PRIVATE_ASSET_VALIDATE",
  "PRIVATE_ASSET_SCAN",
  "PRIVATE_ASSET_FINALIZE",
  "PRIVATE_EXPORT_BUILD",
  "PRIVATE_BACKUP_BUILD",
  "PRIVATE_BACKUP_VERIFY",
  "PRIVATE_RESTORE_VERIFY",
  "PRIVATE_KEY_REWRAP",
  "PRIVATE_INTEGRITY_RECONCILE",
  "PRIVATE_STAGING_CLEANUP",
  "PRIVATE_UPLOAD_CLEANUP",
  "PRIVATE_ORPHAN_CLEANUP",
  "PRIVATE_QUARANTINE_RETENTION",
];
export type PrivateHandlerExecutor = (
  type: PrivateJobType,
  job: PrivateDurableJob,
  signal: AbortSignal,
) => Promise<void>;
function validate(job: PrivateDurableJob) {
  try {
    const payload = JSON.parse(job.payload) as { schemaVersion?: number; aggregateId?: string; correlationId?: string };
    if (
      payload.schemaVersion !== 1 ||
      typeof payload.aggregateId !== "string" ||
      typeof payload.correlationId !== "string"
    )
      throw new Error("payload");
  } catch {
    throw privateFailure("PRIVATE_CONTENT_CONFIGURATION_INVALID", "Private worker payload is invalid.");
  }
}
/** Every declared durable type has a handler. Without a composed executor it rejects fail-closed rather than silently completing. */
export function createPrivateOperationalHandlerRegistry(input: {
  runtime: PrivateProviderRuntime;
  execute?: Partial<Record<PrivateJobType, PrivateHandlerExecutor>>;
  metrics?: PrivateOperationalMetrics;
  alerts?: DeterministicPrivateAlertSink;
}): PrivateJobHandlerRegistry {
  return Object.fromEntries(
    allTypes.map((type) => [
      type,
      async (job: PrivateDurableJob, signal: AbortSignal) => {
        validate(job);
        if (signal.aborted)
          throw privateFailure("PRIVATE_CONTENT_FORBIDDEN", "Private worker operation was cancelled.");
        const executor = input.execute?.[type];
        if (!executor) {
          input.metrics?.increment("private_worker_rejected_total", { job_type: type, reason: "HANDLER_NOT_COMPOSED" });
          input.alerts?.emit("PRIVATE_HANDLER_NOT_COMPOSED", "WARNING", { job_type: type });
          throw privateFailure("PRIVATE_CONTENT_CONFIGURATION_INVALID", "Private worker handler is not composed.");
        }
        await executor(type, job, signal);
        input.metrics?.increment("private_worker_completed_total", { job_type: type });
      },
    ]),
  ) as PrivateJobHandlerRegistry;
}
export { allTypes as privateOperationalJobTypes };
