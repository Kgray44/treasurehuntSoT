import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authorization: vi.fn(),
  projection: vi.fn(),
}));

vi.mock("@/chronicle/captain-authorization", () => ({ requireCaptainSession: mocks.authorization }));
vi.mock("@/helm/operations", () => ({ getCaptainVoyageProjection: mocks.projection }));

import { POST } from "./route";

const context = { params: Promise.resolve({ voyageId: "voyage-1" }) };
const authorization = {
  actor: { accountId: "captain-account", legacyGameMasterId: null },
};
const moveCommand = {
  id: "MOVE_TO_PASSAGE",
  action: "jump",
  label: "Move Crew to Passage",
  description: "Move Crew",
  risk: "HIGH",
  reversible: false,
  playersSeeResult: true,
  consequence: "Moved",
  warning: "Recorded",
  requiresConfirmation: true,
  requiresReason: true,
  target: "PASSAGE",
};
const projection = {
  voyage: { voyageName: "Synthetic Voyage", lifecycle: "ACTIVE" },
  progress: { currentSequence: 7, currentChapter: "First Light", currentCheckpoint: "Harbor Gate" },
  commandConsole: {
    commands: [moveCommand],
    progressMap: [
      { id: "block-current", state: "CURRENT", title: "Harbor Gate", chapterTitle: "First Light" },
      { id: "block-next", state: "UPCOMING", title: "Moon Path", chapterTitle: "First Light" },
    ],
  },
};

function request(body: Record<string, unknown>) {
  return new Request("https://example.test/api/captain/voyages/voyage-1/commands/preview", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("Helm Phase 3 Captain command preview route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authorization.mockResolvedValue(authorization);
    mocks.projection.mockResolvedValue(projection);
  });

  it("denies an ordinary Player before revealing a command preview", async () => {
    mocks.authorization.mockResolvedValue(null);
    expect((await POST(request({ commandId: "MOVE_TO_PASSAGE", targetBlockId: "block-next" }), context)).status).toBe(
      403,
    );
    expect(mocks.projection).not.toHaveBeenCalled();
  });

  it("returns the current canonical revision and a published Passage target", async () => {
    const response = await POST(request({ commandId: "MOVE_TO_PASSAGE", targetBlockId: "block-next" }), context);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      command: { id: "MOVE_TO_PASSAGE" },
      target: { id: "block-next", title: "Moon Path" },
      currentState: { expectedSequence: 7, lifecycle: "ACTIVE", passage: "Harbor Gate" },
    });
  });

  it("will not prepare a command to the already-current Passage", async () => {
    expect(
      (await POST(request({ commandId: "MOVE_TO_PASSAGE", targetBlockId: "block-current" }), context)).status,
    ).toBe(400);
  });
});
