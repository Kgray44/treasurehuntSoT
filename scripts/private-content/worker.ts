import { randomUUID } from "node:crypto";
import { parsePrivateContentConfiguration } from "../../src/private-content/config";
import { createPrivateProviderRuntime, requirePrivateReadiness } from "../../src/private-content/providers";
import { dispatchPrivateJobBatch, type PrivateJobHandlerRegistry } from "../../src/private-content/worker";

const configuration = parsePrivateContentConfiguration();
const runtime = createPrivateProviderRuntime(configuration);
const controller = new AbortController();
let stopping = false;
const workerId = `private-worker-${randomUUID()}`;
const handlers: PrivateJobHandlerRegistry = {
  PRIVATE_INTEGRITY_RECONCILE: async () => undefined,
  PRIVATE_STAGING_CLEANUP: async () => undefined,
  PRIVATE_UPLOAD_CLEANUP: async () => undefined,
  PRIVATE_ORPHAN_CLEANUP: async () => undefined,
  PRIVATE_QUARANTINE_RETENTION: async () => undefined,
};
async function run() {
  await requirePrivateReadiness(runtime, "worker");
  while (!stopping) {
    await dispatchPrivateJobBatch(workerId, handlers, {
      limit: configuration.PRIVATE_CONTENT_WORKER_CONCURRENCY,
      leaseMs: configuration.PRIVATE_CONTENT_WORKER_LEASE_MS,
      signal: controller.signal,
    });
    await new Promise((resolve) => setTimeout(resolve, configuration.PRIVATE_CONTENT_WORKER_POLL_MS));
  }
}
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.once(signal, () => {
    stopping = true;
    controller.abort();
  });
void run().catch(() => {
  process.stderr.write("Private worker stopped because readiness or a durable operation failed.\n");
  process.exitCode = 1;
});
