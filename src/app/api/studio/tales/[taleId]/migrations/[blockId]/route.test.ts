import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ authorization: vi.fn(), studio: vi.fn(), preview: vi.fn() }));

vi.mock("@/chronicle/studio-authorization", () => ({ requireOwnedStudioTale: mocks.authorization }));
vi.mock("@/chronicle/studio-service", () => ({ getStudioTale: mocks.studio }));
vi.mock("@/drydock/migration-preview", () => ({ previewDrydockMigration: mocks.preview }));

import { GET } from "./route";

const context = { params: Promise.resolve({ taleId: "tale-1", blockId: "block-1" }) };
const studio = {
  draft: {
    autosaveVersion: 7,
    chapters: [
      {
        blocks: [
          {
            id: "block-1",
            blockType: "narrative",
            schemaVersion: 1,
            configuration: {},
            presentation: {},
            completion: {},
          },
        ],
      },
    ],
  },
};

describe("Shipwright Drydock migration preview route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authorization.mockResolvedValue({ session: { accountId: "creator-1" } });
    mocks.studio.mockResolvedValue(studio);
    mocks.preview.mockReturnValue({
      sourceVersion: 1,
      targetVersion: 2,
      migrationIds: ["drydock.narrative.v1-to-v2"],
      warnings: [],
      affectedFields: ["schemaVersion"],
      dataLoss: ["NONE"],
      canonicalOutputChanges: ["CANONICAL_OUTPUT_CHANGES"],
      after: { schemaVersion: 2, configuration: {}, presentation: {}, completion: {} },
    });
  });

  it("does not disclose a migration preview outside the Creator-owned Chronicle", async () => {
    mocks.authorization.mockResolvedValueOnce(null);
    const response = await GET(new Request("http://localhost/migration?autosaveVersion=7"), context);
    expect(response.status).toBe(404);
    expect(mocks.studio).not.toHaveBeenCalled();
    expect(mocks.preview).not.toHaveBeenCalled();
  });

  it("rejects a stale preview request before it reads or transforms a Passage", async () => {
    const response = await GET(new Request("http://localhost/migration?autosaveVersion=6"), context);
    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe("DRAFT_CONFLICT");
    expect(mocks.preview).not.toHaveBeenCalled();
  });

  it("returns only a private, current canonical preview for the owned draft", async () => {
    const response = await GET(new Request("http://localhost/migration?autosaveVersion=7"), context);
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(mocks.authorization).toHaveBeenCalledWith("tale-1");
    expect(mocks.preview).toHaveBeenCalledWith(studio.draft.chapters[0].blocks[0]);
    expect((await response.json()).preview).toMatchObject({ sourceVersion: 1, targetVersion: 2 });
  });
});
