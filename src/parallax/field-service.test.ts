import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSpatialDraft } from "./authoring";
import { enableAdaptiveAuthoring } from "./adaptive-authoring";
import { materializeLibraryMoment } from "./library-service";
import { canonicalChecksum } from "@/drydock/canonical";
import {
  fieldMetadataSchema,
  fieldContributionSchema,
  automaticCalibrationImageEligibility,
  summarizeFieldQuality,
  type FieldMetadata,
} from "./field-contracts";
const m = vi.hoisted(() => ({
  bound: vi.fn(),
  owned: vi.fn(),
  evidence: vi.fn(),
  reviews: vi.fn(),
  prior: vi.fn(),
  create: vi.fn(),
  reviewCreate: vi.fn(),
  claim: vi.fn(),
  remove: vi.fn(),
  purge: vi.fn(),
  audit: vi.fn(),
  session: vi.fn(),
  member: vi.fn(),
  list: vi.fn(),
}));
vi.mock("./service", () => ({ loadReleasedSpatialMoment: m.bound }));
vi.mock("@/chronicle/studio-authorization", () => ({ requireOwnedStudioTale: vi.fn() }));
vi.mock("@/lib/db", () => {
  const db = {
    reusableAuthoringItem: { findFirst: m.owned },
    parallaxFieldObservation: {
      findFirst: m.evidence,
      findUnique: m.prior,
      findMany: m.list,
      create: m.create,
      delete: m.remove,
      deleteMany: m.purge,
    },
    parallaxCalibrationReview: { findFirst: m.reviews, create: m.reviewCreate, updateMany: m.claim },
    parallaxFieldAudit: { create: m.audit },
    taleSession: { findUnique: m.session },
    playthroughMembership: { findFirst: m.member },
  };
  return { db: { ...db, $transaction: async (run: (tx: typeof db) => unknown) => run(db) } };
});
import {
  contributeFieldObservation,
  withdrawFieldObservation,
  creatorFieldQuality,
  reviewCalibration,
  assertCalibrationClaim,
  purgeExpiredFieldEvidence,
} from "./field-service";
function draft() {
  const d = enableAdaptiveAuthoring(createSpatialDraft("field-note"));
  d.content.adaptive!.calibration.enabled = true;
  return d;
}
const metadata: FieldMetadata = {
  schemaVersion: 1,
  provenance: "PLAYER_REPORTED_PHYSICAL",
  resolved: true,
  surface: "TABLE",
  confidence: "HIGH",
  meaningfulSearchSeconds: 30,
  hintStage: 1,
  exactReveal: false,
  trackingRecovered: false,
  fallback: false,
  capabilityLimitation: "NONE",
  placementQuality: "BELIEVABLE",
};
beforeEach(() => {
  Object.values(m).forEach((f) => f.mockReset());
  m.member.mockResolvedValue({ id: "member" });
  m.session.mockResolvedValue({ status: "ACTIVE", currentBlockId: "library-preview", publishedVersionId: "edition" });
  m.reviewCreate.mockResolvedValue({ id: "review-created" });
  m.claim.mockResolvedValue({ count: 1 });
  m.create.mockResolvedValue({ id: "observation" });
});
describe("consented field calibration boundary", () => {
  it("expires original records by deletion and excludes expired data from Creator reads", async () => {
    const now = new Date("2026-10-11T16:00:00Z");
    await purgeExpiredFieldEvidence(now);
    expect(m.purge).toHaveBeenCalledWith({
      where: { OR: [{ expiresAt: { lte: now } }, { withdrawnAt: { not: null } }] },
    });
    m.owned.mockResolvedValue({ id: "field-note" });
    m.list.mockResolvedValue([]);
    await creatorFieldQuality("creator", "field-note");
    expect(m.list.mock.calls[0][0]).toMatchObject({
      where: { expiresAt: { gt: expect.any(Date) }, withdrawnAt: null },
      take: 200,
    });
  });
  it("completes review, calibration and independent later verification on a pinned released refinement", async () => {
    const d = draft(),
      first = materializeLibraryMoment(d, "creator", 1);
    const item = {
      id: d.content.definitionId,
      versions: [{ id: first.version.id, versionNumber: 1, envelope: JSON.stringify(first) }],
    };
    m.owned.mockResolvedValue(item);
    m.evidence.mockResolvedValue({ id: "evidence", metadata: JSON.stringify(metadata) });
    const input = {
      definitionId: item.id,
      versionId: first.version.id,
      evidenceId: "evidence",
      maturity: "CREATOR_REVIEWED",
      expectedReviewId: null,
      expectedRevision: 0,
    };
    await expect(reviewCalibration("creator", input, d)).resolves.toMatchObject({ maturity: "CREATOR_REVIEWED" });
    expect(m.reviewCreate.mock.calls[0][0].data.reviewSequence).toBe(1);
    const reviewed = {
      id: "reviewed",
      revision: 1,
      reviewSequence: 1,
      maturity: "CREATOR_REVIEWED",
      recipeDigest: canonicalChecksum(d.content.adaptive!.recipes),
      createdAt: new Date("2026-10-10T10:00:00Z"),
    };
    m.reviews.mockResolvedValue(reviewed);
    await expect(
      reviewCalibration(
        "creator",
        { ...input, maturity: "CALIBRATED", expectedReviewId: "reviewed", expectedRevision: 1 },
        d,
      ),
    ).resolves.toMatchObject({ maturity: "CALIBRATED" });
    expect(m.reviewCreate.mock.calls[1][0].data.reviewSequence).toBe(2);
    const calibrated = { ...reviewed, id: "calibrated", reviewSequence: 2, maturity: "CALIBRATED" };
    d.content.adaptive!.calibration = {
      ...d.content.adaptive!.calibration,
      maturity: "CALIBRATED",
      reviewReceiptId: "calibrated",
    };
    const release = materializeLibraryMoment(d, "creator", 2);
    item.versions.push({ id: release.version.id, versionNumber: 2, envelope: JSON.stringify(release) });
    m.reviews.mockResolvedValue(calibrated);
    const verify = {
      ...input,
      versionId: release.version.id,
      maturity: "VERIFIED",
      expectedReviewId: "calibrated",
      expectedRevision: 1,
    };
    m.list.mockResolvedValue([{ actorId: "one", sessionId: "run-one", metadata: JSON.stringify(metadata) }]);
    await expect(reviewCalibration("creator", verify, d)).rejects.toThrow("INDEPENDENT_VERIFICATION_REQUIRED");
    m.list.mockResolvedValue(
      ["one", "two"].map((id) => ({ actorId: id, sessionId: `run-${id}`, metadata: JSON.stringify(metadata) })),
    );
    await expect(reviewCalibration("creator", verify, d)).resolves.toMatchObject({
      maturity: "VERIFIED",
      physicalQualification: "NOT_ESTABLISHED",
    });
    expect(m.list.mock.calls.at(-1)![0].where).toMatchObject({
      versionId: release.version.id,
      versionChecksum: release.version.checksum,
      createdAt: { gt: calibrated.createdAt },
    });
    const stale = { ...verify, versionId: first.version.id };
    await expect(reviewCalibration("creator", stale, d)).rejects.toThrow("REVIEWED_VERSION_REQUIRED");
  });
  it("requires a new Creator review when recipe intent changes and rejects first-review races", async () => {
    const d = draft(),
      capsule = materializeLibraryMoment(d, "creator", 1);
    m.owned.mockResolvedValue({
      id: d.content.definitionId,
      versions: [{ id: capsule.version.id, versionNumber: 1, envelope: JSON.stringify(capsule) }],
    });
    m.evidence.mockResolvedValue({ id: "evidence", metadata: JSON.stringify(metadata) });
    m.reviews.mockResolvedValue({
      id: "prior",
      revision: 1,
      reviewSequence: 3,
      maturity: "VERIFIED",
      recipeDigest: "old-recipe",
    });
    const input = {
      definitionId: d.content.definitionId,
      versionId: capsule.version.id,
      evidenceId: "evidence",
      maturity: "CREATOR_REVIEWED",
      expectedReviewId: "prior",
      expectedRevision: 1,
    };
    await expect(reviewCalibration("creator", { ...input, maturity: "CALIBRATED" }, d)).rejects.toThrow(
      "TRANSITION_INVALID",
    );
    await expect(reviewCalibration("creator", input, d)).resolves.toMatchObject({ maturity: "CREATOR_REVIEWED" });
    expect(m.reviewCreate.mock.calls.at(-1)![0].data.reviewSequence).toBe(4);
    m.reviews.mockResolvedValue(null);
    m.reviewCreate.mockRejectedValue({ code: "P2002" });
    await expect(
      reviewCalibration("creator", { ...input, expectedReviewId: null, expectedRevision: 0 }, d),
    ).rejects.toThrow("CONCURRENT_UPDATE");
  });
  it("never accepts imagery, raw geometry, extra identifiers or absent consent", () => {
    const capsule = materializeLibraryMoment(draft(), "creator", 1);
    const raw = {
      action: "CONTRIBUTE",
      blockId: "library-preview",
      versionId: capsule.version.id,
      versionChecksum: capsule.version.checksum,
      idempotencyKey: "consent-1",
      disclosureVersion: 1,
      consent: true,
      metadata,
    };
    expect(fieldContributionSchema.safeParse(raw).success).toBe(true);
    expect(fieldContributionSchema.safeParse({ ...raw, consent: false }).success).toBe(false);
    expect(fieldMetadataSchema.safeParse({ ...metadata, roomImage: "private" }).success).toBe(false);
    expect(fieldMetadataSchema.safeParse({ ...metadata, latitude: 40, trajectory: [] }).success).toBe(false);
    for (const person of ["PRESENT", "UNKNOWN", "ABSENT"] as const)
      expect(automaticCalibrationImageEligibility({ person, face: "ABSENT", consent: true })).toMatchObject({
        allowed: false,
        transferBytes: 0,
      });
    expect(automaticCalibrationImageEligibility({ person: "ABSENT", face: "UNKNOWN", consent: true }).reason).toBe(
      "PERSON_OR_FACE_NOT_EXCLUDED",
    );
  });
  it("binds contribution to a current immutable passage and enforces idempotency", async () => {
    const capsule = materializeLibraryMoment(draft(), "creator", 1);
    m.bound.mockResolvedValue({ moment: capsule, binding: { chronicleVersionId: "edition" }, replayOnly: false });
    const raw = {
      action: "CONTRIBUTE",
      blockId: "library-preview",
      versionId: capsule.version.id,
      versionChecksum: capsule.version.checksum,
      idempotencyKey: "consent-1",
      disclosureVersion: 1,
      consent: true,
      metadata,
    };
    await expect(contributeFieldObservation("voyage", "player", raw)).resolves.toMatchObject({
      observationId: "observation",
      progressionChanged: false,
    });
    const stored = m.create.mock.calls[0][0].data;
    expect(JSON.parse(stored.metadata)).toEqual(metadata);
    expect(stored.expiresAt).toBeInstanceOf(Date);
    m.prior.mockResolvedValue({ id: "observation", digest: "different" });
    await expect(contributeFieldObservation("voyage", "player", raw)).rejects.toThrow("IDEMPOTENCY_CONFLICT");
    await expect(contributeFieldObservation("voyage", "player", { ...raw, versionId: "old" })).rejects.toThrow(
      "SCOPE_INVALID",
    );
    m.bound.mockResolvedValue({ moment: capsule, binding: { chronicleVersionId: "edition" }, replayOnly: true });
    await expect(contributeFieldObservation("voyage", "player", raw)).rejects.toThrow("SCOPE_INVALID");
  });
  it("deletes withdrawn evidence and restricts Creator access", async () => {
    m.evidence.mockResolvedValue({ id: "observation" });
    await expect(withdrawFieldObservation("player", "observation")).resolves.toMatchObject({ withdrawn: true });
    expect(m.remove).toHaveBeenCalledWith({ where: { id: "observation" } });
    m.evidence.mockResolvedValue(null);
    await expect(withdrawFieldObservation("other", "observation")).rejects.toThrow("UNAVAILABLE");
    m.owned.mockResolvedValue(null);
    await expect(creatorFieldQuality("other", "field-note")).rejects.toThrow("FORBIDDEN");
    m.owned.mockResolvedValue({ id: "field-note" });
    m.list.mockResolvedValue([]);
    await expect(creatorFieldQuality("creator", "field-note")).resolves.toMatchObject({ maturity: "SEMANTIC" });
    expect(m.purge).toHaveBeenCalled();
    expect(m.audit).toHaveBeenCalled();
  });
  it("does not let simulation or withdrawn/stale evidence promote maturity", async () => {
    const d = draft(),
      capsule = materializeLibraryMoment(d, "creator", 1);
    m.owned.mockResolvedValue({
      id: d.content.definitionId,
      versions: [{ id: capsule.version.id, versionNumber: 1, envelope: JSON.stringify(capsule) }],
    });
    const input = {
      definitionId: d.content.definitionId,
      versionId: capsule.version.id,
      evidenceId: "evidence",
      maturity: "CREATOR_REVIEWED",
      expectedReviewId: null,
      expectedRevision: 0,
    };
    m.evidence.mockResolvedValue(null);
    await expect(reviewCalibration("creator", input, d)).rejects.toThrow("FIELD_EVIDENCE_REQUIRED");
    expect(m.evidence.mock.calls[0][0].where).toMatchObject({
      provenance: "PLAYER_REPORTED_PHYSICAL",
      withdrawnAt: null,
    });
    m.evidence.mockResolvedValue({ id: "evidence", metadata: JSON.stringify(metadata) });
    await expect(reviewCalibration("creator", input, d)).resolves.toMatchObject({ maturity: "CREATOR_REVIEWED" });
    await expect(reviewCalibration("creator", { ...input, maturity: "VERIFIED" }, d)).rejects.toThrow(
      "TRANSITION_INVALID",
    );
    m.reviews.mockResolvedValue({ id: "prior", revision: 2, maturity: "CREATOR_REVIEWED" });
    await expect(reviewCalibration("creator", { ...input, maturity: "CALIBRATED" }, d)).rejects.toThrow(
      "CONCURRENT_UPDATE",
    );
  });
  it("rejects unsupported published maturity claims and separates quality sources", async () => {
    const d = draft();
    d.content.adaptive!.calibration = {
      ...d.content.adaptive!.calibration,
      maturity: "VERIFIED",
      reviewReceiptId: "invented",
    };
    m.reviews.mockResolvedValue(null);
    await expect(assertCalibrationClaim("creator", d)).rejects.toThrow("CLAIM_UNSUPPORTED");
    const stats = summarizeFieldQuality([
      metadata,
      { ...metadata, provenance: "SIMULATED", fallback: true, exactReveal: true, meaningfulSearchSeconds: 90 },
    ]);
    expect(stats.physicalReports.encounters).toBe(1);
    expect(stats.simulated.encounters).toBe(1);
    expect(stats.physicalQualification).toBe("NOT_ESTABLISHED");
  });
});
