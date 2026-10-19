/** Source-alias probation only; no coordinates, gestures, samples or actions. */
export const indexSourceAssociationPolicy = {
  maximumCandidates: 3,
  minimumFrames: 3,
  minimumSpanMs: 120,
  maximumCandidateGapMs: 250,
  maximumTrustedAgeMs: 1200,
} as const;
/** Only temporary hand ID/generation may differ. No cross-provider/camera alias. */
export function sameIndexSourceContext(a: string, b: string): boolean {
  try {
    const left: unknown = JSON.parse(a),
      right: unknown = JSON.parse(b);
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === 12 &&
      right.length === 12 &&
      left.slice(0, 10).every((value, index) => value === right[index]) &&
      left.slice(0, 10).every((value) => typeof value === "string" || typeof value === "number") &&
      [left, right].every(
        (value) =>
          typeof value[10] === "string" && value[10].trim().length > 0 && Number.isInteger(value[11]) && value[11] > 0,
      )
    );
  } catch {
    return false;
  }
}

export type IndexSourceEvidence = {
  source: string;
  capture: number;
  fullPoint: boolean;
  identityObserved: boolean;
  /** Caller compares current anatomy to the fixed trusted index reference. */
  anatomyCompatible: boolean;
  /** Two old trusted separated index parts, including DIP, matched currently. */
  appearanceVerified: boolean;
  /** Current old-tip optical match agrees within the caller's strict8px gate. */
  tipAgreement: boolean;
  ambiguous: boolean;
};
export type IndexSourceCandidate = {
  source: string;
  startedAt: number;
  lastAt: number;
  frames: number;
};
export type IndexSourceDecision = {
  state: "UNESTABLISHED" | "VERIFIED" | "PROBATION" | "AMBIGUOUS" | "PROMOTED" | "EXPIRED" | "REJECTED";
  reason: string;
  /** Promotion event only. Known aliases remain available through the getters. */
  canonicalSource: string | null;
  trustedSource: string | null;
  trustedCapture: number | null;
  candidates: readonly IndexSourceCandidate[];
};

/**
 * One owning track/context must reset this instance on provider/camera/geometry
 * or session change. The caller supplies freshness and same-context authority;
 * temporary ID changes never establish those facts. Boolean measurements are
 * current evidence, not permissions inferred from this helper's own result.
 */
export class IndexSourceAssociation {
  private canonical: string | null = null;
  private trusted: string | null = null;
  private trustedAt: number | null = null;
  private lastCapture = -Infinity;
  private candidates: IndexSourceCandidate[] = [];

  get canonicalSource(): string | null {
    return this.canonical;
  }
  get trustedSource(): string | null {
    return this.trusted;
  }
  checkpoint() {
    return {
      canonical: this.canonical,
      trusted: this.trusted,
      trustedAt: this.trustedAt,
      lastCapture: this.lastCapture,
      candidates: this.candidates,
    };
  }
  restore(snapshot: ReturnType<IndexSourceAssociation["checkpoint"]>) {
    Object.assign(this, snapshot);
  }
  get candidateCount() {
    return this.candidates.length;
  }
  reset() {
    this.canonical = this.trusted = null;
    this.trustedAt = null;
    this.lastCapture = -Infinity;
    this.candidates = [];
  }
  private valid(source: string, capture: number) {
    return typeof source === "string" && source.trim().length > 0 && Number.isFinite(capture) && capture >= 0;
  }
  private result(state: IndexSourceDecision["state"], reason: string): IndexSourceDecision {
    return {
      state,
      reason,
      canonicalSource: state === "PROMOTED" ? this.canonical : null,
      trustedSource: this.trusted,
      trustedCapture: this.trustedAt,
      candidates: this.candidates.map((candidate) => ({ ...candidate })),
    };
  }
  /** Explicit upstream trust only. Re-establishment requires an explicit reset. */
  establish(evidence: { source: string; capture: number; canonicalSource?: string }): IndexSourceDecision {
    if (
      !this.valid(evidence.source, evidence.capture) ||
      (evidence.canonicalSource !== undefined && !this.valid(evidence.canonicalSource, evidence.capture)) ||
      evidence.capture < this.lastCapture
    )
      return this.result("REJECTED", "INVALID_OR_REORDERED_TRUSTED_EVIDENCE");
    if (this.canonical !== null) return this.result("REJECTED", "ALREADY_ESTABLISHED");
    this.canonical = evidence.canonicalSource ?? evidence.source;
    this.trusted = evidence.source;
    this.trustedAt = this.lastCapture = evidence.capture;
    this.candidates = [];
    return this.result("VERIFIED", "EXPLICIT_TRUSTED_SOURCE");
  }
  observe(evidence: IndexSourceEvidence): IndexSourceDecision {
    if (!this.valid(evidence.source, evidence.capture) || evidence.capture <= this.lastCapture)
      return this.result("REJECTED", "INVALID_OR_REORDERED_SOURCE_EVIDENCE");
    this.lastCapture = evidence.capture;
    if (this.trustedAt === null || this.canonical === null || this.trusted === null)
      return this.result("UNESTABLISHED", "EXPLICIT_ESTABLISHMENT_REQUIRED");
    const p = indexSourceAssociationPolicy;
    if (evidence.capture - this.trustedAt > p.maximumTrustedAgeMs) {
      this.canonical = this.trusted = null;
      this.trustedAt = null;
      this.candidates = [];
      return this.result("EXPIRED", "TRUSTED_REFERENCE_EXPIRED");
    }
    this.candidates = this.candidates.filter(
      (candidate) => evidence.capture - candidate.lastAt <= p.maximumCandidateGapMs,
    );
    if (evidence.ambiguous !== false) return this.result("AMBIGUOUS", "CURRENT_ASSOCIATION_AMBIGUOUS");
    const anatomy =
      evidence.fullPoint === true && evidence.identityObserved === true && evidence.anatomyCompatible === true;
    if (evidence.source === this.trusted) {
      if (!anatomy || evidence.tipAgreement !== true)
        return this.result("PROBATION", "TRUSTED_SOURCE_NOT_CURRENTLY_VERIFIED");
      this.trustedAt = evidence.capture;
      this.candidates = [];
      return this.result("VERIFIED", "CURRENT_TRUSTED_SOURCE_VERIFIED");
    }
    if (!anatomy || evidence.appearanceVerified !== true || evidence.tipAgreement !== true) {
      this.candidates = this.candidates.filter((candidate) => candidate.source !== evidence.source);
      return this.result("PROBATION", "NEW_SOURCE_PROOF_INCOMPLETE");
    }
    const old = this.candidates.find((candidate) => candidate.source === evidence.source);
    if (!old && this.candidates.length === p.maximumCandidates)
      return this.result("AMBIGUOUS", "SOURCE_CANDIDATE_LIMIT");
    const candidate: IndexSourceCandidate = old
      ? { ...old, lastAt: evidence.capture, frames: old.frames + 1 }
      : { source: evidence.source, startedAt: evidence.capture, lastAt: evidence.capture, frames: 1 };
    this.candidates = [...this.candidates.filter((value) => value.source !== evidence.source), candidate];
    if (this.candidates.length > 1) return this.result("AMBIGUOUS", "COMPETING_CURRENT_SOURCE_CANDIDATES");
    if (candidate.frames < p.minimumFrames || evidence.capture - candidate.startedAt < p.minimumSpanMs)
      return this.result("PROBATION", "NEW_SOURCE_TEMPORAL_PROOF_PENDING");
    this.trusted = candidate.source;
    this.trustedAt = evidence.capture;
    this.candidates = [];
    return this.result("PROMOTED", "SOURCE_ALIAS_RECONFIRMED");
  }
}
