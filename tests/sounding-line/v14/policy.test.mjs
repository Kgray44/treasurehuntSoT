import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const policy = async (name) => JSON.parse(await readFile(path.join(root, "testing", name), "utf8"));

test("v1.4 fingerprint, prepared-artifact, and train policies declare the ratified fail-closed boundaries", async () => {
  const [fingerprint, artifacts, train] = await Promise.all([
    policy("evidence-fingerprint-policy.json"),
    policy("prepared-artifacts.json"),
    policy("mainline-train-policy.json"),
  ]);
  assert.equal(fingerprint.version, "1.4");
  assert.deepEqual(fingerprint.closureConfidence.preservationEligible, ["EXACT", "BOUNDED"]);
  assert.ok(fingerprint.closureConfidence.conservativeExpansionRequired.includes("UNKNOWN"));
  assert.equal(artifacts.consumerPolicy.corruptionAction, "REJECT");
  assert.equal(artifacts.consumerPolicy.cacheMissAction, "NORMAL_GOVERNED_PREPARATION");
  assert.deepEqual(
    artifacts.layers.map((layer) => layer.id),
    ["dependency", "prisma-client", "browser-chromium", "browser-webkit", "sqlite-baseline"],
  );
  assert.ok(artifacts.runOwnedExclusions.includes("database"));
  assert.equal(train.physicalLanding.headCarOnly, true);
  assert.equal(train.physicalLanding.predictedActualTreeEqualityRequired, true);
  assert.equal(train.emergency.reusesStaleEvidence, false);
});
