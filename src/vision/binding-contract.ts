import type { PublishedBlock } from "@/tall-tale/types";
import { waypointRuntimeModeSchema } from "@/vision/domain";

function objectValue(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export function publishedVisionBindingConfiguration(block: PublishedBlock) {
  const configuration = block.configuration;
  return {
    runtimeMode: waypointRuntimeModeSchema.parse(configuration.runtimeMode ?? "DEVELOPMENT_MOCK"),
    scanInteraction: {
      mode: configuration.scanMode === "TOGGLE" ? ("TOGGLE" as const) : ("HOLD" as const),
      holdDurationMs: Math.min(Math.max(Number(configuration.holdDurationMs ?? 5_000), 250), 15_000),
      progressAnnouncementIntervalMs: Math.min(
        Math.max(Number(configuration.progressAnnouncementIntervalMs ?? 1_000), 250),
        5_000,
      ),
    },
    scanConfiguration: {
      durationMs: Math.min(Math.max(Number(configuration.captureDurationMs ?? 5_000), 3_000), 8_000),
      sampleFps: Math.min(Math.max(Number(configuration.sampleFps ?? 10), 8), 12),
      minimumFrames: Math.min(Math.max(Number(configuration.minimumFrames ?? 6), 3), 15),
    },
    successEvent: String(configuration.successEvent ?? "vision.verification_succeeded"),
    guidanceConfiguration: {
      INSUFFICIENT_VISUAL_EVIDENCE: configuration.insufficientMessage,
      AMBIGUOUS: configuration.ambiguousMessage,
      NOT_AT_TARGET: configuration.notAtTargetMessage,
      SYSTEM_ERROR: configuration.systemErrorMessage,
    },
    captainFallbackPolicy: {
      enabled: Boolean(configuration.captainFallbackEnabled ?? true),
      allowManualApprove: Boolean(configuration.allowCaptainManualApprove ?? true),
      allowManualReject: Boolean(configuration.allowCaptainManualReject ?? true),
      requireReason: true,
    },
    offlineBehavior: String(configuration.offlineBehavior ?? "CAPTAIN_FALLBACK"),
    assignmentPolicy: objectValue(configuration.assignmentPolicy),
    accessibilityPolicy: objectValue(configuration.accessibilityPolicy),
  };
}

export function publishedVisionBindingKey(input: {
  publishedVersionId: string;
  storyId: string;
  stageId: string;
  waypointId: string;
  waypointVersionId: string;
  configuration: ReturnType<typeof publishedVisionBindingConfiguration>;
}) {
  return {
    publishedVersionId: input.publishedVersionId,
    storyId: input.storyId,
    stageId: input.stageId,
    waypointId: input.waypointId,
    waypointVersionId: input.waypointVersionId,
    ...input.configuration,
  };
}
