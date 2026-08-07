import { execFileSync } from "node:child_process";
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

test("Project Homeport Phase 0 inventories remain structurally valid", () => {
  const root = process.cwd();
  const output = execFileSync(
    process.execPath,
    [path.join(root, "scripts", "homeport", "validate-phase0-inventories.mjs")],
    {
      cwd: root,
      encoding: "utf8",
      env: process.env,
    },
  );

  assert.match(output, /ARTIFACT_SCHEMA_VALID/u);
  assert.match(output, /PRODUCT_NONCONFORMITIES_PRESENT/u);
});
