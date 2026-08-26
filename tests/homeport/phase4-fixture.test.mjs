import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

test("Phase 4 synthetic identities enter the ordinary workspace", () => {
  const source = readFileSync(path.join(process.cwd(), "scripts/homeport/seed-phase4-fixture.mjs"), "utf8");
  const identity = source.slice(source.indexOf("async function identity"), source.indexOf("async function listing"));

  assert.match(identity, /update:\s*\{[\s\S]*ordinaryWorkspaceEntryAt:\s*createdAt/u);
  assert.match(identity, /create:\s*\{[\s\S]*ordinaryWorkspaceEntryAt:\s*createdAt/u);
});
