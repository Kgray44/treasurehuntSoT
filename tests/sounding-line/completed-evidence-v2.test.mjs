import assert from "node:assert/strict";
import test from "node:test";
import { canonicalJson, digest } from "../../scripts/sounding-line/evidence.mjs";
import {
  compactCompletedEvidenceV2,
  restoreCompletedEvidenceV2,
} from "../../scripts/sounding-line/completed-evidence-v2.mjs";
const bytes = (value) => Buffer.from(canonicalJson(value) + "\n");
function fixture(count = 4) {
  const receipts = [],
    checkpoints = new Map();
  for (let i = 0; i < count; i++) {
    const original = {
      version: "1.4",
      kind: "sounding-line-evidence-receipt",
      immutable: true,
      id: `sl14-${String(i).padStart(32, "0")}`,
      candidateSha: "b".repeat(40),
      obligationId: `unit.${i}`,
      disposition: "FRESH",
      result: "PASSED",
      fingerprint: { version: "1.4", fingerprintDigest: digest(i), payload: "original inputs ".repeat(1000) },
    };
    receipts.push({ ...original, receiptDigest: digest(original) });
    checkpoints.set(
      `checkpoint-${String(i + 1).padStart(4, "0")}.json`,
      bytes({
        version: 1,
        kind: "sounding-line-completed-obligation-checkpoint",
        authentication: "RETENTION_ONLY_NO_AUTHENTICATED_PRODUCER",
        baseSha: "a".repeat(40),
        candidateSha: "b".repeat(40),
        planDigest: digest("plan"),
        producerObservation: { authentication: "UNAUTHENTICATED_OBSERVED_METADATA", runId: "101" },
        completedWholeObligations: i + 1,
        receipts: [...receipts],
        wholeVerificationPassed: false,
        qualification: false,
      }),
    );
  }
  return checkpoints;
}
test("compact retention restores every original checkpoint byte and original receipt identity", () => {
  const original = fixture(),
    packed = compactCompletedEvidenceV2(original),
    restored = restoreCompletedEvidenceV2(packed.members);
  assert.equal(packed.qualification, false);
  assert.equal(packed.authentication, "COMPACT_RETENTION_ONLY_NO_PROVIDER_AUTHENTICATION");
  assert(packed.measurements.uniqueReceiptBytes + packed.measurements.indexBytes < packed.measurements.originalBytes);
  assert.equal(packed.members.size, 5);
  for (const [name, value] of original) assert(value.equals(restored.get(name)));
  for (const value of original.values()) value.fill(0);
  assert(
    restoreCompletedEvidenceV2(packed.members).get("checkpoint-0004.json").equals(restored.get("checkpoint-0004.json")),
  );
});
test("missing, modified, extra and wrongly referenced receipt bytes cannot reconstruct old evidence", () => {
  const packed = compactCompletedEvidenceV2(fixture()).members;
  for (const change of [
    (m) => m.delete([...m.keys()][0]),
    (m) => m.set([...m.keys()][0], Buffer.from("tampered")),
    (m) => m.set("../unexpected", Buffer.from("x")),
    (m) => m.set("receipt-" + "0".repeat(64) + ".json", Buffer.from("{}\n")),
    (m) => {
      const d = JSON.parse(m.get("manifest-v2.json"));
      d.checkpoints[1].receiptFiles.reverse();
      m.set("manifest-v2.json", bytes(d));
    },
    (m) => {
      const d = JSON.parse(m.get("manifest-v2.json"));
      d.qualification = true;
      m.set("manifest-v2.json", bytes(d));
    },
  ]) {
    const changed = new Map(packed);
    change(changed);
    assert.throws(() => restoreCompletedEvidenceV2(changed), /COMPLETED_V2_/u);
  }
});
test("forked prefixes, source changes, missing sequence and self-asserted acceptance are rejected", () => {
  for (const change of [
    (m) => m.delete("checkpoint-0001.json"),
    (m) => {
      const c = JSON.parse(m.get("checkpoint-0004.json"));
      c.receipts.reverse();
      m.set("checkpoint-0004.json", bytes(c));
    },
    (m) => {
      const c = JSON.parse(m.get("checkpoint-0004.json"));
      c.baseSha = "c".repeat(40);
      m.set("checkpoint-0004.json", bytes(c));
    },
    (m) => {
      const c = JSON.parse(m.get("checkpoint-0004.json"));
      c.wholeVerificationPassed = true;
      m.set("checkpoint-0004.json", bytes(c));
    },
    (m) => {
      const c = JSON.parse(m.get("checkpoint-0004.json"));
      c.receipts[0].durationMs = 0;
      m.set("checkpoint-0004.json", bytes(c));
    },
  ]) {
    const source = fixture();
    change(source);
    assert.throws(() => compactCompletedEvidenceV2(source), /COMPLETED_V2_/u);
  }
});
test("frames, recursive structure and declared expansion are bounded before reconstruction", () => {
  for (const receipts of [null, {}, "not an array", 1]) {
    const source = fixture(1),
      checkpoint = JSON.parse(source.get("checkpoint-0001.json"));
    checkpoint.receipts = receipts;
    source.set("checkpoint-0001.json", bytes(checkpoint));
    assert.throws(() => compactCompletedEvidenceV2(source), /COMPLETED_V2_CHECKPOINT/u);
  }
  assert.throws(
    () => compactCompletedEvidenceV2(new Map([["checkpoint-0001.json", Buffer.alloc(8 * 1024 * 1024 + 1)]])),
    /FRAME_BOUND/u,
  );
  const packed = compactCompletedEvidenceV2(fixture()).members;
  const d = JSON.parse(packed.get("manifest-v2.json"));
  d.checkpoints[0].bytes = 8 * 1024 * 1024 + 1;
  packed.set("manifest-v2.json", bytes(d));
  assert.throws(() => restoreCompletedEvidenceV2(packed), /INDEX/u);
  let nested = "x";
  for (let i = 0; i < 70; i++) nested = { nested };
  assert.throws(
    () => compactCompletedEvidenceV2(new Map([["checkpoint-0001.json", bytes(nested)]])),
    /STRUCTURE_BOUND/u,
  );
});
