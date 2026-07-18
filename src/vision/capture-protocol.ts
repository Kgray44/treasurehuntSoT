import { z } from "zod";

export const CAPTURE_PROTOCOL_VERSION = "2.0" as const;
export const CAPTURE_CORE_VERSION = "0.4.0-b2" as const;

export const captureStates = [
  "IDLE",
  "PAIRING",
  "READY",
  "TARGET_SELECTION_REQUIRED",
  "TARGET_SELECTED",
  "STARTING",
  "CAPTURING",
  "PAUSED",
  "FINALIZING",
  "PROCESSING_CAPTURE",
  "COMPLETED",
  "CANCELLED",
  "FAILED",
  "TARGET_LOST",
] as const;

export const captureResults = [
  "EVIDENCE_CAPTURED",
  "INSUFFICIENT_CAPTURE_EVIDENCE",
  "CAPTURE_CANCELLED",
  "CAPTURE_ERROR",
] as const;

export const captureStateSchema = z.enum(captureStates);
export const captureResultSchema = z.enum(captureResults);

const identifier = z
  .string()
  .min(8)
  .max(160)
  .regex(/^[A-Za-z0-9][A-Za-z0-9:._-]*$/);

export const captureTargetSchema = z
  .object({
    targetId: z.string().regex(/^window:\d+:\d+$/),
    label: z.string().min(1).max(120),
    privacyLabel: z.string().min(1).max(180),
    likelySeaOfThieves: z.boolean(),
    dimensions: z.object({ width: z.number().int().nonnegative(), height: z.number().int().nonnegative() }).strict(),
    thumbnailDataUrl: z.string().nullable().optional(),
    applicationIconDataUrl: z.string().nullable().optional(),
    available: z.boolean(),
  })
  .strict();

export const captureCapabilitiesSchema = z
  .object({
    protocolVersion: z.literal(CAPTURE_PROTOCOL_VERSION),
    companionVersion: z.string(),
    captureCoreVersion: z.string(),
    supportedProtocolVersions: z.array(z.string()),
    supportedPackageSchemaVersions: z.array(z.number().int().positive()),
    captureApi: z.literal("ELECTRON_DESKTOP_CAPTURER"),
    nativeCapture: z.literal(true),
    applicationWindowCapture: z.literal(true),
    displayCaptureDefault: z.literal(false),
    globalHotkeys: z.boolean(),
    hotkeyHoldRelease: z.boolean(),
    creatorRecording: z.boolean(),
    playerScan: z.boolean(),
    diagnosticCapture: z.boolean(),
    diagnosticRawFrameDefault: z.literal(false),
    browserPairing: z.boolean(),
    desktopIntegrated: z.boolean(),
    systemTray: z.boolean(),
    localInference: z.literal(false),
    locationVerification: z.literal(false),
    cloudBuild: z.literal(false),
    offlineCapture: z.boolean(),
    operatingSystem: z.record(z.string(), z.unknown()),
    hardware: z.record(z.string(), z.unknown()),
    budgets: z.record(z.string(), z.unknown()),
    privacy: z.record(z.string(), z.unknown()),
    storage: z.record(z.string(), z.unknown()),
    supportedCaptureResolutions: z.record(z.string(), z.unknown()),
    supportedModes: z.array(z.string()),
    preview: z.record(z.string(), z.unknown()),
  })
  .strict();

export const captureStatusSchema = z
  .object({
    protocolVersion: z.literal(CAPTURE_PROTOCOL_VERSION),
    companionVersion: z.string(),
    state: captureStateSchema,
    mode: z.enum(["CREATOR_RECORDING", "PLAYER_SCAN", "DIAGNOSTIC"]).nullable(),
    session: z
      .object({
        sessionId: identifier,
        startedAt: z.string().datetime(),
        progress: z.number().min(0).max(1),
        frameCount: z.number().int().nonnegative(),
        droppedFrames: z.number().int().nonnegative(),
      })
      .strict()
      .nullable(),
    target: z
      .object({
        targetId: z.string().regex(/^window:\d+:\d+$/),
        privacyLabel: z.string(),
        dimensions: z.object({ width: z.number(), height: z.number() }).strict(),
        remembered: z.boolean(),
      })
      .strict()
      .nullable(),
    health: z.record(z.string(), z.unknown()),
    privacy: z
      .object({
        paused: z.boolean(),
        playerFramesMemoryOnly: z.literal(true),
        diagnosticRetentionEnabled: z.boolean(),
        captureIndicatorVisible: z.boolean(),
      })
      .strict(),
    hotkey: z.record(z.string(), z.unknown()),
    lastCompleted: z.record(z.string(), z.unknown()).nullable(),
    lastError: z.record(z.string(), z.unknown()).nullable(),
  })
  .strict();

export const captureProtocolEnvelopeSchema = z
  .object({
    protocolVersion: z.literal(CAPTURE_PROTOCOL_VERSION),
    messageType: z.enum(["capture.command", "capture.response", "capture.event", "companion.authenticate"]),
    messageId: identifier,
    requestId: identifier.optional(),
    sessionId: identifier.optional(),
    timestamp: z.string().datetime(),
    sequence: z.number().int().nonnegative(),
    payload: z.record(z.string(), z.unknown()),
  })
  .strict();

export type CaptureState = z.infer<typeof captureStateSchema>;
export type CaptureResult = z.infer<typeof captureResultSchema>;
export type CaptureTarget = z.infer<typeof captureTargetSchema>;
export type CaptureCapabilities = z.infer<typeof captureCapabilitiesSchema>;
export type CaptureStatus = z.infer<typeof captureStatusSchema>;
export type CaptureProtocolEnvelope = z.infer<typeof captureProtocolEnvelopeSchema>;

export type CreatorStartInput = {
  requestId: string;
  waypointVersionId: string;
  purpose:
    | "TARGET_REFERENCE"
    | "ACCEPTED_AREA_WALK"
    | "BOUNDARY"
    | "ENVIRONMENTAL_VARIATION"
    | "NEARBY_HARD_NEGATIVE"
    | "DISTANT_HARD_NEGATIVE"
    | "INVALID_POSE"
    | "DIAGNOSTIC_POSITIVE"
    | "DIAGNOSTIC_NEGATIVE";
  label: string;
  notes?: string;
  fieldOfView?: number;
  environmentNotes?: string;
  allowCloudUpload?: boolean;
  maxDurationMs?: number;
};

export type PlayerCaptureStartInput = {
  requestId: string;
  attemptId: string;
  durationMs?: number;
  sampleFps?: number;
  minimumFrames?: number;
};

export type CaptureCommand =
  | "capture.getCapabilities"
  | "capture.listTargets"
  | "capture.selectTarget"
  | "capture.getStatus"
  | "capture.creator.start"
  | "capture.creator.pause"
  | "capture.creator.resume"
  | "capture.creator.stop"
  | "capture.creator.cancel"
  | "capture.creator.list"
  | "capture.creator.delete"
  | "capture.creator.preview"
  | "capture.scan.start"
  | "capture.scan.stop"
  | "capture.scan.cancel"
  | "capture.privacy.pause"
  | "capture.privacy.resume"
  | "capture.hotkey.configure"
  | "capture.hotkey.disable"
  | "capture.pairing.pending"
  | "capture.pairing.approve"
  | "capture.pairing.revoke"
  | "capture.pairing.list"
  | "capture.diagnostic.create"
  | "capture.diagnostic.export";

export function createCaptureEnvelope(input: {
  messageType: CaptureProtocolEnvelope["messageType"];
  messageId?: string;
  requestId?: string;
  sessionId?: string;
  sequence: number;
  payload: Record<string, unknown>;
}) {
  return captureProtocolEnvelopeSchema.parse({
    protocolVersion: CAPTURE_PROTOCOL_VERSION,
    messageId: input.messageId ?? `message_${crypto.randomUUID()}`,
    timestamp: new Date().toISOString(),
    ...input,
  });
}
