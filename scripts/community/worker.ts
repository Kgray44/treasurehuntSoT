import { runCommunityWorkerOnce } from "@/community/worker";

void runCommunityWorkerOnce().then((result) => process.stdout.write(`${JSON.stringify(result)}\n`));
