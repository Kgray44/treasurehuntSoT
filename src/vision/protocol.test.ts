import { describe, expect, it } from "vitest";
import {
  createVisionEnvelope,
  deserializeVisionProtocolMessage,
  serializeVisionProtocolMessage,
  visionMessageTypes,
  visionPayloadSchema,
} from "@/vision/protocol";

const id = "identifier-1234";
const error = { code: "COMPANION_UNAVAILABLE", message: "Unavailable", recoverable: true };
const capabilities = {
  nativeCapture: false,
  globalHotkeys: false,
  localInference: false,
  cloudBuild: false,
  offlinePackages: true,
  systemTray: false,
  diagnosticRetention: true,
  hardwareProviders: ["mock"],
  supportedProtocolVersions: ["1.0"],
  supportedPackageSchemaVersions: [1],
};
const payload = (type: (typeof visionMessageTypes)[number]): unknown =>
  ({
    "companion.hello": { instanceId: id, displayName: "B-1 Companion", protocolVersions: ["1.0"] },
    "companion.capabilities": capabilities,
    "companion.pair.request": { pairingId: id, allowedOrigin: "https://localhost.example", accountId: id },
    "companion.pair.approved": { pairingId: id, expiresAt: new Date(0).toISOString(), capabilities },
    "companion.pair.rejected": { pairingId: id, error },
    "companion.status": { available: false, state: "RECONNECTING", error },
    "capture.target.select.request": { requestId: id },
    "capture.target.selected": { targetId: id, label: "Mock target" },
    "capture.target.unavailable": error,
    "capture.creator.start": { recordingId: id, waypointVersionId: id, purpose: "creator" },
    "capture.creator.progress": { recordingId: id, progress: 0.5, guidanceCode: "CONTINUE" },
    "capture.creator.complete": { recordingId: id, evidenceDigest: "0123456789abcdef" },
    "capture.creator.cancel": { recordingId: id },
    "capture.creator.failed": { recordingId: id, error },
    "runtime.scan.start": { attemptId: id, storyId: id, stageId: id, waypointId: id, waypointVersionId: id },
    "runtime.scan.progress": { attemptId: id, state: "MATCHING", progress: 0.7 },
    "runtime.scan.cancel": { attemptId: id, reason: "player" },
    "runtime.scan.result": {
      attemptId: id,
      storyId: id,
      stageId: id,
      waypointVersionId: id,
      result: "VERIFIED",
      guidanceCode: "MATCH",
      evidenceDigest: "0123456789abcdef",
    },
    "runtime.scan.failed": { attemptId: id, error },
    "build.request": { buildId: id, waypointVersionId: id, executionTarget: "LOCAL" },
    "build.progress": { buildId: id, stage: "packaging", progress: 0.8 },
    "build.complete": { buildId: id, packageHash: "0123456789abcdef", artifactReference: "development://package" },
    "build.failed": { buildId: id, error },
    "vision.pause": { reason: "Captain" },
    "vision.resume": {},
    "diagnostic.bundle.request": { attemptId: id, includeRetainedEvidence: false },
    "diagnostic.bundle.available": { attemptId: id, bundleId: id, summary: { status: "safe" } },
  })[type];

describe("Vision protocol 1.0", () => {
  it("validates and round-trips every required message family", () => {
    expect(visionMessageTypes).toHaveLength(27);
    for (const messageType of visionMessageTypes) {
      const envelope = createVisionEnvelope({
        messageType,
        messageId: `${id}-message`,
        sessionId: `${id}-session`,
        sender: { type: "server", instanceId: `${id}-server` },
        payload: payload(messageType),
        timestamp: new Date(0).toISOString(),
      });
      expect(deserializeVisionProtocolMessage(serializeVisionProtocolMessage(envelope))).toEqual(envelope);
    }
  });
  it("rejects unknown fields, invalid versions, and malformed payloads", () => {
    expect(() => visionPayloadSchema("vision.resume").parse({ arbitrary: true })).toThrow();
    expect(() => deserializeVisionProtocolMessage(JSON.stringify({ protocolVersion: "9.9" }))).toThrow();
    expect(() => visionPayloadSchema("runtime.scan.result").parse({ attemptId: "short" })).toThrow();
  });
});
