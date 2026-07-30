/* Client-independent heartbeat and cooperative cancellation loop for Phase 3. */
import process from "node:process";
import * as phase3 from "./phase3.mjs";

const args = process.argv.slice(2);
const value = (name) => args[args.indexOf(name) + 1];
const root = value("--root");
const id = value("--run");
const token = process.env.SOUNDING_LINE_CONTROLLER_TOKEN;

if (!root || !id || !token) process.exit(2);

const run = await phase3.readRun(id, root);
if (run.controller?.tokenDigest !== phase3.digest(token)) process.exit(3);
await phase3.appendRunLog(id, "DETACHED_CONTROLLER_HEARTBEAT_LOOP_ACTIVE", root);

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
