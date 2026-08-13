import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authorization: vi.fn(),
  list: vi.fn(),
  create: vi.fn(),
  createPreset: vi.fn(),
  archive: vi.fn(),
}));
vi.mock("@/chronicle/studio-authorization", () => ({ requireOwnedStudioTale: mocks.authorization }));
vi.mock("@/chronicle/api", () => ({ apiError: () => new Response(null, { status: 400 }) }));
vi.mock("@/studio/reusable-library-service", () => ({
  listReusableAuthoringItems: mocks.list,
  createReusableAuthoringItem: mocks.create,
  createBlockPreset: mocks.createPreset,
  archiveReusableAuthoringItem: mocks.archive,
}));

import { GET, POST } from "./route";

const context = { params: Promise.resolve({ taleId: "tale-1" }) };

describe("reusable authoring content route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authorization.mockResolvedValue({ session: { accountId: "creator-1" } });
  });

  it("does not disclose the Creator Library across Chronicle boundaries", async () => {
    mocks.authorization.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    expect((await GET(new Request("http://localhost/reusable"), context)).status).toBe(404);
    expect((await POST(new Request("http://localhost/reusable", { method: "POST" }), context)).status).toBe(404);
    expect(mocks.list).not.toHaveBeenCalled();
    expect(mocks.createPreset).not.toHaveBeenCalled();
  });

  it("saves a preset only from a persisted, authorized block identity", async () => {
    mocks.createPreset.mockResolvedValueOnce({ itemId: "item-1", versionId: "version-1", versionNumber: 1 });
    const response = await POST(
      new Request("http://localhost/reusable", {
        method: "POST",
        body: JSON.stringify({ action: "create-preset", name: "Opening preset", blockId: "block-1" }),
      }),
      context,
    );
    expect(response.status).toBe(201);
    expect(mocks.createPreset).toHaveBeenCalledWith("creator-1", "tale-1", {
      action: "create-preset",
      name: "Opening preset",
      blockId: "block-1",
    });
  });
});
