import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveHistoricalTestIdentity,
  semanticTestId,
  validateRegistryIdentity,
} from "../../../scripts/sounding-line/test-identity.mjs";

const caseFor = (id, title = "protects the same contract") => ({
  id,
  semanticId: semanticTestId({ project: "chromium", suiteId: "browser.auth", file: "tests/e2e/auth.spec.ts", title }),
  historicalAliases: [],
});

test("stable semantic identity ignores harmless generated runtime representation changes", () => {
  const before = caseFor("sl-test-11111111111111111111");
  const after = caseFor("sl-test-22222222222222222222");
  assert.equal(before.semanticId, after.semanticId);
  assert.equal(resolveHistoricalTestIdentity(after.semanticId, [after]).id, after.id);
});

test("duplicate semantic identity and ambiguous historical aliases fail closed", () => {
  const left = caseFor("sl-test-11111111111111111111");
  const right = caseFor("sl-test-22222222222222222222");
  assert.throws(() => validateRegistryIdentity([left, right]), /DUPLICATE_SEMANTIC_TEST_ID/);
  right.semanticId = semanticTestId({
    project: "chromium",
    suiteId: "browser.auth",
    file: "tests/e2e/auth.spec.ts",
    title: "different contract",
  });
  left.historicalAliases = ["sl-test-33333333333333333333"];
  right.historicalAliases = ["sl-test-33333333333333333333"];
  assert.throws(() => validateRegistryIdentity([left, right]), /AMBIGUOUS_HISTORICAL_ALIAS/);
});

test("unresolved historical identities fail closed", () => {
  assert.throws(
    () => resolveHistoricalTestIdentity("sl-test-44444444444444444444", [caseFor("sl-test-11111111111111111111")]),
    /UNRESOLVED_HISTORICAL_TEST_IDENTITY/,
  );
});
