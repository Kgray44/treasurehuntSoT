import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { verificationResultSchema, waypointRuntimeModeSchema, type VerificationResult } from "@/vision/domain";

const identifier = z
  .string()
  .min(8)
  .max(200)
  .regex(/^[A-Za-z0-9][A-Za-z0-9:._-]*$/);
const sha256 = z.string().regex(/^(sha256:)?[a-f0-9]{64}$/);
const jsonObject = z.record(z.string(), z.unknown());

export const captainVisionActions = [
  "APPROVE",
  "REJECT",
  "REQUEST_RESCAN",
  "MANUAL_OVERRIDE",
  "LABEL_TRUTH",
  "PAUSE_AUTOMATIC",
  "DEMOTE_TO_CAPTAIN_CONFIRMED",
  "PROMOTE_TO_CAPTAIN_CONFIRMED",
  "PROMOTE_TO_AUTOMATIC",
] as const;
export const captainTruthLabels = [
  "TRUE_POSITIVE",
  "FALSE_POSITIVE",
  "TRUE_NEGATIVE",
  "FALSE_NEGATIVE",
  "INSUFFICIENT",
  "AMBIGUOUS",
  "UNREVIEWABLE",
] as const;

export const createRuntimeAttemptSchema = z
  .object({
    sessionId: identifier,
    blockId: identifier,
    waypointVersionId: identifier,
    platform: z.enum(["WEB", "PWA", "DESKTOP"]),
    adapterType: z.enum(["WEB_COMPANION", "DESKTOP"]),
    companionInstanceId: identifier,
  })
  .strict();

export const runtimeResultSchema = z
  .object({
    attemptId: identifier,
    stageToken: identifier,
    waypointId: identifier,
    waypointVersionId: identifier,
    packageId: identifier,
    packageHash: sha256,
    companionInstanceId: identifier,
    result: verificationResultSchema.exclude(["STALE"]),
    guidanceCode: z.string().min(1).max(120),
    failedGates: z.array(z.string().min(1).max(120)).max(30),
    evidenceDigest: sha256.nullable(),
    engineVersion: z.string().min(1).max(120),
    modelBundleVersion: z.string().min(1).max(120),
    provider: z.string().min(1).max(120),
    providerFallbackUsed: z.boolean(),
    capturedFrameCount: z.number().int().nonnegative().max(10_000),
    usableFrameCount: z.number().int().nonnegative().max(10_000),
    passingFrameCount: z.number().int().nonnegative().max(10_000),
    durationMs: z.number().int().nonnegative().max(120_000),
    rawFramesRetained: z.literal(false),
    diagnostics: jsonObject,
    observedAt: z.string().datetime(),
    offlineEvent: z
      .object({
        eventId: identifier,
        idempotencyKey: identifier,
        storyStateVersion: z.number().int().nonnegative(),
        payloadHash: sha256,
      })
      .strict()
      .optional(),
  })
  .strict();

export const captainVisionActionSchema = z
  .object({
    action: z.enum(captainVisionActions),
    reason: z.string().trim().min(3).max(1_000),
    truthLabel: z.enum(captainTruthLabels).optional(),
    idempotencyKey: identifier,
  })
  .strict()
  .superRefine((input, context) => {
    if (input.action === "LABEL_TRUTH" && !input.truthLabel)
      context.addIssue({ code: "custom", message: "A truth label is required.", path: ["truthLabel"] });
  });

export const offlineReconciliationSchema = z
  .object({
    sessionId: identifier,
    events: z
      .array(
        z
          .object({
            eventId: identifier,
            idempotencyKey: identifier,
            attemptId: identifier,
            eventType: z.literal("vision.result"),
            storyStateVersion: z.number().int().nonnegative(),
            payloadHash: sha256,
            observedAt: z.string().datetime(),
            payload: jsonObject,
          })
          .strict(),
      )
      .max(50),
  })
  .strict();

export type RuntimeResult = z.infer<typeof runtimeResultSchema>;
export type CaptainVisionAction = z.infer<typeof captainVisionActionSchema>;

export type StageTokenContext = {
  attemptId: string;
  playerId: string | null;
  sessionId: string;
  storyId: string;
  publishedVersionId: string;
  stageId: string;
  storyBindingId: string;
  waypointVersionId: string;
  packageHash: string;
  companionInstanceId: string;
  storyStateVersion: number;
  runtimeMode: string;
};

function signingSecret(override?: string) {
  const secret = override ?? process.env.VISION_STAGE_TOKEN_SECRET ?? process.env.SESSION_SECRET;
  if (!secret || secret.length < 32)
    throw new Error("VISION_STAGE_TOKEN_SECRET or SESSION_SECRET must contain at least 32 characters.");
  return secret;
}

function tokenMessage(context: StageTokenContext, nonce: string, expiresAt: number) {
  return [
    context.attemptId,
    context.playerId ?? "anonymous",
    context.sessionId,
    context.storyId,
    context.publishedVersionId,
    context.stageId,
    context.storyBindingId,
    context.waypointVersionId,
    context.packageHash,
    context.companionInstanceId,
    context.storyStateVersion,
    context.runtimeMode,
    nonce,
    expiresAt,
  ].join("|");
}

export function issueStageToken(
  context: StageTokenContext,
  options: { secret?: string; now?: number; ttlMs?: number } = {},
) {
  const now = options.now ?? Date.now();
  const expiresAt = now + Math.min(Math.max(options.ttlMs ?? 2 * 60_000, 15_000), 5 * 60_000);
  const nonce = randomBytes(12).toString("base64url");
  const signature = createHmac("sha256", signingSecret(options.secret))
    .update(tokenMessage(context, nonce, expiresAt))
    .digest("base64url");
  const token = `stg_${nonce}_${expiresAt}_${signature}`;
  return {
    token,
    tokenHash: `sha256:${createHash("sha256").update(token).digest("hex")}`,
    expiresAt: new Date(expiresAt),
  };
}

export function verifyStageToken(
  token: string,
  context: StageTokenContext,
  options: { secret?: string; now?: number } = {},
) {
  const match = /^stg_([A-Za-z0-9_-]+)_([0-9]+)_([A-Za-z0-9_-]+)$/.exec(token);
  if (!match) return { valid: false as const, reason: "MALFORMED" as const };
  const expiresAt = Number(match[2]);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= (options.now ?? Date.now()))
    return { valid: false as const, reason: "EXPIRED" as const };
  const expected = createHmac("sha256", signingSecret(options.secret))
    .update(tokenMessage(context, match[1], expiresAt))
    .digest();
  const provided = Buffer.from(match[3], "base64url");
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected))
    return { valid: false as const, reason: "SIGNATURE" as const };
  return { valid: true as const, expiresAt: new Date(expiresAt) };
}

export function runtimeResultPayloadHash(value: Record<string, unknown>) {
  return `sha256:${createHash("sha256").update(stableJson(value)).digest("hex")}`;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}

export function sanitizeRuntimeDiagnostics(value: Record<string, unknown>) {
  const blocked = /^(pixels|luminance|rawFrame|rawFrames|thumbnail|imageData|frameData)$/i;
  const visit = (item: unknown, depth: number): unknown => {
    if (depth > 8) return "[depth-limited]";
    if (Array.isArray(item)) return item.slice(0, 100).map((entry) => visit(entry, depth + 1));
    if (!item || typeof item !== "object") return item;
    return Object.fromEntries(
      Object.entries(item as Record<string, unknown>)
        .filter(([key]) => !blocked.test(key))
        .map(([key, entry]) => [key, visit(entry, depth + 1)]),
    );
  };
  return visit(value, 0) as Record<string, unknown>;
}

export function guidanceForResult(result: VerificationResult, configured: Record<string, unknown> = {}) {
  const defaults: Record<VerificationResult, { code: string; message: string; retry: boolean }> = {
    VERIFIED: {
      code: "TARGET_VERIFIED",
      message: "The landmark answers. Your Tall Tale is ready to continue.",
      retry: false,
    },
    INSUFFICIENT_VISUAL_EVIDENCE: {
      code: "MOVE_SLOWLY_AND_TRY_AGAIN",
      message: "The view is not clear enough yet. Move slowly and include more of the surroundings.",
      retry: true,
    },
    NOT_AT_TARGET: {
      code: "REVIEW_STORY_DIRECTIONS",
      message: "This view does not match the destination. Recheck the clue and try another bearing.",
      retry: true,
    },
    AMBIGUOUS: {
      code: "CAPTURE_MORE_CONTEXT",
      message: "Several places could match. Include another landmark and inspect again.",
      retry: true,
    },
    SYSTEM_ERROR: {
      code: "VISION_SYSTEM_UNAVAILABLE",
      message: "The Companion could not complete the inspection. Your story progress is safe.",
      retry: true,
    },
    CANCELLED: { code: "ATTEMPT_CANCELLED", message: "Inspection cancelled. Your story did not change.", retry: true },
    STALE: {
      code: "STORY_STAGE_CHANGED",
      message: "The Tall Tale moved on before this result arrived. No progress was changed.",
      retry: false,
    },
  };
  const chosen = defaults[result];
  const configuredValue = configured[result] ?? configured[result.toLocaleLowerCase()];
  return {
    ...chosen,
    message: typeof configuredValue === "string" && configuredValue.trim() ? configuredValue.trim() : chosen.message,
  };
}

export function effectiveRuntimeMode(input: {
  configuredMode: z.infer<typeof waypointRuntimeModeSchema>;
  shadowEnabled: boolean;
  automaticEnabled: boolean;
  automaticEligibility: boolean;
  certificationApprovedModes: string[];
  fieldEvidenceStatus: string;
  automaticPaused?: boolean;
}) {
  if (input.configuredMode === "DISABLED") return { mode: "DISABLED" as const, reason: "STORY_BINDING_DISABLED" };
  if (input.configuredMode === "DEVELOPMENT" || input.configuredMode === "DEVELOPMENT_MOCK")
    return { mode: "DEVELOPMENT_MOCK" as const, reason: null };
  if (input.configuredMode === "SHADOW")
    return input.shadowEnabled
      ? { mode: "SHADOW" as const, reason: null }
      : { mode: "DISABLED" as const, reason: "SHADOW_FEATURE_DISABLED" };
  if (input.configuredMode === "CAPTAIN_CONFIRMED") return { mode: "CAPTAIN_CONFIRMED" as const, reason: null };
  const eligible =
    input.automaticEnabled &&
    input.automaticEligibility &&
    input.certificationApprovedModes.includes("AUTOMATIC") &&
    input.fieldEvidenceStatus === "PASSED" &&
    !input.automaticPaused;
  return eligible
    ? { mode: "AUTOMATIC" as const, reason: null }
    : { mode: "CAPTAIN_CONFIRMED" as const, reason: "AUTOMATIC_NOT_CERTIFIED" };
}
