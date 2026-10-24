#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { Lifecycle, POLICY } from "./lifecycle.mjs";

const [operation, ...args] = process.argv.slice(2);
const options = {};
for (let i = 0; i < args.length; i += 2) {
  if (!args[i].startsWith("--") || args[i + 1] === undefined) throw new Error("EXPECTED_OPTION_VALUE_PAIRS");
  if (Object.hasOwn(options, args[i].slice(2))) throw new Error("DUPLICATE_OPTION");
  options[args[i].slice(2)] = args[i + 1];
}
const state = options.state ?? path.join(os.homedir(), "AppData", "Local", "Voyagewright", "Workspaces");
const manager = new Lifecycle(state);
const list = (name) => options[name]?.split(",").filter(Boolean) ?? [];
const input = () => ({
  path: options.path,
  task: options.task,
  kind: options.kind ?? "worktree",
  branch: options.branch,
  peakBytes: Number(options["peak-bytes"] ?? (operation === "adopt" ? POLICY.workspaceBytes : NaN)),
  sparse: list("sparse"),
  generated: list("generated"),
  adoptedReason: options.reason,
  preserveRef: options["preserve-ref"],
  custodyManifest: options["custody-manifest"],
  additionalReason: options["additional-reason"],
});
try {
  let result;
  switch (operation) {
    case "init":
      result = manager.init(options.canonical, options.repository);
      break;
    case "host-bind":
      result = manager.bindHost(options["physical-root"]);
      break;
    case "create":
      result = manager.create(input());
      break;
    case "adopt":
      result = manager.adopt(input());
      break;
    case "status":
      result = manager.status();
      break;
    case "audit":
      result = options.id ? manager.auditRecord(manager.record(options.id)) : manager.inventory();
      break;
    case "finish":
      result = manager.finish(options.id, options.outcome, options.pr === undefined ? undefined : Number(options.pr));
      break;
    case "lease":
      result = manager.lease(options.id, options.pid === undefined ? undefined : Number(options.pid));
      break;
    case "retire":
      result = manager.retire(options.id);
      break;
    case "sweep":
      result = manager.sweep({ limit: options.limit ? Number(options.limit) : 4 });
      break;
    case "recover":
      result = manager.sweep({ recoverOnly: true });
      break;
    case "hook": {
      const payload = JSON.parse(fs.readFileSync(0, "utf8") || "{}");
      // Turn completion is not task success. Hooks only refresh existing leases
      // and reconcile terminal records; the owner must finish the task explicitly.
      const record = manager.db.records.find(
        (r) =>
          r.path.toLowerCase() === String(payload.cwd ?? "").toLowerCase() &&
          r.task === payload.session_id &&
          r.state === "ACTIVE",
      );
      if (record && payload.hook_event_name === "SessionStart") manager.lease(record.id);
      result = manager.sweep({ limit: 2 });
      break;
    }
    default:
      throw new Error("OPERATION_REQUIRED:create|status|audit|retire|sweep|recover|init|adopt|finish|lease|hook");
  }
  if (options.output) {
    fs.writeFileSync(options.output, `${JSON.stringify(result, null, 2)}\n`, { flag: "wx", mode: 0o600 });
    console.log(JSON.stringify({ output: options.output }));
  } else console.log(JSON.stringify(result, null, 2));
  if (result?.state === "HELD") process.exitCode = 2;
} catch (e) {
  console.error(JSON.stringify({ operation, error: e.message }));
  process.exitCode = 1;
}
