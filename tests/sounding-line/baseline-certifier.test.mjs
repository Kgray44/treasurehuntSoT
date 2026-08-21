import assert from "node:assert/strict";
import test from "node:test";
import { certifyBaseline } from "../../scripts/nightwatch/baseline-certifier.mjs";

const sha = (character) => character.repeat(40);

test("Baseline Certification collects every failure and separates AUTO_0 from owner blockers", async () => {
  const invoked = [];
  const record = await certifyBaseline({
    mainSha: sha("a"), mainTreeSha: sha("b"), now: "2026-08-21T20:00:00.000Z",
    checks: [
      { id: "registry", repairability: "AUTO_0", dependencies: ["active registry"], inspect: async () => { invoked.push("registry"); throw new Error("drift"); } },
      { id: "ownership", repairability: "OWNER", dependencies: ["ownership mapping"], inspect: async () => { invoked.push("ownership"); throw new Error("missing disposition"); } },
      { id: "policy", repairability: "OWNER", dependencies: ["policy"], inspect: async () => { invoked.push("policy"); return { valid: true }; } },
    ],
  });
  assert.deepEqual(invoked, ["registry", "ownership", "policy"]);
  assert.equal(record.status, "OWNER_REQUIRED");
  assert.equal(record.failures.length, 2);
  assert.equal(record.autoZeroRepairable.length, 1);
  assert.deepEqual(record.deterministicClosureDependencies, ["active registry", "ownership mapping"]);
});

test("Baseline Certification is exact-main/tree bound and becomes certified only when every check passes", async () => {
  const checks = [{ id: "inventory", repairability: "AUTO_0", dependencies: [], inspect: async () => ({ complete: true }) }];
  const first = await certifyBaseline({ mainSha: sha("c"), mainTreeSha: sha("d"), checks, now: "2026-08-21T20:00:00.000Z" });
  const second = await certifyBaseline({ mainSha: sha("c"), mainTreeSha: sha("e"), checks, now: "2026-08-21T20:00:00.000Z" });
  assert.equal(first.status, "CERTIFIED");
  assert.notEqual(first.certificationId, second.certificationId);
  assert.equal(first.protectedMain.treeSha, sha("d"));
});
