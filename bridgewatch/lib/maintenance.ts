import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { loadConfig } from "../src/config.js";
import { BridgewatchStore } from "./store.js";

const command = process.argv[2] ?? "inspect";
const apply = process.argv.includes("--apply");
const targetFlag = process.argv.indexOf("--target");
const target = targetFlag >= 0 ? process.argv[targetFlag + 1] : undefined;
const config = loadConfig();
const store = new BridgewatchStore(config.dbPath);

try {
  if (command === "inspect" || command === "prune") {
    const result = store.pruneHistory({
      eventRetentionDays: config.BRIDGEWATCH_EVENT_RETENTION_DAYS,
      rollupRetentionDays: config.BRIDGEWATCH_ROLLUP_RETENTION_DAYS,
      dryRun: command === "inspect" || !apply,
      compact: apply && process.argv.includes("--compact"),
    });
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } else if (command === "backup") {
    if (!target) throw new Error("Bridgewatch backup requires --target <task-owned-or-operator-owned path>");
    const resolved = resolve(target);
    mkdirSync(dirname(resolved), { recursive: true });
    await store.backupTo(resolved);
    process.stdout.write(`${JSON.stringify({ backup: resolved, integrity: store.integrityCheck() })}\n`);
  } else {
    throw new Error("Bridgewatch maintenance command must be inspect, prune, or backup");
  }
} finally {
  store.close();
}
