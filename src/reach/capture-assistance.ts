import { z } from "zod";
import type { CaptureHealthCause, CaptureHealthDiagnosis } from "./capture-health";
import { reachImmutableSafety } from "./runtime-policy";

export const captureAssistanceKindSchema = z.enum([
  "EXPOSURE",
  "LOWER_ANALYSIS_COST",
  "REGION_ACQUISITION",
  "INFRARED_ASSIST",
  "DEPTH_ASSIST",
]);
export type CaptureAssistanceKind = z.infer<typeof captureAssistanceKindSchema>;
/** A caller joins current Sextant access with Watchglass qualification; discovery alone is insufficient. */
export type CaptureAssistanceCandidate = {
  id: string;
  kind: CaptureAssistanceKind;
  access: "AVAILABLE" | "UNKNOWN" | "DENIED" | "BUSY" | "UNSUPPORTED";
  authorized: boolean;
  /** Exact current Watchglass/provider qualification reference, not a probability or a hardware-name guess. */
  qualifiedProfile: string | null;
  preservesPrimaryGeometry: boolean;
  work: "REDUCES" | "NEUTRAL" | "INCREASES";
  addresses: CaptureHealthCause[];
};
const ms = z.number().finite().positive().max(3600000);
export const reachCaptureAssistancePolicySchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    enabled: z.boolean(),
    permittedKinds: z
      .array(captureAssistanceKindSchema)
      .max(5)
      .refine((v) => new Set(v).size === v.length),
    requestTimeoutMs: ms,
    trialMaximumMs: ms,
    trialMinimumEvidenceMs: ms,
    minimumUsableImprovement: z.number().finite().positive().max(1),
    minimumRetainedUsableFraction: z.number().finite().positive().max(1),
    minimumRetainedCadenceFraction: z.number().finite().positive().max(1),
    maximumConflictIncrease: z.number().finite().min(0).max(1),
    maximumStaleIncrease: z.number().finite().min(0).max(1),
    backoffMs: ms,
    maximumTrialsPerContext: z.number().int().min(1).max(100),
    baselineRecoveryMs: ms,
    assistedEvidenceTimeoutMs: ms,
  })
  .superRefine((p, c) => {
    if (p.trialMinimumEvidenceMs > p.trialMaximumMs)
      c.addIssue({ code: "custom", message: "Trial evidence must fit its deadline." });
  });
export type ReachCaptureAssistancePolicy = z.infer<typeof reachCaptureAssistancePolicySchema>;
export const defaultReachCaptureAssistancePolicy: Readonly<ReachCaptureAssistancePolicy> =
  Object.freeze<ReachCaptureAssistancePolicy>({
    schemaVersion: 1,
    enabled: true,
    permittedKinds: ["EXPOSURE", "LOWER_ANALYSIS_COST", "REGION_ACQUISITION", "INFRARED_ASSIST", "DEPTH_ASSIST"],
    requestTimeoutMs: 3000,
    trialMaximumMs: 8000,
    trialMinimumEvidenceMs: 2000,
    minimumUsableImprovement: 0.15,
    minimumRetainedUsableFraction: 0.8,
    minimumRetainedCadenceFraction: 0.8,
    maximumConflictIncrease: 0,
    maximumStaleIncrease: 0,
    backoffMs: 30000,
    maximumTrialsPerContext: 3,
    baselineRecoveryMs: 5000,
    assistedEvidenceTimeoutMs: 1500,
  });
export type CaptureAssistanceContext = {
  /** Exact primary source/lease/generation/geometry binding, local only. */
  binding: string;
  enabled: boolean;
  foreground: boolean;
  authorized: boolean;
};
export type CaptureAssistanceAction =
  | { type: "REQUEST"; requestId: number; context: string; candidate: CaptureAssistanceCandidate }
  | { type: "RELEASE"; requestId: number; context: string; reason: string };
type Trial = {
  id: number;
  binding: string;
  candidate: CaptureAssistanceCandidate;
  requestedMs: number;
  startedMs: number | null;
  /** Mode-specific health context is assigned only after the exact request is acknowledged. */
  evidenceContext: string | null;
  baseline: CaptureHealthDiagnosis;
  lastEvidenceMs: number | null;
};
const validClock = (n: number) => Number.isFinite(n) && n >= 0;
const copyHealth = (h: CaptureHealthDiagnosis): CaptureHealthDiagnosis => ({
  ...h,
  measured: [...h.measured],
  hypotheses: [...h.hypotheses],
});
const healthFractions = (h: CaptureHealthDiagnosis) => [
  h.usableFraction,
  h.staleFraction,
  h.rejectedFraction,
  h.conflictFraction,
  h.contraryFraction,
  h.pressureFraction,
];
const validHealth = (h: CaptureHealthDiagnosis) =>
  healthFractions(h).every((v) => v === null || (Number.isFinite(v) && v >= 0 && v <= 1)) &&
  Number.isFinite(h.evidenceMs) &&
  h.evidenceMs >= 0 &&
  (h.captureHz === null || (Number.isFinite(h.captureHz) && h.captureHz > 0));

/**
 * Plans bounded assistance through the existing Sextant owner. Does not acquire a sensor,
 * change camera permission, accept a pointer, or relax independent accuracy validation.
 */
export class ReachCaptureAssistance {
  private policy: ReachCaptureAssistancePolicy;
  private binding: string | null = null;
  private trial: Trial | null = null;
  private nextRequest = 1;
  private attempts = 0;
  private lastNow = -Infinity;
  private retryAfter = 0;
  private tried = new Set<string>();
  private mode: "BASELINE" | "REQUESTING" | "TRIAL" | "ASSISTED" | "BACKOFF" | "STOPPED" = "BASELINE";
  private reason = "CAMERA_BASELINE";
  private baselineRecoveryStarted: number | null = null;
  constructor(policy: ReachCaptureAssistancePolicy = defaultReachCaptureAssistancePolicy) {
    this.policy = reachCaptureAssistancePolicySchema.parse(policy);
  }
  private clock(now: number) {
    if (!validClock(now) || now < this.lastNow) throw new Error("REACH_ASSISTANCE_CLOCK_INVALID");
    this.lastNow = now;
  }
  private release(reason: string, now: number, backoff: boolean): CaptureAssistanceAction[] {
    const previous = this.trial;
    this.trial = null;
    this.baselineRecoveryStarted = null;
    this.retryAfter = backoff ? now + this.policy.backoffMs : now;
    this.mode = backoff ? "BACKOFF" : "BASELINE";
    this.reason = reason;
    return previous ? [{ type: "RELEASE", requestId: previous.id, context: previous.binding, reason }] : [];
  }
  /** Late success must be released by the executor; it can never authorize a superseded trial. */
  acknowledge(
    requestId: number,
    binding: string,
    evidenceContext: string,
    success: boolean,
    now: number,
  ): CaptureAssistanceAction[] {
    this.clock(now);
    const t = this.trial;
    if (t?.id === requestId && t.binding === binding && this.mode !== "REQUESTING") return [];
    if (!t || t.id !== requestId || t.binding !== binding)
      return success ? [{ type: "RELEASE", requestId, context: binding, reason: "SUPERSEDED_REQUEST" }] : [];
    if (
      !success ||
      !evidenceContext ||
      evidenceContext === t.baseline.context ||
      now - t.requestedMs >= this.policy.requestTimeoutMs
    )
      return this.release("ASSISTANCE_START_FAILED", now, true);
    t.startedMs = now;
    t.evidenceContext = evidenceContext;
    this.mode = "TRIAL";
    this.reason = "MEASURING_ASSISTANCE";
    return [];
  }
  /** Call on policy, visibility, permission and source events, even if no model result arrives. */
  update(
    context: CaptureAssistanceContext,
    health: CaptureHealthDiagnosis,
    candidates: CaptureAssistanceCandidate[],
    now: number,
    baselineProbe?: CaptureHealthDiagnosis,
  ): CaptureAssistanceAction[] {
    this.clock(now);
    if (!validHealth(health) || (baselineProbe && !validHealth(baselineProbe)))
      throw new Error("REACH_ASSISTANCE_HEALTH_INVALID");
    let actions: CaptureAssistanceAction[] = [];
    if (context.binding !== this.binding) {
      actions = this.release("PRIMARY_SOURCE_CHANGED", now, false);
      this.binding = context.binding;
      this.attempts = 0;
      this.tried.clear();
    }
    if (!context.enabled || !context.foreground || !context.authorized || !this.policy.enabled || !context.binding) {
      actions.push(...this.release("CAPTURE_NOT_AUTHORIZED", now, false));
      this.mode = "STOPPED";
      this.reason = "CAPTURE_NOT_AUTHORIZED";
      return actions;
    }
    if (this.mode === "STOPPED") this.mode = "BASELINE";
    const t = this.trial;
    if (t) {
      const available = candidates.find((c) => c.id === t.candidate.id);
      if (
        !available ||
        !this.eligible(available, health) ||
        available.kind !== t.candidate.kind ||
        available.qualifiedProfile !== t.candidate.qualifiedProfile
      )
        return [...actions, ...this.release("ASSISTANCE_BECAME_UNAVAILABLE", now, true)];
      if (this.mode === "REQUESTING") {
        if (now - t.requestedMs >= this.policy.requestTimeoutMs)
          return [...actions, ...this.release("ASSISTANCE_REQUEST_TIMEOUT", now, true)];
        return actions;
      }
      // Only fresh mode-specific evidence may assess a trial. Never re-use the preceding baseline window.
      const current =
        health.context === t.evidenceContext &&
        health.sourceBinding === t.binding &&
        this.current(health, now) &&
        health.windowStartedMs !== null &&
        health.windowStartedMs >= t.startedMs!;
      if (current) t.lastEvidenceMs = now;
      if (this.mode === "TRIAL") {
        if (now - t.startedMs! >= this.policy.trialMaximumMs)
          return [...actions, ...this.release("ASSISTANCE_TRIAL_TIMEOUT", now, true)];
        if (current && health.evidenceMs >= this.policy.trialMinimumEvidenceMs && health.usableFraction !== null) {
          const improved =
            health.usableFraction - (t.baseline.usableFraction ?? 0) >= this.policy.minimumUsableImprovement;
          const safe =
            health.staleFraction !== null &&
            health.rejectedFraction !== null &&
            health.conflictFraction !== null &&
            health.contraryFraction !== null &&
            health.staleFraction <= (t.baseline.staleFraction ?? 0) + this.policy.maximumStaleIncrease &&
            health.rejectedFraction <= (t.baseline.rejectedFraction ?? 0) &&
            health.conflictFraction <= (t.baseline.conflictFraction ?? 0) + this.policy.maximumConflictIncrease &&
            health.contraryFraction <= (t.baseline.contraryFraction ?? 0) &&
            health.pressureFraction !== null &&
            health.pressureFraction <= (t.baseline.pressureFraction ?? 0);
          const cadence =
            health.captureHz !== null &&
            t.baseline.captureHz !== null &&
            health.captureHz >= t.baseline.captureHz * this.policy.minimumRetainedCadenceFraction;
          if (
            improved &&
            safe &&
            cadence &&
            health.state === "HEALTHY" &&
            health.usableFraction >= this.policy.minimumRetainedUsableFraction
          ) {
            this.mode = "ASSISTED";
            this.reason = "ASSISTANCE_IMPROVED_TRACKING";
          } else if (!safe || !improved || !cadence)
            return [...actions, ...this.release("ASSISTANCE_DID_NOT_IMPROVE_TRACKING", now, true)];
        }
      } else if (this.mode === "ASSISTED") {
        if (now - (t.lastEvidenceMs ?? t.startedMs!) >= this.policy.assistedEvidenceTimeoutMs)
          return [...actions, ...this.release("ASSISTANCE_EVIDENCE_TIMEOUT", now, true)];
        if (current && health.state === "DEGRADED")
          return [...actions, ...this.release("ASSISTANCE_DETERIORATED", now, true)];
        if (
          current &&
          (health.staleFraction === null ||
            health.rejectedFraction === null ||
            health.conflictFraction === null ||
            health.contraryFraction === null ||
            health.pressureFraction === null ||
            health.captureHz === null ||
            t.baseline.captureHz === null ||
            health.staleFraction > (t.baseline.staleFraction ?? 0) + this.policy.maximumStaleIncrease ||
            health.rejectedFraction > (t.baseline.rejectedFraction ?? 0) ||
            health.conflictFraction > (t.baseline.conflictFraction ?? 0) + this.policy.maximumConflictIncrease ||
            health.contraryFraction > (t.baseline.contraryFraction ?? 0) ||
            health.pressureFraction > (t.baseline.pressureFraction ?? 0) ||
            health.captureHz < t.baseline.captureHz * this.policy.minimumRetainedCadenceFraction)
        )
          return [...actions, ...this.release("ASSISTANCE_EVIDENCE_WORSENED", now, true)];
        // Good assisted tracking cannot demonstrate that the unassisted camera has recovered.
        const recovered =
          baselineProbe?.context === t.baseline.context &&
          baselineProbe.sourceBinding === t.binding &&
          this.current(baselineProbe, now) &&
          baselineProbe.state === "HEALTHY" &&
          baselineProbe.windowStartedMs !== null &&
          baselineProbe.windowStartedMs >= t.startedMs!;
        if (recovered) {
          this.baselineRecoveryStarted ??= now;
          if (now - this.baselineRecoveryStarted >= this.policy.baselineRecoveryMs)
            return [...actions, ...this.release("BASELINE_RECOVERED", now, true)];
        } else this.baselineRecoveryStarted = null;
      }
      return actions;
    }
    if (now < this.retryAfter) return actions;
    this.mode = "BASELINE";
    if (health.state !== "DEGRADED" || health.sourceBinding !== context.binding || !this.current(health, now)) {
      this.reason = "CAMERA_BASELINE";
      return actions;
    }
    if (this.attempts >= this.policy.maximumTrialsPerContext) {
      this.reason = "ASSISTANCE_TRIAL_BUDGET_EXHAUSTED";
      return actions;
    }
    const causes = [...health.measured, ...health.hypotheses];
    const ranked = candidates
      .filter(
        (c) => this.eligible(c, health) && !this.tried.has(c.id) && c.addresses.some((cause) => causes.includes(cause)),
      )
      .sort((a, b) => Number(b.work === "REDUCES") - Number(a.work === "REDUCES") || a.id.localeCompare(b.id));
    const selected = ranked[0];
    if (!selected) {
      this.reason = "NO_QUALIFIED_ASSISTANCE_AVAILABLE";
      return actions;
    }
    const candidate = { ...selected, addresses: [...selected.addresses] };
    const id = this.nextRequest++;
    this.attempts++;
    this.tried.add(candidate.id);
    this.trial = {
      id,
      binding: context.binding,
      candidate,
      requestedMs: now,
      startedMs: null,
      evidenceContext: null,
      baseline: copyHealth(health),
      lastEvidenceMs: null,
    };
    this.mode = "REQUESTING";
    this.reason = "REQUESTING_QUALIFIED_ASSISTANCE";
    return [...actions, { type: "REQUEST", requestId: id, context: context.binding, candidate }];
  }
  private eligible(c: CaptureAssistanceCandidate, health: CaptureHealthDiagnosis) {
    return (
      !!c.id &&
      this.policy.permittedKinds.includes(c.kind) &&
      c.access === "AVAILABLE" &&
      c.authorized &&
      !!c.qualifiedProfile &&
      c.preservesPrimaryGeometry &&
      !(health.measured.includes("PROCESSING_PRESSURE") && c.work === "INCREASES")
    );
  }
  private current(health: CaptureHealthDiagnosis, now: number) {
    return (
      health.lastCaptureMs !== null &&
      now >= health.lastCaptureMs &&
      now - health.lastCaptureMs <= reachImmutableSafety.maximumObservationAgeMs
    );
  }
  snapshot() {
    return {
      state: this.mode,
      reason: this.reason,
      attempts: this.attempts,
      retryAfterMs: this.retryAfter,
      activeKind: this.trial?.candidate.kind ?? null,
      requestId: this.trial?.id ?? null,
      deadlineMs: this.trial
        ? this.mode === "REQUESTING"
          ? this.trial.requestedMs + this.policy.requestTimeoutMs
          : this.mode === "TRIAL"
            ? this.trial.startedMs! + this.policy.trialMaximumMs
            : this.mode === "ASSISTED"
              ? (this.trial.lastEvidenceMs ?? this.trial.startedMs!) + this.policy.assistedEvidenceTimeoutMs
              : null
        : null,
    };
  }
}
