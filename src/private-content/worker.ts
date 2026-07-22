import { claimPrivateJobs, finishPrivateJob, retryPrivateJob } from "./operations";

export type PrivateJobHandler = (job: {
  id: string;
  type: string;
  payload: string;
  operationId: string;
  correlationId: string;
}) => Promise<void>;

/** Durable database-lease executor. Production hosts run this outside request processes. */
export async function dispatchPrivateJobBatch(workerId: string, handler: PrivateJobHandler, limit = 10) {
  const jobs = await claimPrivateJobs(workerId, limit);
  let processed = 0;
  for (const job of jobs) {
    try {
      await handler(job);
      if ((await finishPrivateJob(job.id, workerId)).count) processed += 1;
    } catch {
      await retryPrivateJob(job.id, workerId, "HANDLER_FAILED");
    }
  }
  return { claimed: jobs.length, processed };
}
