import assert from "node:assert/strict";
import test from "node:test";
import { resolveSourceSha } from "../../scripts/shipwright/run-phase2-journeys.mjs";

const sealed = "a".repeat(40);

test("Shipwright journeys use the sealed worker source identity without Git metadata", () => {
  assert.equal(
    resolveSourceSha({ SOUNDING_LINE_SEALED_SOURCE_SHA: sealed, GITHUB_SHA: sealed }, () => {
      throw new Error("Git must not be required in the isolated worker copy.");
    }),
    sealed,
  );
});

test("Shipwright journeys reject a forged governed source identity", () => {
  assert.throws(
    () => resolveSourceSha({ SOUNDING_LINE_SEALED_SOURCE_SHA: sealed, GITHUB_SHA: "b".repeat(40) }, () => sealed),
    /SHIPWRIGHT_SEALED_SOURCE_SHA_MISMATCH/u,
  );
});

test("Shipwright journeys reject a malformed governed source identity", () => {
  assert.throws(
    () => resolveSourceSha({ SOUNDING_LINE_SEALED_SOURCE_SHA: "not-a-sha", GITHUB_SHA: "not-a-sha" }, () => sealed),
    /SHIPWRIGHT_SEALED_SOURCE_SHA_INVALID/u,
  );
});

test("Shipwright journeys retain Git-derived identity outside governed execution", () => {
  assert.equal(
    resolveSourceSha({}, () => sealed),
    sealed,
  );
});
