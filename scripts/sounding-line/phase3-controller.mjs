/* Client-independent heartbeat and cooperative cancellation loop for Phase 3. */
import process from "node:process";
import path from "node:path";
import * as phase3 from "./phase3.mjs";
import * as phase2Runtime from "./runtime.mjs";
import { resolveAdapter } from "./adapters.mjs";

const args = process.argv.slice(2);
const value = (name) => args[args.indexOf(name) + 1];
const root = value("--root");
const id = value("--run");
const token = process.env.SOUNDING_LINE_CONTROLLER_TOKEN;
const permittedAdapters = new Set([
  "policy",
  "inventory",
  "docs",
  "architecture",
  "language",
  "privacy",
  "sqlite-validate",
  "mysql-validate",
]);

if (!root || !id || !token) process.exit(2);

const run = await phase3.readRun(id, root);
if (run.controller?.tokenDigest !== phase3.digest(token)) process.exit(3);
await phase3.appendRunLog(id, "DETACHED_CONTROLLER_HEARTBEAT_LOOP_ACTIVE", root);

async function executeGovernedAdapter(current) {
  const execution = current.execution;
  if (!execution) return false;
  if (!permittedAdapters.has(execution.adapterId)) throw new Error("UNSAFE_CONTROLLER_ADAPTER");
  if (typeof execution.repositoryRoot !== "string" || !path.isAbsolute(execution.repositoryRoot))
    throw new Error("UNSAFE_CONTROLLER_REPOSITORY_ROOT");
  if (typeof execution.runtimeBase !== "string" || !path.isAbsolute(execution.runtimeBase))
    throw new Error("UNSAFE_CONTROLLER_RUNTIME_BASE");
  if (typeof execution.sourceDigest !== "string" || !/^[a-f0-9]{64}$/u.test(execution.sourceDigest))
    throw new Error("UNSAFE_CONTROLLER_SOURCE_DIGEST");
  const adapter = resolveAdapter(execution.adapterId);
  const unsignedPlan = {
    nonAuthoritative: true,
    execution: "governed-local",
    policyDigest: current.policyDigest,
    sourceDigest: execution.sourceDigest,
    selected: [{ suiteId: adapter.id }],
    graph: [{ suiteId: adapter.id, dependsOn: [] }],
  };
  const plan = { ...unsignedPlan, digest: phase2Runtime.digest(unsignedPlan) };
  const phase2Run = await phase2Runtime.createRuntime({
    base: execution.runtimeBase,
    repositoryRoot: execution.repositoryRoot,
    plan,
    identity: { policyDigest: current.policyDigest, sourceDigest: execution.sourceDigest },
  });
  await phase3.updateRun(
    id,
    { phase2Runtime: { id: phase2Run.id, root: phase2Run.root }, executionStartedAt: new Date().toISOString() },
    root,
  );
  await phase3.appendRunLog(id, `GOVERNED_ADAPTER_STARTED_${adapter.id}`, root);
  let result;
  try {
    result = await phase2Runtime.executeProductAdapter(phase2Run, adapter, { cwd: execution.repositoryRoot });
  } finally {
    await phase2Runtime.cleanupRuntime(phase2Run, "phase3-controller-terminal");
  }
  await phase3.updateRun(
    id,
    {
      executionOutcome: result.status,
      executionFinishedAt: new Date().toISOString(),
      executionReceiptDigest: phase3.digest({ adapter: adapter.id, status: result.status, exitCode: result.exitCode }),
    },
    root,
  );
  await phase3.appendRunLog(id, `GOVERNED_ADAPTER_FINISHED_${adapter.id}_${result.status}`, root);
  await phase3.completeRun(id, "CLEAN", root);
  return true;
}

try {
  if (await executeGovernedAdapter(run)) process.exit(0);
} catch (error) {
  await phase3.updateRun(
    id,
    { state: "QUARANTINED", cleanup: "UNKNOWN", controllerFailure: String(error?.message ?? error) },
    root,
  );
  await phase3.appendRunLog(id, "GOVERNED_ADAPTER_CONTROLLER_FAILURE", root);
  process.exit(5);
}

const interval = setInterval(async () => {
  try {
    const current = await phase3.readRun(id, root);
    if (current.state === "CANCEL_REQUESTED") {
      await phase3.completeRun(id, "CLEAN", root);
      await phase3.appendRunLog(id, "DETACHED_CONTROLLER_CANCELLED_CLEAN", root);
      clearInterval(interval);
      process.exit(0);
    }
    if (current.state !== "RUNNING") {
      clearInterval(interval);
      process.exit(0);
    }
    await phase3.updateRun(id, { controllerHeartbeatAt: new Date().toISOString() }, root);
  } catch {
    clearInterval(interval);
    process.exit(4);
  }
}, 250);
