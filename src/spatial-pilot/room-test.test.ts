// @sounding-line-registration owner=spatial-pilot suite=unit.spatial-pilot contracts=spatial-pilot.experience
// @vitest-environment node
import { createHash } from "node:crypto";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { draftSchema } from "@/parallax/authoring";
import { evaluateSpatialScene } from "@/parallax/behavior";

const mocks = vi.hoisted(() => ({
  readFile: vi.fn(),
  findChronicle: vi.fn(),
  uniqueChronicle: vi.fn(),
  findVoyage: vi.fn(),
  createTale: vi.fn(),
  getTale: vi.fn(),
  saveTale: vi.fn(),
  snapshot: vi.fn(),
  checksum: vi.fn(),
  saveSpatial: vi.fn(),
  releaseSpatial: vi.fn(),
  attachSpatial: vi.fn(),
  saveScenario: vi.fn(),
  saveSuite: vi.fn(),
  runSuite: vi.fn(),
  publish: vi.fn(),
  invite: vi.fn(),
  launch: vi.fn(),
}));
vi.mock("node:fs/promises", () => ({ readFile: mocks.readFile }));
vi.mock("@/lib/db", () => ({
  db: {
    chronicle: { findFirst: mocks.findChronicle, findUniqueOrThrow: mocks.uniqueChronicle },
    taleSession: { findFirst: mocks.findVoyage },
  },
}));
vi.mock("@/chronicle/studio-service", () => ({
  createStudioTale: mocks.createTale,
  getStudioTale: mocks.getTale,
  saveStudioDraft: mocks.saveTale,
}));
vi.mock("@/chronicle/snapshot", () => ({
  snapshotFromStudio: mocks.snapshot,
  publishedSourceChecksum: mocks.checksum,
}));
vi.mock("@/chronicle/publishing", () => ({ publishTale: mocks.publish }));
vi.mock("@/platform/invitations", () => ({ createPlaythroughAndInvitations: mocks.invite }));
vi.mock("@/chronicle/progression", () => ({ launchTalePlaythrough: mocks.launch }));
vi.mock("@/drydock/scenario-store", () => ({ saveDrydockScenario: mocks.saveScenario }));
vi.mock("@/drydock/suite-store", () => ({
  saveDrydockScenarioSuite: mocks.saveSuite,
  runDrydockScenarioSuite: mocks.runSuite,
}));
vi.mock("@/parallax/library-service", () => ({
  saveSpatialDraft: mocks.saveSpatial,
  releaseSpatialVersion: mocks.releaseSpatial,
  attachSpatialVersion: mocks.attachSpatial,
}));
vi.mock("@/wayfarer/http", () => ({ requireWayfarerAccount: vi.fn() }));
import { provisionRoomTest } from "./room-test";

// Invented test metadata only. This is never written to the private owner asset.
const observation = {
  status: "OBSERVED",
  explanation: "Synthetic bedroom metadata for publication boundaries.",
  clarification: null,
  alignment: "INITIAL_ROOM",
  sharedFeatureId: null,
  roomDimensions: [6, 3, 5],
  dimensionBasis: "ESTIMATED",
  uncertainties: ["All dimensions are synthetic estimates."],
  features: [
    {
      matchedFeatureId: null,
      classification: "DESK",
      name: "Synthetic writing desk",
      position: { x: 1, y: 0.4, z: -1 },
      dimensions: [1.4, 0.8, 0.8],
      yawDegrees: 0,
      basis: "DIRECTLY_OBSERVED",
      confidence: 0.8,
    },
    {
      matchedFeatureId: null,
      classification: "BED",
      name: "Synthetic bed",
      position: { x: -1.3, y: 0.3, z: 0 },
      dimensions: [1.2, 0.6, 1.9],
      yawDegrees: 0,
      basis: "DIRECTLY_OBSERVED",
      confidence: 0.8,
    },
  ],
};
const bytes = Buffer.from(JSON.stringify(observation));
const digest = createHash("sha256").update(bytes).digest("hex");
const owner = "spatial-pilot-navigator";
const origin = "https://browser-ar.example.test";

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("DATABASE_URL", "file:C:/owned/artifacts/spatial-pilot/room.db");
  vi.stubEnv("SPATIAL_PILOT_ENABLED", "1");
  vi.stubEnv("SPATIAL_PILOT_OWNER_ID", owner);
  vi.stubEnv("PARALLAX_ROOM_TEST_ENABLED", "1");
  mocks.readFile.mockResolvedValue(bytes);
  const tale = { id: "haunted-chronicle", latestPublishedVersionId: null };
  const releasedTale = { ...tale, latestPublishedVersionId: "chronicle-edition-1" };
  mocks.findChronicle.mockResolvedValueOnce(null).mockResolvedValue(releasedTale);
  mocks.uniqueChronicle.mockResolvedValueOnce(tale).mockResolvedValue(releasedTale);
  mocks.findVoyage.mockResolvedValueOnce(null).mockResolvedValue({ id: "canonical-voyage", status: "ACTIVE" });
  mocks.createTale.mockResolvedValue(tale);
  mocks.getTale.mockResolvedValue({
    tale: { id: tale.id, title: "The Haunted Bedroom" },
    draft: { chapters: [{ id: "chapter-one", blocks: [] }], autosaveVersion: 4 },
  });
  mocks.snapshot.mockReturnValue({ chapters: [] });
  mocks.checksum.mockReturnValue("a".repeat(64));
  mocks.saveSpatial.mockResolvedValue(1);
  mocks.releaseSpatial.mockResolvedValue({ version: { id: "spatial-edition-1" } });
  mocks.invite.mockResolvedValue({ playthroughId: "canonical-voyage" });
});
afterEach(() => vi.unstubAllEnvs());

it("requires the exact owned Haunted Bedroom asset and never substitutes another room", async () => {
  mocks.readFile.mockRejectedValue(Object.assign(new Error("private OS details"), { code: "ENOENT" }));
  await expect(provisionRoomTest(owner, origin, "HAUNTED_BEDROOM", digest)).rejects.toThrow(
    "tmp/haunted-bedroom-observation.private.json",
  );
  expect(mocks.readFile.mock.calls).toEqual([["tmp/haunted-bedroom-observation.private.json"]]);
  expect(mocks.findChronicle).not.toHaveBeenCalled();
  expect(mocks.saveSpatial).not.toHaveBeenCalled();
});

it("requires review of the exact estimated observation before any Chronicle mutation", async () => {
  await expect(provisionRoomTest(owner, origin, "HAUNTED_BEDROOM")).rejects.toThrow("reviewedObservationSha256");
  await expect(provisionRoomTest(owner, origin, "HAUNTED_BEDROOM", "b".repeat(64))).rejects.toThrow(
    "reviewedObservationSha256",
  );
  expect(mocks.findChronicle).not.toHaveBeenCalled();
  expect(mocks.createTale).not.toHaveBeenCalled();
});

it("rejects invalid private metadata without echoing its contents or creating a fallback", async () => {
  const malformed = Buffer.from('{"privateRoomText": "DO_NOT_ECHO",');
  mocks.readFile.mockResolvedValue(malformed);
  await expect(
    provisionRoomTest(owner, origin, "HAUNTED_BEDROOM", createHash("sha256").update(malformed).digest("hex")),
  ).rejects.toThrow("The retained room observation is invalid.");
  expect(mocks.createTale).not.toHaveBeenCalled();
});

it("publishes the reconstructed Scene through canonical services with an animated, inspectable letter", async () => {
  const result = await provisionRoomTest(owner, origin, "HAUNTED_BEDROOM", digest);
  const draft = draftSchema.parse(mocks.saveSpatial.mock.calls[0][1]);
  const letter = draft.content.entities[0];
  const room = draft.content.studio!.environment!;
  expect(room.features.some((feature) => feature.classification === "BED")).toBe(true);
  expect(room.features.some((feature) => feature.classification === "DESK")).toBe(true);
  expect(letter.interactions).toEqual(["PICK", "INSPECT"]);
  expect(evaluateSpatialScene(draft.content, [], 0).states[letter.id].opacity).toBe(0);
  expect(evaluateSpatialScene(draft.content, [], 5000).states[letter.id].opacity).toBe(1);
  expect(
    evaluateSpatialScene(draft.content, [{ trigger: "INSPECT", entityId: letter.id, atMs: 5000 }], 5000).states[
      letter.id
    ].highlighted,
  ).toBe(true);
  const chronicleDraft = mocks.saveTale.mock.calls[0][1];
  expect(chronicleDraft.chapters[0].blocks[0].completion).toEqual({ mode: "playerConfirmation" });
  expect(chronicleDraft.chapters[0].blocks[0].configuration.body).toContain("dimensions are estimates");
  expect(mocks.releaseSpatial).toHaveBeenCalledWith(owner, draft.content.definitionId, 1);
  expect(mocks.attachSpatial).toHaveBeenCalledWith(
    expect.objectContaining({
      versionId: "spatial-edition-1",
      chronicleId: "haunted-chronicle",
      blockId: "haunted-chronicle:lens",
    }),
  );
  expect(mocks.runSuite.mock.invocationCallOrder[0]).toBeLessThan(mocks.publish.mock.invocationCallOrder[0]);
  expect(mocks.invite).toHaveBeenCalledWith(
    expect.objectContaining({ versionId: "chronicle-edition-1", testVoyage: true }),
    owner,
    origin,
  );
  expect(mocks.launch).toHaveBeenCalledWith("canonical-voyage", owner);
  expect(result?.journalHref).toBe("/player/playthroughs/canonical-voyage/journal");
});

it("retains the publication gate when the canonical Drydock run fails", async () => {
  mocks.runSuite.mockRejectedValue(new Error("Synthetic verification failed"));
  await expect(provisionRoomTest(owner, origin, "HAUNTED_BEDROOM", digest)).rejects.toThrow(
    "Synthetic verification failed",
  );
  expect(mocks.publish).not.toHaveBeenCalled();
  expect(mocks.invite).not.toHaveBeenCalled();
  expect(mocks.launch).not.toHaveBeenCalled();
});

it("rejects another account or a disabled room test before reading private metadata", async () => {
  await expect(provisionRoomTest("another-owner", origin, "HAUNTED_BEDROOM", digest)).rejects.toThrow("not enabled");
  vi.stubEnv("PARALLAX_ROOM_TEST_ENABLED", "0");
  await expect(provisionRoomTest(owner, origin, "HAUNTED_BEDROOM", digest)).rejects.toThrow("not enabled");
  expect(mocks.readFile).not.toHaveBeenCalled();
});
