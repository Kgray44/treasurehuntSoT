import { randomUUID } from "node:crypto";
import { createDefaultCommunityWorkerHandlers, runCommunityWorker } from "@/community/worker";
import { writeCommunityWorkerRuntime } from "@/community/worker-runtime";

const workerId = process.env.COMMUNITY_WORKER_ID ?? `community-worker-${randomUUID()}`;
const startedAt = new Date().toISOString();
const controller = new AbortController();
let stopping = false;

const stop = () => {
  if (stopping) return;
  stopping = true;
  controller.abort();
};
process.once("SIGINT", stop);
process.once("SIGTERM", stop);

async function main() {
  await writeCommunityWorkerRuntime("STARTING", startedAt, false);
  const heartbeat = setInterval(() => void writeCommunityWorkerRuntime("READY", startedAt, true), 15_000);
  try {
    await writeCommunityWorkerRuntime("READY", startedAt, true);
    await runCommunityWorker({ workerId, handlers: createDefaultCommunityWorkerHandlers(), signal: controller.signal });
  } catch {
    await writeCommunityWorkerRuntime("FAILED", startedAt, false);
    process.exitCode = 1;
  } finally {
    clearInterval(heartbeat);
    if (stopping) await writeCommunityWorkerRuntime("STOPPED", startedAt, false);
  }
}

void main();
