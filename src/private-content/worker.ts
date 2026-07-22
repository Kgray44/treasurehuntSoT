import type { PrivateJobType } from "./contracts";
import {
  cancelClaimedPrivateJob,
  claimPrivateJobs,
  finishPrivateJob,
  renewPrivateJobLease,
  retryPrivateJob,
} from "./operations";

export type PrivateDurableJob = {
  id: string;
  type: PrivateJobType;
  payload: string;
  operationId: string;
  correlationId: string;
};
export type PrivateJobHandler = (job: PrivateDurableJob, signal: AbortSignal) => Promise<void>;
export type PrivateJobHandlerRegistry = Readonly<Partial<Record<PrivateJobType, PrivateJobHandler>>>;

const privateJobTypeSet = new Set<string>([
  "PRIVATE_UPLOAD_VERIFY",
  "PRIVATE_PACKAGE_INSPECT",
  "PRIVATE_PACKAGE_NORMALIZE",
  "PRIVATE_IMPORT_MATERIALIZE",
  "PRIVATE_ASSET_SCAN",
  "PRIVATE_ASSET_FINALIZE",
  "PRIVATE_EXPORT_BUILD",
  "PRIVATE_BACKUP_BUILD",
  "PRIVATE_BACKUP_VERIFY",
  "PRIVATE_RESTORE_VERIFY",
  "PRIVATE_KEY_REWRAP",
  "PRIVATE_INTEGRITY_RECONCILE",
  "PRIVATE_STAGING_CLEANUP",
  "PRIVATE_ORPHAN_CLEANUP",
]);

function asDurableJob(job: {
  id: string;
  type: string;
  payload: string;
  operationId: string;
  correlationId: string;
}): PrivateDurableJob | undefined {
  if (!privateJobTypeSet.has(job.type)) return undefined;
  return { ...job, type: job.type as PrivateJobType };
}

/**
 * Database-lease worker. The registry keeps routing explicit and prevents request
 * code from injecting arbitrary job handlers. A lease heartbeat lets long-running
 * provider streams survive while crash recovery remains deterministic.
 */
export async function dispatchPrivateJobBatch(
  workerId: string,
  registry: PrivateJobHandlerRegistry | PrivateJobHandler,
  input: { limit?: number; leaseMs?: number; signal?: AbortSignal } = {},
) {
  const leaseMs = input.leaseMs ?? 30_000;
  const jobs = await claimPrivateJobs(workerId, input.limit ?? 10, leaseMs);
  let processed = 0;
  let cancelled = 0;
  for (const raw of jobs) {
    const job = asDurableJob(raw);
    if (!job) {
      await retryPrivateJob(raw.id, workerId, "UNKNOWN_JOB_TYPE");
      continue;
    }
    if (input.signal?.aborted) {
      await cancelClaimedPrivateJob(job.id, workerId);
      cancelled += 1;
      continue;
    }
    const handler = typeof registry === "function" ? registry : registry[job.type];
    if (!handler) {
      await retryPrivateJob(job.id, workerId, "HANDLER_NOT_CONFIGURED");
      continue;
    }
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    input.signal?.addEventListener("abort", onAbort, { once: true });
    const heartbeat = setInterval(
      () => {
        void renewPrivateJobLease(job.id, workerId, leaseMs);
      },
      Math.max(1_000, Math.floor(leaseMs / 3)),
    );
    try {
      await handler(job, controller.signal);
      if (controller.signal.aborted) {
        await cancelClaimedPrivateJob(job.id, workerId);
        cancelled += 1;
      } else if ((await finishPrivateJob(job.id, workerId)).count) {
        processed += 1;
      }
    } catch {
      if (controller.signal.aborted) {
        await cancelClaimedPrivateJob(job.id, workerId);
        cancelled += 1;
      } else {
        await retryPrivateJob(job.id, workerId, "HANDLER_FAILED");
      }
    } finally {
      clearInterval(heartbeat);
      input.signal?.removeEventListener("abort", onAbort);
    }
  }
  return { claimed: jobs.length, processed, cancelled };
}
