import { z } from "zod";
import { observationFreshnessTime } from "@/watchglass/hand-observation";
import { temporalIndexPolicy } from "./temporal-index-track";

const clock = z.number().finite().nonnegative();
const generation = z.number().finite().int().positive();
const point = z.strictObject({ x: z.number().finite().min(0).max(1), y: z.number().finite().min(0).max(1) });
const identifier = (maximum: number) =>
  z
    .string()
    .max(maximum)
    .refine((value) => value.trim().length > 0);
const frameSchema = z.strictObject({
  providerId: identifier(256),
  providerVersion: identifier(256),
  providerGeneration: generation,
  cameraLeaseId: identifier(256),
  cameraFrameVersion: generation,
  frameWidth: z.number().finite().int().min(2),
  frameHeight: z.number().finite().int().min(2),
  mirrorTransform: z.enum(["NONE", "PREVIEW_X"]),
  orientation: z.literal(0),
  sequence: z.number().finite().int().nonnegative(),
  monotonicCaptureTime: clock,
  monotonicPixelOriginTime: clock.optional(),
  /** Raw provider source for this capture, never a selected/canonical identity certificate. */
  sourceKey: identifier(2048),
});
const factsSchema = z.strictObject({
  observedIndexJoints: z
    .array(z.strictObject({ index: z.union([z.literal(5), z.literal(6), z.literal(7), z.literal(8)]), ...point.shape }))
    .min(1)
    .max(4)
    .refine((joints) => new Set(joints.map((joint) => joint.index)).size === joints.length)
    .optional(),
  localAppearance: z
    .strictObject({
      referenceCaptureTime: clock,
      correlation: z.number().finite(),
      separation: z.number().finite().nonnegative(),
      forwardBackwardErrorPixels: z.number().finite().nonnegative(),
    })
    .optional(),
  motion: z
    .strictObject({ previousCaptureTime: clock, displacementPixels: z.number().finite().nonnegative() })
    .optional(),
  rivalPoints: z.array(point).max(3).optional(),
  uncertaintyRadiusPixels: z.number().finite().nonnegative().optional(),
});
const inputSchema = frameSchema.extend({
  coordinateSpace: z.literal("NORMALIZED_CURRENT_IMAGE"),
  proposalPoint: point,
  monotonicCompletionTime: clock,
  facts: factsSchema.optional(),
});

type Immutable<T> = T extends object ? { readonly [K in keyof T]: Immutable<T[K]> } : T;

/** Supplied by the capture owner independently of a proposed coordinate. */
export type FingertipRecoveryFrame = Immutable<z.infer<typeof frameSchema>>;
export type FingertipRecoveryProposalInput = z.input<typeof inputSchema>;
/** Data for search/probation only. Deliberately has no actionable `point` or authority fields. */
export type FingertipRecoveryProposal = Immutable<z.infer<typeof inputSchema> & { status: "UNVERIFIED" }>;
export type FingertipRecoveryProposalResult =
  | { ok: true; proposal: FingertipRecoveryProposal }
  | {
      ok: false;
      reason:
        | "INVALID_FRAME_CONTEXT"
        | "INVALID_PROPOSAL"
        | "FRAME_CONTEXT_MISMATCH"
        | "INVALID_CLOCK"
        | "STALE_FRAME"
        | "INVALID_EVIDENCE_CLOCK";
    };

function immutable<T>(value: T): Immutable<T> {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) immutable(child);
    Object.freeze(value);
  }
  return value as Immutable<T>;
}

/**
 * Structural/current-frame validation is not anatomical or identity verification.
 * Facts remain unverified measurements; even perfect appearance scores cannot
 * promote this data, renew a template/clock, or enter an observation gate.
 */
export function createFingertipRecoveryProposal(
  input: unknown,
  currentFrame: FingertipRecoveryFrame,
  now: number,
): FingertipRecoveryProposalResult {
  const expected = frameSchema.safeParse(currentFrame);
  if (!expected.success) return { ok: false, reason: "INVALID_FRAME_CONTEXT" };
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "INVALID_PROPOSAL" };
  const proposal = parsed.data;
  if (
    Object.keys(frameSchema.shape).some(
      (key) => proposal[key as keyof typeof expected.data] !== expected.data[key as keyof typeof expected.data],
    )
  )
    return { ok: false, reason: "FRAME_CONTEXT_MISMATCH" };
  const originalTime = observationFreshnessTime(proposal);
  if (
    !Number.isFinite(now) ||
    now < 0 ||
    originalTime < 0 ||
    proposal.monotonicCompletionTime < proposal.monotonicCaptureTime ||
    proposal.monotonicCompletionTime > now ||
    (proposal.monotonicPixelOriginTime !== undefined && proposal.monotonicPixelOriginTime > now + 5)
  )
    return { ok: false, reason: "INVALID_CLOCK" };
  if (now - originalTime > temporalIndexPolicy.measurementFreshnessMs) return { ok: false, reason: "STALE_FRAME" };
  if (
    (proposal.facts?.localAppearance &&
      proposal.facts.localAppearance.referenceCaptureTime > proposal.monotonicCaptureTime) ||
    (proposal.facts?.motion && proposal.facts.motion.previousCaptureTime >= proposal.monotonicCaptureTime)
  )
    return { ok: false, reason: "INVALID_EVIDENCE_CLOCK" };
  // Zod parsed a detached copy of every supported field before freezing it.
  return { ok: true, proposal: immutable({ ...proposal, status: "UNVERIFIED" as const }) };
}
