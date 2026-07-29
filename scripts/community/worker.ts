import { createDefaultCommunityWorkerHandlers, runCommunityWorkerOnce } from "@/community/worker";

void runCommunityWorkerOnce(undefined, createDefaultCommunityWorkerHandlers()).then((result) =>
  process.stdout.write(`${JSON.stringify(result)}\n`),
);
