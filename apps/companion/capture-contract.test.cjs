"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  assertTransition,
  captureResults,
  serializeCaptureError,
  validateCommand,
  validateEnvelope,
} = require("./capture-contract.cjs");

test("B-2 contract exposes capture-only outcomes and explicit state transitions", () => {
  assert.deepEqual(captureResults, [
    "EVIDENCE_CAPTURED",
    "INSUFFICIENT_CAPTURE_EVIDENCE",
    "CAPTURE_CANCELLED",
    "CAPTURE_ERROR",
  ]);
  assert.equal(captureResults.includes("VERIFIED"), false);
  assert.doesNotThrow(() => assertTransition("TARGET_SELECTED", "STARTING"));
  assert.throws(() => assertTransition("CAPTURING", "VERIFIED"), { name: "CaptureError", code: "INTERNAL_ERROR" });
});

test("command validation rejects unknown keys, unsafe sources, and unbounded scans", () => {
  assert.throws(() => validateCommand("capture.selectTarget", { targetId: "screen:0:0" }), {
    name: "CaptureError",
    code: "VALIDATION_FAILED",
  });
  assert.throws(
    () =>
      validateCommand("capture.scan.start", {
        requestId: "request_12345678",
        attemptId: "attempt_12345678",
        durationMs: 30_000,
        sampleFps: 10,
        minimumFrames: 6,
      }),
    { name: "CaptureError", code: "VALIDATION_FAILED" },
  );
  assert.throws(() => validateCommand("capture.getStatus", { shell: true }), { code: "VALIDATION_FAILED" });
  assert.throws(() => validateCommand("capture.selectTarget", { targetId: "window:1234:0", remember: true }), {
    code: "VALIDATION_FAILED",
  });
  assert.throws(() => validateCommand("capture.diagnostic.create", { includeFrames: true, consent: false }), {
    code: "DIAGNOSTIC_CONSENT_REQUIRED",
  });
  assert.throws(() => validateCommand("native.execute", {}), { code: "VALIDATION_FAILED" });
});

test("protocol envelopes are versioned, strict, and structured", () => {
  const envelope = {
    protocolVersion: "2.0",
    messageType: "capture.command",
    messageId: "message_12345678",
    requestId: "request_12345678",
    timestamp: new Date().toISOString(),
    sequence: 1,
    payload: { command: "capture.getStatus", input: {} },
  };
  assert.equal(validateEnvelope(envelope), envelope);
  assert.throws(() => validateEnvelope({ ...envelope, protocolVersion: "1.0" }), { code: "PROTOCOL_INCOMPATIBLE" });
  assert.throws(() => validateEnvelope({ ...envelope, secret: "not-accepted" }), { code: "VALIDATION_FAILED" });
});

test("capture errors carry actionable user guidance without raw payloads", () => {
  const error = serializeCaptureError(
    Object.assign(new Error("window vanished"), { name: "CaptureError", code: "CAPTURE_SOURCE_CLOSED" }),
  );
  assert.equal(error.code, "CAPTURE_SOURCE_CLOSED");
  assert.equal(error.reselectionRequired, true);
  assert.match(error.recommendedAction, /reselect/i);
  assert.equal("stack" in error, false);
});
