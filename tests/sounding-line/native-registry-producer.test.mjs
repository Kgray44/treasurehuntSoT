import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  readBoundedRegistryFile,
  sealClosedContextRegistryFiles,
} from "../../scripts/sounding-line/closed-context-registry-files.mjs";
const root = fileURLToPath(new URL("../../", import.meta.url));
test("the capture-only registry lane defaults off, is bounded and cannot change Mainline Decision", () => {
  const workflow = fs.readFileSync(path.join(root, ".github/workflows/sounding-line-ordinary.yml"), "utf8");
  const input = workflow.slice(
    workflow.indexOf("      incremental_evidence_shadow:"),
    workflow.indexOf("      evidence_ref:"),
  );
  assert.match(input, /type: boolean\s+default: false/u);
  const preparation = workflow.slice(workflow.indexOf("  experience-preparation:"), workflow.indexOf("  final-check:"));
  const start = preparation.indexOf("      - name: Seal completed-context registry after parent cleanup");
  const finish = preparation.indexOf("      - uses: actions/upload-artifact@v4", start);
  const steps = preparation.slice(start, finish);
  assert(start > preparation.indexOf("id: capture-lifecycle-artifact"));
  assert(start > preparation.indexOf("id: capture-raw-artifact"));
  assert.equal((steps.match(/inputs\.incremental_evidence_shadow == true/gu) ?? []).length, 2);
  assert.equal((steps.match(/inputs\.experience_mode == 'capture'/gu) ?? []).length, 2);
  assert.equal((steps.match(/continue-on-error: true/gu) ?? []).length, 2);
  assert.match(steps, /timeout-minutes: 2/u);
  assert.match(steps, /name: Retain encrypted v2 context registry/u);
  assert.match(steps, /if-no-files-found: error/u);
  assert(!/private.?key|contents: write|id-token: write|checks: write/iu.test(steps));
  assert.equal(
    createHash("sha256")
      .update(workflow.slice(workflow.indexOf("  mainline-decision:")))
      .digest("hex"),
    "0cbbb62e9d8c2952cc92d7e2b0a9eecb64ff235573f7e61608c29ed888df4faa",
  );
});
test("local, missing-event and injected private arguments remain unavailable and never create an output channel", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "native-registry-cli-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const output = path.join(directory, "output");
  const clean = Object.fromEntries(
    Object.entries(process.env).filter(
      ([key]) => !key.startsWith("GITHUB_") && !["GH_TOKEN", "GIT_DIR", "GIT_WORK_TREE"].includes(key),
    ),
  );
  for (const extra of [
    { GITHUB_ACTIONS: "false" },
    { GITHUB_ACTIONS: "true", GITHUB_EVENT_PATH: path.join(directory, "PRIVATE_MISSING_EVENT") },
  ]) {
    const result = spawnSync(
      process.execPath,
      [path.join(root, "scripts/sounding-line/native-registry-producer.mjs"), "--plan", "PRIVATE_UNTRUSTED_ARGUMENT"],
      {
        cwd: root,
        encoding: "utf8",
        windowsHide: true,
        timeout: 10000,
        env: { ...clean, ...extra, GITHUB_OUTPUT: output, SOUNDING_LINE_INCREMENTAL_EVIDENCE_SHADOW: "true" },
      },
    );
    assert.equal(result.status, 0);
    assert.equal(result.stderr, "");
    assert(!result.stdout.includes("PRIVATE_"));
    assert.equal(JSON.parse(result.stdout).classification, "SHADOW_CONTEXT_REGISTRY_UNAVAILABLE");
    assert.equal(JSON.parse(result.stdout).reuseAuthorized, false);
    assert(!fs.existsSync(output));
  }
});
test("bounded registry reads reject traversal, hardlinks, executable files and oversize payloads", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "native-registry-files-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const file = path.join(directory, "evidence.json"),
    original = Buffer.from('{"original":true}\n');
  fs.writeFileSync(file, original, { mode: 0o600 });
  assert(
    (await readBoundedRegistryFile({ root: directory, file: "evidence.json", maximumBytes: original.length })).equals(
      original,
    ),
  );
  for (const name of [
    "../evidence.json",
    "/evidence.json",
    "a\\evidence.json",
    "a/../evidence.json",
    "a:evidence.json",
  ])
    await assert.rejects(readBoundedRegistryFile({ root: directory, file: name, maximumBytes: 1024 }), /_PATH/u);
  await assert.rejects(
    readBoundedRegistryFile({ root: directory, file: "evidence.json", maximumBytes: original.length - 1 }),
    /OWNED_FILE/u,
  );
  await assert.rejects(
    readBoundedRegistryFile({ root: directory, file: "evidence.json", maximumBytes: 2 * 1024 * 1024 + 1 }),
    /BOUND/u,
  );
  fs.linkSync(file, path.join(directory, "alias.json"));
  await assert.rejects(
    readBoundedRegistryFile({ root: directory, file: "evidence.json", maximumBytes: 1024 }),
    /OWNED_FILE/u,
  );
});
test("held owner scope cannot enter registry file inspection", async () => {
  for (const prNumber of [721, 776, 805])
    await assert.rejects(
      sealClosedContextRegistryFiles({ root: "NO_FILESYSTEM_ACCESS", plan: { prNumber } }),
      /SHADOW_CONTEXT_SCOPE/u,
    );
});
