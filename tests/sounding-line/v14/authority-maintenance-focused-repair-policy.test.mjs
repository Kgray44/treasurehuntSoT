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
