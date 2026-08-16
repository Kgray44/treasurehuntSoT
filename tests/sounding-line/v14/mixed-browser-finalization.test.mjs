import assert from "node:assert/strict";
import test from "node:test";
import { finalize } from "../../../scripts/sounding-line/finalizer.mjs";

const plan = {
  authority: "SOUNDING_LINE",
  sourceSha: "source",
  policyDigest: "policy",
  inventoryDigest: "inventory",
  planDigest: "plan",
  gate: "mainline",
  nodes: [
    {
      id: "browser.mixed",
      testIds: ["case-c", "case-w"],
      browserPartitions: [
        { browserEngine: "chromium", testIds: ["case-c"] },
        { browserEngine: "webkit", testIds: ["case-w"] },
      ],
    },
  ],
};

const receipt = (browserEngine, testIds) => ({
  suiteId: "browser.mixed",
  sourceSha: "source",
  policyDigest: "policy",
  inventoryDigest: "inventory",
  planDigest: "plan",
  gate: "mainline",
  cleanupState: "CLEAN",
  exitCode: 0,
  timedOut: false,
  result: "PASSED",
  browserPartition: { browserEngine, testIds },
  registeredCaseCount: testIds.length,
  discoveredCaseCount: testIds.length,
  executedCaseCount: testIds.length,
  passedCaseCount: testIds.length,
  failedCaseCount: 0,
  skippedCaseCount: 0,
});

test("complementary physical browser receipts close as the original one logical suite receipt", () => {
  const result = finalize({ plan, receipts: [receipt("chromium", ["case-c"]), receipt("webkit", ["case-w"])] });
  assert.equal(result.decision, "RELEASE_GO");
  assert.deepEqual(
    result.receipts.map((entry) => entry.suiteId),
    ["browser.mixed"],
  );
  assert.equal(result.receipts[0].registeredCaseCount, 2);
  assert.deepEqual(
    result.receipts[0].browserPartitions.map((entry) => entry.browserEngine),
    ["chromium", "webkit"],
  );
});

test("missing or duplicate physical browser partition evidence remains invalid", () => {
  const missing = finalize({ plan, receipts: [receipt("chromium", ["case-c"])] });
  assert.equal(missing.decision, "EVIDENCE_INVALID");
  const duplicate = finalize({ plan, receipts: [receipt("chromium", ["case-c"]), receipt("chromium", ["case-c"])] });
  assert.equal(duplicate.decision, "EVIDENCE_INVALID");
});

test("runtime conformance closes only when every physical browser partition is present", () => {
  const runtimePlan = { ...plan, runtimeConformanceRequired: true, authorityDigest: "authority" };
  const conformance = (browserEngine, testIds) => ({
    suiteId: "browser.mixed",
    planDigest: "plan",
    authorityDigest: "authority",
    result: "PASSED",
    browserPartition: { browserEngine, testIds },
  });
  assert.equal(
    finalize({
      plan: runtimePlan,
      receipts: [receipt("chromium", ["case-c"]), receipt("webkit", ["case-w"])],
      runtimeConformance: [conformance("chromium", ["case-c"]), conformance("webkit", ["case-w"])],
    }).decision,
    "RELEASE_GO",
  );
  assert.equal(
    finalize({
      plan: runtimePlan,
      receipts: [receipt("chromium", ["case-c"]), receipt("webkit", ["case-w"])],
      runtimeConformance: [conformance("chromium", ["case-c"])],
    }).decision,
    "EVIDENCE_INVALID",
  );
});
