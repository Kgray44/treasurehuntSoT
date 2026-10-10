import { beforeEach, describe, expect, it, vi } from "vitest";
import { syntheticSpatialMoment, syntheticBinding, guidedContext } from "./fixtures";
import { ParallaxLensRuntime } from "./runtime";
const mocks = vi.hoisted(() => ({
  projection: vi.fn(),
  read: vi.fn(),
  transaction: vi.fn(),
  txRead: vi.fn(),
  membership: vi.fn(),
  observation: vi.fn(),
  parse: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ db: { taleSession: { findUnique: mocks.read }, $transaction: mocks.transaction } }));
vi.mock("@/chronicle/progression", () => ({ getTaleSessionState: mocks.projection }));
vi.mock("@/chronicle/publishing", () => ({ parsePublishedSnapshot: mocks.parse }));
import { loadReleasedSpatialMoment, recordSpatialObservation } from "./service";
const session = () => ({
  status: "ACTIVE",
  currentBlockId: syntheticBinding.blockId,
  previewMode: false,
  publishedVersionId: syntheticBinding.chronicleVersionId,
  taleId: "tale-1",
  version: { id: syntheticBinding.chronicleVersionId, taleId: "tale-1", contentSnapshot: "snapshot" },
});
async function receipt() {
  const runtime = new ParallaxLensRuntime(
    syntheticSpatialMoment(),
    { ...syntheticBinding, runId: syntheticBinding.sessionId },
    guidedContext(),
  );
  await runtime.open();
  return runtime.interact("captains-note", "INSPECT", "observation-1");
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.projection.mockResolvedValue({
    journal: { chapters: [{ blocks: [{ id: syntheticBinding.blockId, progress: "active" }] }] },
  });
  mocks.read.mockResolvedValue(session());
  mocks.parse.mockReturnValue({
    chapters: [
      { blocks: [{ id: syntheticBinding.blockId, presentation: { spatialMoment: syntheticSpatialMoment() } }] },
    ],
  });
  mocks.txRead.mockResolvedValue(session());
  mocks.membership.mockResolvedValue({ id: "membership-1" });
  mocks.observation.mockImplementation(async ({ create }) => ({ ...create, id: "observation-row" }));
  mocks.transaction.mockImplementation(async (action) =>
    action({
      taleSession: { findUnique: mocks.txRead },
      playthroughMembership: { findFirst: mocks.membership },
      parallaxObservation: { upsert: mocks.observation },
    }),
  );
});
describe("Parallax released publication and isolated persistence", () => {
  it("loads only a released pinned moment through the canonical projection", async () => {
    const bound = await loadReleasedSpatialMoment(
      syntheticBinding.sessionId,
      syntheticBinding.actorId,
      syntheticBinding.blockId,
    );
    expect(bound.binding.chronicleVersionId).toBe(syntheticBinding.chronicleVersionId);
    expect(bound.replayOnly).toBe(false);
    expect(mocks.projection).toHaveBeenCalledWith(syntheticBinding.sessionId, undefined, false, true);
  });
  it("does not inspect an unreleased snapshot", async () => {
    mocks.projection.mockResolvedValue({ journal: { chapters: [] } });
    await expect(
      loadReleasedSpatialMoment(syntheticBinding.sessionId, syntheticBinding.actorId, syntheticBinding.blockId),
    ).rejects.toThrow("PARALLAX_PASSAGE_NOT_RELEASED");
    expect(mocks.read).not.toHaveBeenCalled();
  });
  it("rejects preview and cross-Chronicle version binding", async () => {
    for (const value of [
      { ...session(), previewMode: true },
      { ...session(), publishedVersionId: "another-edition" },
    ]) {
      mocks.read.mockResolvedValue(value);
      await expect(
        loadReleasedSpatialMoment(syntheticBinding.sessionId, syntheticBinding.actorId, syntheticBinding.blockId),
      ).rejects.toThrow("PARALLAX_PUBLISHED_SESSION_REQUIRED");
    }
  });
  it("stores only a nonauthoritative observation, returning no progression mutation", async () => {
    const result = await recordSpatialObservation(
      syntheticBinding.sessionId,
      syntheticBinding.actorId,
      await receipt(),
    );
    expect(result).toEqual({
      observationId: "observation-row",
      disposition: "OBSERVED_ONLY",
      progressionChanged: false,
      physicalQualification: "NOT_ESTABLISHED",
    });
    expect(mocks.observation.mock.calls[0][0].update).toEqual({});
    expect(mocks.observation.mock.calls[0][0].create).not.toHaveProperty("currentBlockId");
  });
  it("keeps released historical passages presentation-only", async () => {
    mocks.read.mockResolvedValue({ ...session(), currentBlockId: "next-passage" });
    await expect(
      recordSpatialObservation(syntheticBinding.sessionId, syntheticBinding.actorId, await receipt()),
    ).rejects.toThrow("PARALLAX_REPLAY_PRESENTATION_ONLY");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("rechecks progression scope and membership before an observation write", async () => {
    mocks.txRead.mockResolvedValue({ ...session(), currentBlockId: "next-passage" });
    await expect(
      recordSpatialObservation(syntheticBinding.sessionId, syntheticBinding.actorId, await receipt()),
    ).rejects.toThrow("PARALLAX_EVIDENCE_SCOPE_CHANGED");
    expect(mocks.observation).not.toHaveBeenCalled();
    mocks.txRead.mockResolvedValue(session());
    mocks.membership.mockResolvedValue(null);
    await expect(
      recordSpatialObservation(syntheticBinding.sessionId, syntheticBinding.actorId, await receipt()),
    ).rejects.toThrow("PARALLAX_MEMBERSHIP_CHANGED");
    expect(mocks.observation).not.toHaveBeenCalled();
  });
  it("rejects mismatched idempotent retry evidence", async () => {
    mocks.observation.mockResolvedValue({ id: "existing", receiptDigest: "different" });
    await expect(
      recordSpatialObservation(syntheticBinding.sessionId, syntheticBinding.actorId, await receipt()),
    ).rejects.toThrow("PARALLAX_IDEMPOTENCY_CONFLICT");
  });
});
