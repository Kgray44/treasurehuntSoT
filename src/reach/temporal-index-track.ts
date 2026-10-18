import type { Point } from "./coordinates";

export const temporalIndexPolicy = {
  measurementFreshnessMs: 150,
  identityRecoveryMs: 1200,
  maximumAnalysisVelocity: 240,
  maximumHistory: 8,
} as const;
export type TemporalIndexSnapshot = {
  state: "ACQUIRING" | "TRACKING" | "UNCERTAIN" | "COASTING" | "REACQUIRING" | "AMBIGUOUS" | "EXPIRED";
  identity: "ESTABLISHED" | "CANDIDATE" | "AMBIGUOUS" | "EXPIRED";
  intent: "POINT" | "CONTRARY" | "UNCERTAIN";
  measurementAgeMs: number | null;
  positionUncertaintyPixels: number | null;
  sourceGenerationCount: number;
  hypothesisCount: number;
  /** Display only. Never substitutes for the current observation's measured point. */
  displayPoint: Point | null;
};
type Evidence = {
  capture: number;
  completed?: number;
  rawTrackId: string | null;
  point: Point | null;
  uncertaintyPixels: number | null;
  identitySupported: boolean;
  source: string | null;
  intent: TemporalIndexSnapshot["intent"];
  ambiguous: boolean;
  hypotheses: number;
  width: number;
  height: number;
};
let nextLogicalIndex = 0;

/** Session-local association, distinct from an optical template epoch and gesture.
 * The producer still owns measurement acceptance; this ledger cannot create one.
 * Calibration binding and saved targets remain owned by the canonical consumer.
 */
export class TemporalIndexTrack {
  private logical: { id: string; generation: number; raw: string; established: boolean } | null = null;
  private lastCapture = -Infinity;
  private identityAt = -Infinity;
  private source: string | null = null;
  private sources: string[] = [];
  private measurement: { point: Point; at: number; uncertainty: number; width: number; height: number } | null = null;
  private velocity: Point = { x: 0, y: 0 };
  private history: { at: number; kind: "MEASURED" | "INTERRUPTED" | "AMBIGUOUS" }[] = [];
  private expired = false;

  reset() {
    this.logical = null;
    this.lastCapture = this.identityAt = -Infinity;
    this.source = null;
    this.sources = [];
    this.measurement = null;
    this.velocity = { x: 0, y: 0 };
    this.history = [];
    this.expired = false;
  }
  checkpoint() {
    return {
      logical: this.logical,
      lastCapture: this.lastCapture,
      identityAt: this.identityAt,
      source: this.source,
      sources: this.sources,
      measurement: this.measurement,
      velocity: this.velocity,
      history: this.history,
      expired: this.expired,
    };
  }
  restore(snapshot: ReturnType<TemporalIndexTrack["checkpoint"]>) {
    Object.assign(this, snapshot);
  }

  observe(e: Evidence): {
    trackId: string | null;
    trackGeneration: number;
    snapshot: TemporalIndexSnapshot;
    accept: boolean;
  } {
    if (
      !Number.isFinite(e.capture) ||
      e.capture < 0 ||
      e.capture <= this.lastCapture ||
      ![e.width, e.height].every((v) => Number.isFinite(v) && v > 1) ||
      (e.point !== null &&
        ![e.point.x, e.point.y].every((value) => Number.isFinite(value) && value >= 0 && value <= 1)) ||
      (e.uncertaintyPixels !== null && (!Number.isFinite(e.uncertaintyPixels) || e.uncertaintyPixels < 0))
    )
      throw new Error("TEMPORAL_INDEX_CLOCK_OR_GEOMETRY_INVALID");
    const now = e.completed ?? e.capture;
    if (!Number.isFinite(now) || now < e.capture) throw new Error("TEMPORAL_INDEX_COMPLETION_CLOCK_INVALID");
    this.lastCapture = e.capture;
    const expired = this.logical !== null && e.capture - this.identityAt > temporalIndexPolicy.identityRecoveryMs;
    if (expired) this.resetAssociation();
    // A raw template replacement is compatible only with current separately
    // verified same-source anatomy. New source aliases must be proved upstream.
    const replacement = this.logical !== null && e.rawTrackId !== null && e.rawTrackId !== this.logical.raw;
    const compatibleReplacement = replacement && e.identitySupported && e.source !== null && e.source === this.source;
    const sourceChanged = this.source !== null && e.source !== null && this.source !== e.source;
    const ambiguous = e.ambiguous || sourceChanged || (replacement && !compatibleReplacement);
    if (!this.logical && e.rawTrackId && (!this.expired || e.point || e.identitySupported)) {
      const generation = ++nextLogicalIndex;
      this.logical = {
        id: `index-track-${generation}`,
        generation,
        raw: e.rawTrackId,
        established: !ambiguous && (e.identitySupported || e.point !== null),
      };
      this.identityAt = e.capture;
      this.source = this.logical.established ? e.source : null;
      this.expired = false;
    } else if (compatibleReplacement) this.logical = { ...this.logical!, raw: e.rawTrackId! };
    const sameRaw = this.logical !== null && this.logical.raw === e.rawTrackId;
    const supported = sameRaw && !ambiguous && (e.identitySupported || e.point !== null);
    if (supported) {
      this.logical = { ...this.logical!, established: true };
      this.identityAt = e.capture;
      if (e.source !== null) {
        this.source ??= e.source;
        if (!this.sources.includes(e.source))
          this.sources = [...this.sources, e.source].slice(-temporalIndexPolicy.maximumHistory);
      }
    }
    const accept = sameRaw && !ambiguous && e.point !== null;
    if (accept) {
      const prior = this.measurement;
      if (prior && e.capture - prior.at <= temporalIndexPolicy.measurementFreshnessMs) {
        const dt = (e.capture - prior.at) / 1000;
        const vx = ((e.point!.x - prior.point.x) * (e.width - 1)) / dt;
        const vy = ((e.point!.y - prior.point.y) * (e.height - 1)) / dt;
        // Same cap as the existing optical motion estimator; not a new filter.
        const cap = (temporalIndexPolicy.maximumAnalysisVelocity * Math.max(e.width, e.height)) / 320;
        const gain = Math.min(1, cap / Math.max(1e-9, Math.hypot(vx, vy)));
        this.velocity = { x: vx * gain, y: vy * gain };
      } else this.velocity = { x: 0, y: 0 };
      this.measurement = {
        point: { ...e.point! },
        at: e.capture,
        uncertainty: e.uncertaintyPixels ?? 0,
        width: e.width,
        height: e.height,
      };
    }
    const age = this.measurement ? now - this.measurement.at : null;
    const coast =
      !accept &&
      !ambiguous &&
      e.intent !== "CONTRARY" &&
      age !== null &&
      age <= temporalIndexPolicy.measurementFreshnessMs;
    const display = accept
      ? e.point
      : coast && this.measurement
        ? {
            x: Math.max(0, Math.min(1, this.measurement.point.x + (this.velocity.x * age!) / 1000 / (e.width - 1))),
            y: Math.max(0, Math.min(1, this.measurement.point.y + (this.velocity.y * age!) / 1000 / (e.height - 1))),
          }
        : null;
    this.history = [
      ...this.history,
      {
        at: e.capture,
        kind: ambiguous ? ("AMBIGUOUS" as const) : accept ? ("MEASURED" as const) : ("INTERRUPTED" as const),
      },
    ].slice(-temporalIndexPolicy.maximumHistory);
    const state: TemporalIndexSnapshot["state"] = ambiguous
      ? "AMBIGUOUS"
      : accept
        ? "TRACKING"
        : coast
          ? "COASTING"
          : this.logical
            ? e.identitySupported
              ? "UNCERTAIN"
              : "REACQUIRING"
            : this.expired
              ? "EXPIRED"
              : "ACQUIRING";
    return {
      trackId: this.logical?.id ?? null,
      trackGeneration: this.logical?.generation ?? 0,
      accept,
      snapshot: {
        state,
        identity: ambiguous
          ? "AMBIGUOUS"
          : this.logical?.established
            ? "ESTABLISHED"
            : this.expired
              ? "EXPIRED"
              : "CANDIDATE",
        intent: e.intent,
        measurementAgeMs: age,
        positionUncertaintyPixels: this.measurement
          ? this.measurement.uncertainty +
            (((age ?? 0) / 1000) * temporalIndexPolicy.maximumAnalysisVelocity * Math.max(e.width, e.height)) / 320
          : null,
        sourceGenerationCount: this.sources.length,
        hypothesisCount: Math.max(0, Math.min(3, e.hypotheses)),
        displayPoint: display ? { ...display } : null,
      },
    };
  }
  private resetAssociation() {
    this.logical = null;
    this.identityAt = -Infinity;
    this.source = null;
    this.sources = [];
    this.measurement = null;
    this.velocity = { x: 0, y: 0 };
    this.expired = true;
  }
}
