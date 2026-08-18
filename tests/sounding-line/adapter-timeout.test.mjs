import assert from "node:assert/strict";
import path from "node:path";
import process from "node:process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { executeAdapter } from "../../scripts/sounding-line/adapters.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

test("adapter timeout seals a receipt even when its command retains descendants", async () => {
  const startedAt = Date.now();
  const result = await executeAdapter(
    { command: [process.execPath, "-e", "setInterval(() => {}, 1000)"] },
    { cwd: root, timeoutMs: 150 },
  );

  assert.equal(result.timedOut, true);
  assert.equal(result.exitCode, 124);
  assert.ok(Date.now() - startedAt < 5_000, "timeout receipt must not wait for the hosted-worker deadline");
});
