import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRawOutputDirectory } from "../../scripts/sounding-line/experience-raw-output.mjs";
import { runShadowContextWorker } from "../../scripts/sounding-line/shadow-context-worker.mjs";
const rawDirectory = "artifacts/sounding-line/product-experience-capture-staging/capture-worker-test/raw";
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
test("shadow worker rejects corrupt and oversized private input before browser execution and suppresses private CLI errors", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "shadow-worker-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  await createRawOutputDirectory({ root, directory: rawDirectory });
  const file = path.join(root, rawDirectory, "input.json"),
    bytes = Buffer.from('{"PRIVATE_COOKIE_VALUE":"must remain private"}');
  fs.writeFileSync(file, bytes, { mode: 0o600 });
  await assert.rejects(
    runShadowContextWorker({ root, rawDirectory, inputPath: file, inputSha256: "0".repeat(64) }),
    /WORKER_UNAVAILABLE/u,
  );
  await assert.rejects(
    runShadowContextWorker({ root, rawDirectory, inputPath: file, inputSha256: hash(bytes) }),
    /WORKER_UNAVAILABLE/u,
  );
  const worker = fileURLToPath(new URL("../../scripts/sounding-line/shadow-context-worker.mjs", import.meta.url));
  const outcome = spawnSync(
    process.execPath,
    [worker, "--raw-directory", rawDirectory, "--input", file, "--input-sha256", "0".repeat(64)],
    { cwd: root, encoding: "utf8", windowsHide: true, timeout: 10000, maxBuffer: 16384 },
  );
  assert.equal(outcome.status, 1);
  assert.equal(outcome.stdout, "");
  assert.match(outcome.stderr, /SOUNDING_LINE_SHADOW_CONTEXT_WORKER_UNAVAILABLE/u);
  assert(!outcome.stderr.includes("PRIVATE_COOKIE_VALUE"));
  assert(!outcome.stderr.includes(file));
  fs.writeFileSync(file, Buffer.alloc(32769), { mode: 0o600 });
  await assert.rejects(
    runShadowContextWorker({ root, rawDirectory, inputPath: file, inputSha256: hash(bytes) }),
    /READ_FILE/u,
  );
});
