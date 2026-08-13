import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authorization: vi.fn(),
  list: vi.fn(),
  create: vi.fn(),
  createPreset: vi.fn(),
  createFragment: vi.fn(),
  createTemplate: vi.fn(),
  getVersion: vi.fn(),
  planInsert: vi.fn(),
  archive: vi.fn(),
}));
vi.mock("@/chronicle/studio-authorization", () => ({ requireOwnedStudioTale: mocks.authorization }));
vi.mock("@/chronicle/api", () => ({ apiError: () => new Response(null, { status: 400 }) }));
vi.mock("@/studio/reusable-library-service", () => ({
  listReusableAuthoringItems: mocks.list,
  createReusableAuthoringItem: mocks.create,
  createBlockPreset: mocks.createPreset,
  createBlockFragment: mocks.createFragment,
  createChapterTemplate: mocks.createTemplate,
  getReusableAuthoringItemVersion: mocks.getVersion,
  planReusableAuthoringInsertion: mocks.planInsert,
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

  it("returns a reusable envelope only through its owner-scoped Library identity", async () => {
    mocks.getVersion.mockResolvedValueOnce({ itemId: "item-1", versionId: "version-1", envelope: { kind: "PRESET" } });
    const response = await GET(new Request("http://localhost/reusable?itemId=item-1"), context);
    expect(response.status).toBe(200);
    expect(mocks.getVersion).toHaveBeenCalledWith("creator-1", "item-1");
  });

  it("derives a reusable fragment only from persisted selected Passage identities", async () => {
    mocks.createFragment.mockResolvedValueOnce({ itemId: "item-1", versionId: "version-1", versionNumber: 1 });
    const response = await POST(
      new Request("http://localhost/reusable", {
        method: "POST",
        body: JSON.stringify({ action: "create-fragment", name: "Opening fragment", blockIds: ["block-1", "block-2"] }),
      }),
      context,
    );
    expect(response.status).toBe(201);
    expect(mocks.createFragment).toHaveBeenCalledWith("creator-1", "tale-1", {
      action: "create-fragment",
      name: "Opening fragment",
      blockIds: ["block-1", "block-2"],
    });
  });

  it("delegates fragment insertion planning to the owner-scoped server path", async () => {
    mocks.planInsert.mockResolvedValueOnce({ operationId: "operation-1", chapters: [] });
    const response = await POST(
      new Request("http://localhost/reusable", {
        method: "POST",
        body: JSON.stringify({
          action: "plan-insert",
          itemId: "reusable-1",
          operationId: "operation-1",
          targetChapterId: "chapter-1",
          draft: { chapters: [] },
        }),
      }),
      context,
    );
    expect(response.status).toBe(200);
    expect(mocks.planInsert).toHaveBeenCalledWith(
      expect.objectContaining({ ownerAccountId: "creator-1", itemId: "reusable-1", targetChapterId: "chapter-1" }),
    );
  });

  it("derives a Chapter template only from the persisted selected Chapter identity", async () => {
    mocks.createTemplate.mockResolvedValueOnce({ itemId: "item-1", versionId: "version-1", versionNumber: 1 });
    const response = await POST(
      new Request("http://localhost/reusable", {
        method: "POST",
        body: JSON.stringify({ action: "create-chapter-template", name: "Opening template", chapterId: "chapter-1" }),
      }),
      context,
    );
    expect(response.status).toBe(201);
    expect(mocks.createTemplate).toHaveBeenCalledWith("creator-1", "tale-1", {
      action: "create-chapter-template",
      name: "Opening template",
      chapterId: "chapter-1",
    });
  });
});
