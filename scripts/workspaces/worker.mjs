import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";
const root = path.dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8").replace(/^\uFEFF/u, ""));
for (const entry of manifest) {
  if (!["lifecycle.mjs", "cli.mjs", "hook.mjs", "worker.mjs", "host-path.json"].includes(entry.name))
    throw new Error("INVALID_INSTALLED_SOURCE");
  const bytes = fs.readFileSync(path.join(root, entry.name));
  if (createHash("sha256").update(bytes).digest("hex") !== entry.sha256) throw new Error("INSTALLED_SOURCE_CHANGED");
}
const hostConfig = JSON.parse(fs.readFileSync(path.join(root, "host-path.json"), "utf8").replace(/^\uFEFF/u, ""));
process.env.PATH = [...hostConfig.paths, process.env.PATH ?? ""].join(path.delimiter);
process.env.VOYAGEWRIGHT_RESERVE_GUARD = hostConfig.reserveGuard;
const cli = path.join(root, "cli.mjs");
const state = process.argv[2];
const observations = [];
const originalError = console.error;
console.error = (...args) => {
  observations.push(args.map(String).join(" ").slice(0, 32768));
  originalError(...args);
};
process.argv = [process.execPath, cli, "sweep", "--state", state, "--limit", "4"];
try {
  await import(pathToFileURL(cli).href);
} catch (e) {
  console.error(e.stack);
  process.exitCode = 1;
} finally {
  try {
    const { reserve } = await import(pathToFileURL(path.join(root, "lifecycle.mjs")).href);
    reserve({ C: 65536, D: 0 });
    const out = path.join(state, "worker-runs");
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(
      path.join(out, `${randomUUID()}.json`),
      JSON.stringify({ at: new Date().toISOString(), result: process.exitCode ?? 0, source: root, observations }),
      { flag: "wx", mode: 0o600 },
    );
  } catch (e) {
    // Keep the original reconciliation outcome and expose retention failure.
    originalError(`WORKSPACE_WORKER_LOG_FAILED:${e.message}`);
  }
}
