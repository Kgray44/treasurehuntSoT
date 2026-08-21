import assert from "node:assert/strict";
import test from "node:test";
import { loadPolicy, validatePolicy } from "../../scripts/sounding-line/cli.mjs";

test("owner supporting relationships are bounded to known, distinct owners", async () => {
  const policy = await loadPolicy();
  const [owner, supportingOwner] = policy.ownership.owners;
  owner.supportingOwnerIds = [supportingOwner.id];
  assert.equal(validatePolicy(policy).ok, true);

  owner.supportingOwnerIds = [owner.id];
  assert.ok(validatePolicy(policy).errors.includes(`owner ${owner.id}: invalid supporting owner`));

  owner.supportingOwnerIds = ["unknown-owner"];
  assert.ok(validatePolicy(policy).errors.includes(`owner ${owner.id}: invalid supporting owner`));
});
