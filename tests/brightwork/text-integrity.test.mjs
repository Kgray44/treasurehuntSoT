import assert from "node:assert/strict";
import test from "node:test";
import { findUserFacingTextIntegrityViolations } from "../../scripts/brightwork/text-integrity.mjs";

test("Brightwork text-integrity scan rejects common user-visible mojibake", () => {
  assert.deepEqual(findUserFacingTextIntegrityViolations(), []);
});
