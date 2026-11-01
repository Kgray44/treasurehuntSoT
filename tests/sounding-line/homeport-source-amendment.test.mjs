import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  resolveHomeportSourceAmendment,
  validateHomeportAmendedRegistration,
} from "../../scripts/sounding-line/homeport-source-amendment.mjs";
const directory = new URL(
  "../../Development_Docs/Engineering/sc00a-homeport-journey-migration-20261031/",
  import.meta.url,
);
const read = (file) => JSON.parse(readFileSync(new URL(file, directory)));
const original = read("original-grant-record.json"),
  amendment = read("source-amendment-20261101/source-amendment.json");
const registry = read("approved-registration.json"),
  reviewed = read("source-amendment-20261101/reviewed-registration.json");
const digest = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
test("source amendment preserves the original finite grant and every unaffected obligation", () => {
  const before = JSON.stringify(original),
    record = resolveHomeportSourceAmendment(original, amendment);
  assert.equal(digest(original), "a816a0a7d804594f5f2d29960be6be3497c73b6edd48317d6552309ec4cbf236");
  assert.equal(JSON.stringify(original), before);
  assert.equal(resolveHomeportSourceAmendment(original, undefined), original);
  assert.equal(record.prNumber, 820);
  assert.equal(record.expiresAt, "2026-11-14T23:59:59Z");
  assert.equal(record.reviewedAncestor, "7281ef3cc419ed7457b212b3a4a4f56cf0f2efbc");
  assert.equal(record.reviewedTree, "88d40031c2fe95dac46236f4218f45656d09d11e");
  const changed = new Set([
    "acceptedSource",
    "reviewedAncestor",
    "reviewedTree",
    "approvedChanges",
    "browserFixtureAndVisualPins",
    "immutableProofs",
  ]);
  for (const key of Object.keys(original)) if (!changed.has(key)) assert.deepEqual(record[key], original[key], key);
  assert.equal(record.approvedChanges.length, 21);
  assert.equal(record.browserFixtureAndVisualPins.length, 10);
  const paths = new Set(amendment.replacements.map((value) => value.path));
  for (const entry of original.approvedChanges)
    if (!paths.has(entry.path) && entry.path !== "testing/contracts.json")
      assert.deepEqual(
        record.approvedChanges.find((value) => value.path === entry.path),
        entry,
      );
  for (const pin of original.browserFixtureAndVisualPins)
    if (!paths.has(pin.path))
      assert.deepEqual(
        record.browserFixtureAndVisualPins.find((value) => value.path === pin.path),
        pin,
      );
  assert.deepEqual(record.immutableProofs[0], original.immutableProofs[0]);
  assert.deepEqual(record.immutableProofs[2], original.immutableProofs[2]);
  assert.doesNotThrow(() => validateHomeportAmendedRegistration(registry, reviewed, amendment));
  for (const proof of original.immutableProofs) {
    const bytes = readFileSync(new URL("../../" + proof.path, import.meta.url));
    assert.equal(bytes.length, proof.bytes);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), proof.sha256);
  }
});
test("changed expiry, PR, source closure, evidence tail, modes, pins and replacement scope are denied", () => {
  for (const change of [
    (a) => (a.prNumber = 821),
    (a) => (a.expiresAt = "2026-12-01T00:00:00Z"),
    (a) => (a.originalRecordDigest = "0".repeat(64)),
    (a) => (a.reviewedAncestor = "0".repeat(40)),
    (a) => (a.acceptedSource = "0".repeat(40)),
    (a) => (a.reviewedTree = "0".repeat(40)),
    (a) => (a.replacements[0].mode = "120000"),
    (a) => (a.replacements[0].previousBlob = "0".repeat(40)),
    (a) => (a.replacements[0].path = "src/components/studio/ChronicleAuthoring.module.css"),
    (a) => a.replacements.push(a.replacements[0]),
    (a) => (a.registrationProof.path = "../unbounded.json"),
    (a) => (a.registrationProof.blob = "0".repeat(40)),
    (a) => (a.publicationRoot = "Development_Docs/"),
    (a) => (a.reviewOrdinal = 1),
  ]) {
    const altered = structuredClone(amendment);
    change(altered);
    assert.throws(() => resolveHomeportSourceAmendment(original, altered), /SOURCE_AMENDMENT_INVALID/u);
  }
  for (const value of [null, {}, [], "invalid"])
    assert.throws(() => resolveHomeportSourceAmendment(original, value), /SOURCE_AMENDMENT_INVALID/u);
  const old = structuredClone(original);
  old.publicationRoot = "Development_Docs/";
  assert.throws(() => resolveHomeportSourceAmendment(old, amendment), /SOURCE_AMENDMENT_INVALID/u);
});
test("registration proof permits inherited authority without changing any approved contract or journey", () => {
  for (const change of [
    (r) => r.contracts.pop(),
    (r) => (r.contracts[0].id = "changed"),
    (r) => (r.experiencePolicy.version = 999),
    (r) => (r.unapprovedRootField = true),
  ]) {
    const altered = structuredClone(reviewed);
    change(altered);
    assert.throws(() => validateHomeportAmendedRegistration(registry, altered, amendment), /SOURCE_AMENDMENT_INVALID/u);
  }
});
