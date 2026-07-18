import { describe, expect, it } from "vitest";
import { captureProtocolEnvelopeSchema, captureResultSchema, createCaptureEnvelope } from "@/vision/capture-protocol";

describe("capture protocol 2.0", () => {
  it("allows capture-only outcomes and rejects verification decisions", () => {
    expect(captureResultSchema.parse("EVIDENCE_CAPTURED")).toBe("EVIDENCE_CAPTURED");
    expect(() => captureResultSchema.parse("VERIFIED")).toThrow();
    expect(() => captureResultSchema.parse("NOT_AT_TARGET")).toThrow();
  });

  it("creates strict versioned envelopes", () => {
    const envelope = createCaptureEnvelope({
      messageType: "capture.command",
      requestId: "request_protocol_test",
      sequence: 1,
      payload: { command: "capture.getStatus", input: {} },
    });
    expect(captureProtocolEnvelopeSchema.parse(envelope).protocolVersion).toBe("2.0");
    expect(() => captureProtocolEnvelopeSchema.parse({ ...envelope, protocolVersion: "1.0" })).toThrow();
    expect(() => captureProtocolEnvelopeSchema.parse({ ...envelope, arbitraryCommand: true })).toThrow();
  });
});
