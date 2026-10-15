// NCL-01 synthetic laptop preview. Run preparation and certificate checks first.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";

assert.equal(process.platform, "win32", "NCL01_WINDOWS_PREVIEW_REQUIRED");
assert.equal(process.argv.length, 2, "NCL01_ARGUMENT_REJECTED");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const taskRoot = "D:/CodexTemp/ncl01-preview";
const origin = "https://155.42.98.160:8449";
// The canonical helper verifies ownership and Windows DACLs before secret reads.
execFileSync(
  process.execPath,
  [path.join(root, "node_modules/tsx/dist/cli.mjs"), "scripts/parallax/ncl01-preview.ts", "status", origin],
  { cwd: root, stdio: "pipe", windowsHide: true, timeout: 30000 },
);
execFileSync(process.execPath, [path.join(root, ".agents/scripts/ncl01-local-https.mjs"), "--check"], {
  cwd: root,
  stdio: "pipe",
  windowsHide: true,
  timeout: 30000,
});
const environment = JSON.parse(fs.readFileSync(path.join(taskRoot, "runtime-env.private.json"), "utf8"));
assert.match(
  environment.DATABASE_URL,
  /^file:D:\/CodexTemp\/ncl01-preview\/artifacts\/sounding-line\/[^\r\n]+\.db$/,
  "NCL01_DATABASE_OWNERSHIP_REQUIRED",
);
const next = path.join(root, "node_modules/next/dist/bin/next");
assert.ok(fs.realpathSync(next).startsWith(root + path.sep), "NCL01_NEXT_REQUIRES_PHYSICAL_WORKTREE_DEPENDENCIES");
const env = {
  ...process.env,
  ...environment,
  TEMP: "D:/CodexTemp",
  TMP: "D:/CodexTemp",
  NEXT_DIST_DIR: "artifacts/ncl01-preview-next-local",
  HOMEPORT_PUBLIC_APP_ORIGIN: origin,
  NEXT_PUBLIC_APP_URL: origin,
  HOMEPORT_ALLOWED_DEV_ORIGINS: "155.42.98.160",
  NODE_ENV: "development",
  SEALED_HOLD_SINGLE_FORK: "1",
};
const recordPath = path.join(taskRoot, "next-process.private.json");
const instanceId = randomUUID();
if (fs.existsSync(recordPath)) {
  const old = JSON.parse(fs.readFileSync(recordPath, "utf8"));
  assert.ok(
    old.task === "NCL01" &&
      old.root === root &&
      old.port === 3149 &&
      Number.isSafeInteger(old.parentPid) &&
      old.parentPid > 0 &&
      (old.childPid === null || (Number.isSafeInteger(old.childPid) && old.childPid > 0)),
    "NCL01_EXISTING_PROCESS_RECORD_UNOWNED",
  );
  for (const pid of [old.parentPid, old.childPid].filter(Boolean)) {
    let alive = true;
    try {
      process.kill(pid, 0);
    } catch (error) {
      if (error.code === "ESRCH") alive = false;
    }
    assert.equal(alive, false, "NCL01_PREVIEW_ALREADY_RUNNING_OR_PID_UNCERTAIN");
  }
  fs.unlinkSync(recordPath);
}
const record = {
  task: "NCL01",
  instanceId,
  parentPid: process.pid,
  childPid: null,
  root,
  port: 3149,
  script: fileURLToPath(import.meta.url),
  startedAt: new Date().toISOString(),
};
fs.writeFileSync(recordPath, JSON.stringify(record, null, 2) + "\n", { flag: "wx" });
const removeOwnRecord = () => {
  try {
    const current = JSON.parse(fs.readFileSync(recordPath, "utf8"));
    if (current.instanceId === instanceId && current.parentPid === process.pid) fs.unlinkSync(recordPath);
  } catch {}
};
const child = spawn(process.execPath, [next, "dev", "--webpack", "--hostname", "127.0.0.1", "--port", "3149"], {
  cwd: root,
  env,
  stdio: "inherit",
  windowsHide: true,
});
fs.writeFileSync(recordPath, JSON.stringify({ ...record, childPid: child.pid ?? null }, null, 2) + "\n");
process.once("SIGINT", () => child.kill("SIGINT"));
process.once("SIGTERM", () => child.kill("SIGTERM"));
child.once("error", () => {
  removeOwnRecord();
  process.stderr.write("NCL01_NEXT_START_FAILED\n");
  process.exitCode = 1;
});
child.once("exit", (code) => {
  removeOwnRecord();
  process.exitCode = code ?? 1;
});
