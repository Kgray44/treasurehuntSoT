import process from "node:process";
import { NightwatchController } from "../../src/nightwatch/controller";
import { GitHubCliControlPlane } from "../../src/nightwatch/github-control-plane";
import { NightwatchLedger, resolveNightwatchDatabase } from "../../src/nightwatch/runtime";

const args = new Set(process.argv.slice(2));
const once = args.has("--once");
const repository = process.env.NIGHTWATCH_REPOSITORY;
if (!repository || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(repository))
  throw new Error("NIGHTWATCH_REPOSITORY_REQUIRED");
const intervalMs = Number(process.env.NIGHTWATCH_INTERVAL_MS ?? 15_000);
if (!Number.isSafeInteger(intervalMs) || intervalMs < 5_000 || intervalMs > 300_000)
  throw new Error("NIGHTWATCH_INTERVAL_INVALID");
const databasePath = resolveNightwatchDatabase(process.cwd());
const ledger = new NightwatchLedger(databasePath, { repositoryRoot: process.cwd() });
const controller = new NightwatchController(
  ledger,
  new GitHubCliControlPlane(repository, process.env.NIGHTWATCH_DEFAULT_BRANCH ?? "main"),
  { instanceId: process.env.NIGHTWATCH_INSTANCE_ID },
);

let stopping = false;
const stop = (detail: string) => {
  if (stopping) return;
  stopping = true;
  try {
    controller.stop(detail);
  } finally {
    ledger.close();
  }
};

process.once("SIGINT", () => stop("SIGINT controlled shutdown."));
process.once("SIGTERM", () => stop("SIGTERM controlled shutdown."));

controller.start();
const tick = () => {
  if (stopping) return;
  try {
    console.log(JSON.stringify(controller.tick()));
  } catch (error) {
    console.error(error instanceof Error ? error.message : "NIGHTWATCH_CONTROLLER_FAILURE");
  }
};
tick();
if (once) stop("One-shot controlled shutdown.");
else setInterval(tick, intervalMs);
