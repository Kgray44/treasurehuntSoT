import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const policy = async () =>
  JSON.parse(await readFile(path.join(root, "testing", "authority-maintenance-policy.json"), "utf8"));

test("focused repair workflow is eligible and binding-preflighted authority maintenance", async () => {
  const current = await policy();
  const workflow = ".github/workflows/sounding-line-focused-repair.yml";
  assert.equal(current.eligiblePathGlobs.includes(workflow), true);
  assert.equal(current.bindingPreflightPaths.includes(workflow), true);
});

test("focused repair splits a sealed multi-engine browser selection without widening it", async () => {
  const workflow = await readFile(path.join(root, ".github", "workflows", "sounding-line-focused-repair.yml"), "utf8");
  assert.match(workflow, /FOCUSED_BROWSER_ENGINE_INVALID/u);
  assert.doesNotMatch(workflow, /FOCUSED_BROWSER_MULTI_ENGINE_UNSUPPORTED/u);
  assert.match(workflow, /focused-suite-without-browser/u);
  assert.match(workflow, /focused-suite-chromium/u);
  assert.match(workflow, /focused-suite-webkit/u);
  assert.match(workflow, /browser_engine: chromium/u);
  assert.match(workflow, /browser_engine: webkit/u);
  assert.match(workflow, /has_chromium/u);
  assert.match(workflow, /has_webkit/u);
});
