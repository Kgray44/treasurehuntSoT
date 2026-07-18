import { z } from "zod";
import { verificationResultSchema } from "@/vision/domain";

export const VISION_PROTOCOL_VERSION = "1.0" as const;

export const visionMessageTypes = [
  "companion.hello",
  "companion.capabilities",
  "companion.pair.request",
  "companion.pair.approved",
  "companion.pair.rejected",
  "companion.status",
  "capture.target.select.request",
  "capture.target.selected",
  "capture.target.unavailable",
  "capture.creator.start",
  "capture.creator.progress",
  "capture.creator.complete",
  "capture.creator.cancel",
  "capture.creator.failed",
  "runtime.scan.start",
  "runtime.scan.progress",
  "runtime.scan.cancel",
  "runtime.scan.result",
  "runtime.scan.failed",
  "build.request",
  "build.progress",
  "build.complete",
  "build.failed",
  "vision.pause",
  "vision.resume",
  "diagnostic.bundle.request",
  "diagnostic.bundle.available",
] as const;

export const visionErrorCodes = [
  "COMPANION_UNAVAILABLE",
  "PAIRING_REQUIRED",
  "PAIRING_EXPIRED",
  "ORIGIN_NOT_ALLOWED",
  "CAPTURE_PERMISSION_DENIED",
  "CAPTURE_TARGET_UNAVAILABLE",
  "PACKAGE_MISSING",
  "PACKAGE_INCOMPATIBLE",
  "MODEL_UNAVAILABLE",
  "HARDWARE_UNSUPPORTED",
  "ATTEMPT_STALE",
  "STORY_STAGE_CHANGED",
  "VALIDATION_FAILED",
  "MOCK_SCENARIO_NOT_FOUND",
  "INTERNAL_ERROR",
] as const;

export type VisionMessageType = (typeof visionMessageTypes)[number];
export type VisionErrorCode = (typeof visionErrorCodes)[number];

export const visionCapabilitiesSchema = z
  .object({
    nativeCapture: z.boolean(),
    globalHotkeys: z.boolean(),
    localInference: z.boolean(),
    cloudBuild: z.boolean(),
    offlinePackages: z.boolean(),
    systemTray: z.boolean(),
    diagnosticRetention: z.boolean(),
    hardwareProviders: z.array(z.string().min(1).max(80)).max(32),
    supportedProtocolVersions: z.array(z.string().min(1).max(20)).min(1).max(16),
    supportedPackageSchemaVersions: z.array(z.number().int().positive()).min(1).max(16),
  })
  .strict();

export type VisionCapabilities = z.infer<typeof visionCapabilitiesSchema>;

const identifier = z.string().min(8).max(160);
const progress = z.number().min(0).max(1);
const errorPayload = z
  .object({ code: z.enum(visionErrorCodes), message: z.string().min(1).max(600), recoverable: z.boolean() })
  .strict();

const payloadSchemas: Record<VisionMessageType, z.ZodType> = {
  "companion.hello": z
    .object({ instanceId: identifier, displayName: z.string().min(1).max(120), protocolVersions: z.array(z.string()) })
    .strict(),
  "companion.capabilities": visionCapabilitiesSchema,
  "companion.pair.request": z
    .object({ pairingId: identifier, allowedOrigin: z.string().url(), accountId: identifier })
    .strict(),
  "companion.pair.approved": z
    .object({ pairingId: identifier, expiresAt: z.string().datetime(), capabilities: visionCapabilitiesSchema })
    .strict(),
  "companion.pair.rejected": z.object({ pairingId: identifier, error: errorPayload }).strict(),
  "companion.status": z
    .object({
      available: z.boolean(),
      state: z.enum(["READY", "PAUSED", "RECONNECTING", "INCOMPATIBLE"]),
      error: errorPayload.optional(),
    })
    .strict(),
  "capture.target.select.request": z.object({ requestId: identifier }).strict(),
  "capture.target.selected": z.object({ targetId: identifier, label: z.string().min(1).max(160) }).strict(),
  "capture.target.unavailable": errorPayload,
  "capture.creator.start": z
    .object({ recordingId: identifier, waypointVersionId: identifier, purpose: z.string().min(1).max(80) })
    .strict(),
  "capture.creator.progress": z
    .object({ recordingId: identifier, progress, guidanceCode: z.string().max(120) })
    .strict(),
  "capture.creator.complete": z
    .object({ recordingId: identifier, evidenceDigest: z.string().min(16).max(200) })
    .strict(),
  "capture.creator.cancel": z.object({ recordingId: identifier }).strict(),
  "capture.creator.failed": z.object({ recordingId: identifier, error: errorPayload }).strict(),
  "runtime.scan.start": z
    .object({
      attemptId: identifier,
      storyId: identifier,
      stageId: identifier,
      waypointId: identifier,
      waypointVersionId: identifier,
      mockScenario: z.string().min(1).max(80).optional(),
    })
    .strict(),
  "runtime.scan.progress": z
    .object({
      attemptId: identifier,
      state: z.string().min(1).max(80),
      progress,
      guidanceCode: z.string().max(120).optional(),
    })
    .strict(),
  "runtime.scan.cancel": z.object({ attemptId: identifier, reason: z.string().max(240).optional() }).strict(),
  "runtime.scan.result": z
    .object({
      attemptId: identifier,
      storyId: identifier,
      stageId: identifier,
      waypointVersionId: identifier,
      result: verificationResultSchema,
      guidanceCode: z.string().min(1).max(120),
      evidenceDigest: z.string().min(16).max(200),
    })
    .strict(),
  "runtime.scan.failed": z.object({ attemptId: identifier, error: errorPayload }).strict(),
  "build.request": z
    .object({
      buildId: identifier,
      waypointVersionId: identifier,
      executionTarget: z.enum(["LOCAL", "CLOUD_ASSISTED"]),
    })
    .strict(),
  "build.progress": z.object({ buildId: identifier, stage: z.string().min(1).max(100), progress }).strict(),
  "build.complete": z
    .object({
      buildId: identifier,
      packageHash: z.string().min(16).max(200),
      artifactReference: z.string().min(1).max(500),
    })
    .strict(),
  "build.failed": z.object({ buildId: identifier, error: errorPayload }).strict(),
  "vision.pause": z.object({ reason: z.string().max(240).optional() }).strict(),
  "vision.resume": z.object({}).strict(),
  "diagnostic.bundle.request": z
    .object({ attemptId: identifier, includeRetainedEvidence: z.boolean().default(false) })
    .strict(),
  "diagnostic.bundle.available": z
    .object({
      attemptId: identifier,
      bundleId: identifier,
      summary: z.record(z.string(), z.unknown()),
      expiresAt: z.string().datetime().optional(),
    })
    .strict(),
};

export const visionProtocolEnvelopeSchema = z
  .object({
    protocolVersion: z.literal(VISION_PROTOCOL_VERSION),
    messageType: z.enum(visionMessageTypes),
    messageId: identifier,
    requestId: identifier.optional(),
    sessionId: identifier,
    timestamp: z.string().datetime(),
    sender: z
      .object({
        type: z.enum(["web", "desktop", "companion", "vision-worker", "server"]),
        instanceId: identifier,
      })
      .strict(),
    payload: z.unknown(),
  })
  .strict();

export type VisionProtocolEnvelope = z.infer<typeof visionProtocolEnvelopeSchema>;

export function parseVisionProtocolMessage(value: unknown) {
  const envelope = visionProtocolEnvelopeSchema.parse(value);
  return { ...envelope, payload: payloadSchemas[envelope.messageType].parse(envelope.payload) };
}

export function serializeVisionProtocolMessage(value: unknown) {
  return JSON.stringify(parseVisionProtocolMessage(value));
}

export function deserializeVisionProtocolMessage(value: string) {
  return parseVisionProtocolMessage(JSON.parse(value));
}

export function createVisionEnvelope(input: {
  messageType: VisionMessageType;
  messageId: string;
  requestId?: string;
  sessionId: string;
  timestamp?: string;
  sender: VisionProtocolEnvelope["sender"];
  payload: unknown;
}) {
  return parseVisionProtocolMessage({
    protocolVersion: VISION_PROTOCOL_VERSION,
    timestamp: input.timestamp ?? new Date().toISOString(),
    ...input,
  });
}

export function visionPayloadSchema(messageType: VisionMessageType) {
  return payloadSchemas[messageType];
}
