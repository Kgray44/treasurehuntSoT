import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  find: vi.fn(),
  create: vi.fn(),
  claim: vi.fn(),
  createVersion: vi.fn(),
  findVersion: vi.fn(),
  list: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  db: {
    reusableAuthoringItem: { findMany: mocks.list, findUnique: mocks.find },
    reusableAuthoringItemVersion: { findFirst: mocks.findVersion },
    $transaction: async (run: (tx: unknown) => unknown) =>
      run({
        reusableAuthoringItem: { findUnique: mocks.find, create: mocks.create, updateMany: mocks.claim },
        reusableAuthoringItemVersion: { create: mocks.createVersion, findFirst: mocks.findVersion },
      }),
  },
}));
vi.mock("@/chronicle/studio-service", () => ({
  DraftConflictError: class extends Error {
    constructor(public currentVersion: number) {
      super("Revision conflict");
    }
  },
}));
import {
  assertSceneEnvironment,
  builtinEnvironments,
  listEnvironments,
  resolveEnvironment,
  saveEnvironment,
} from "./environment-service";
import { createEnvironmentScene, environmentFromBaseline } from "./environment-authoring";
import { canonicalChecksum } from "@/drydock/canonical";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.find.mockResolvedValue(null);
  mocks.claim.mockResolvedValue({ count: 1 });
  mocks.list.mockResolvedValue([]);
});
describe("owned append-only Environment persistence", () => {
  it("creates a real reusable item with a pinned, checksummed first revision", async () => {
    const content = environmentFromBaseline("room", "bedroom", "The Haunted Bedroom");
    const saved = await saveEnvironment("creator", content, 0);
    expect(saved.reference).toEqual({
      environmentId: "room",
      versionId: "room:e1",
      revision: 1,
      checksum: canonicalChecksum(content),
    });
    expect(mocks.create.mock.calls[0][0].data).toMatchObject({
      ownerAccountId: "creator",
      kind: "PARALLAX_ENVIRONMENT",
      currentVersionNumber: 1,
    });
    expect(JSON.parse(mocks.create.mock.calls[0][0].data.versions.create.envelope)).toEqual(saved);
  });
  it("claims the exact Environment revision before appending and refuses stale writers", async () => {
    mocks.find.mockResolvedValue({
      id: "room",
      ownerAccountId: "creator",
      kind: "PARALLAX_ENVIRONMENT",
      currentVersionNumber: 1,
      archivedAt: null,
    });
    await saveEnvironment("creator", environmentFromBaseline("room"), 1);
    expect(mocks.claim.mock.calls[0][0].where).toMatchObject({
      id: "room",
      ownerAccountId: "creator",
      currentVersionNumber: 1,
    });
    expect(mocks.createVersion.mock.calls[0][0].data.versionNumber).toBe(2);
    mocks.claim.mockResolvedValue({ count: 0 });
    await expect(saveEnvironment("creator", environmentFromBaseline("room"), 1)).rejects.toThrow(/conflict/);
    expect(mocks.createVersion).toHaveBeenCalledTimes(1);
  });
  it("rejects a foreign Environment and immutable built-in mutation", async () => {
    mocks.find.mockResolvedValue({ ownerAccountId: "other", kind: "PARALLAX_ENVIRONMENT" });
    await expect(saveEnvironment("creator", environmentFromBaseline("room"), 1)).rejects.toThrow(/unavailable/);
    await expect(saveEnvironment("creator", builtinEnvironments()[0].current.content, 1)).rejects.toThrow(/immutable/);
    expect(mocks.claim).not.toHaveBeenCalled();
  });
  it("validates every saved revision and never resolves a pin through latest", async () => {
    const first = await saveEnvironment("creator", environmentFromBaseline("room"), 0);
    mocks.list.mockResolvedValue([
      {
        id: "room",
        currentVersionNumber: 1,
        versions: [
          { id: "room:e1", versionNumber: 1, envelope: JSON.stringify(first), checksum: first.reference.checksum },
        ],
      },
    ]);
    expect((await listEnvironments("creator"))[0].current).toEqual(first);
    mocks.find.mockResolvedValue({
      id: "room",
      ownerAccountId: "creator",
      kind: "PARALLAX_ENVIRONMENT",
      currentVersionNumber: 7,
    });
    mocks.findVersion.mockResolvedValue({
      id: "room:e1",
      versionNumber: 1,
      envelope: JSON.stringify(first),
      checksum: first.reference.checksum,
    });
    expect(await resolveEnvironment("creator", first.reference)).toEqual(first);
    expect(mocks.findVersion.mock.calls[0][0].where.versionNumber).toBe(1);
    await expect(resolveEnvironment("creator", { ...first.reference, checksum: "0".repeat(64) })).rejects.toThrow(
      /checksum/,
    );
  });
  it("checks referenced geometry without allowing a fabricated built-in pin", async () => {
    const builtin = builtinEnvironments()[0].current;
    const draft = createEnvironmentScene("scene", "First", builtin);
    await expect(assertSceneEnvironment("creator", draft)).resolves.toBeUndefined();
    draft.content.environment!.revision = 9;
    await expect(assertSceneEnvironment("creator", draft)).rejects.toThrow(/pin/);
  });
});
