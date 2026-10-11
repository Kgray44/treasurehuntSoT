import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  workspace: vi.fn(),
  owned: vi.fn(),
  list: vi.fn(),
  save: vi.fn(),
  release: vi.fn(),
  attach: vi.fn(),
  access: vi.fn(),
  studio: vi.fn(),
}));
vi.mock("@/chronicle/studio-authorization", () => ({
  requireStudioWorkspace: mocks.workspace,
  requireOwnedStudioTale: mocks.owned,
}));
vi.mock("@/chronicle/studio-service", () => ({ getStudioTale: mocks.studio }));
vi.mock("@/chronicle/api", () => ({
  apiError: (cause: Error) => Response.json({ error: cause.message }, { status: 400 }),
}));
vi.mock("@/parallax/library-service", () => ({
  listSpatialItems: mocks.list,
  saveSpatialDraft: mocks.save,
  releaseSpatialVersion: mocks.release,
  attachSpatialVersion: mocks.attach,
  assertSpatialDraftAccess: mocks.access,
}));
import { GET, POST } from "./route";
import { createSpatialDraft } from "@/parallax/authoring";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.workspace.mockResolvedValue({ accountId: "synthetic-creator", csrfToken: "csrf" });
  mocks.list.mockResolvedValue([]);
  mocks.save.mockResolvedValue(1);
  mocks.owned.mockResolvedValue(null);
});
it("returns no private data without Creator access and refuses unauthorized Chronicles", async () => {
  mocks.workspace.mockResolvedValueOnce(null);
  expect((await GET(new Request("https://example.test/api/studio/parallax"))).status).toBe(401);
  expect(mocks.list).not.toHaveBeenCalled();
  expect((await GET(new Request("https://example.test/api/studio/parallax?chronicle=foreign"))).status).toBe(404);
  expect(mocks.studio).not.toHaveBeenCalled();
});
it("binds owner and CSRF checks to mutations and provides private no-store reads", async () => {
  const get = await GET(new Request("https://example.test/api/studio/parallax"));
  expect(get.headers.get("cache-control")).toContain("no-store");
  expect(mocks.list).toHaveBeenCalledWith("synthetic-creator");
  const request = new Request("https://example.test/api/studio/parallax", {
    method: "POST",
    headers: { "x-csrf-token": "csrf" },
    body: JSON.stringify({ action: "SAVE", draft: createSpatialDraft("owned"), revision: 0 }),
  });
  expect((await POST(request)).status).toBe(200);
  expect(mocks.workspace).toHaveBeenLastCalledWith(request);
  expect(mocks.save.mock.calls[0][0]).toBe("synthetic-creator");
  mocks.workspace.mockResolvedValue(null);
  expect((await POST(new Request(request.url, { method: "POST", body: "{}" }))).status).toBe(401);
});
it("rejects excessive input, unknown fields and executable behaviors before storage", async () => {
  expect(
    (await POST(new Request("https://example.test/api/studio/parallax", { method: "POST", body: "x".repeat(262145) })))
      .status,
  ).toBe(413);
  const draft = createSpatialDraft("owned");
  const response = await POST(
    new Request("https://example.test/api/studio/parallax", {
      method: "POST",
      body: JSON.stringify({ action: "SAVE", draft, revision: 0, ownerAccountId: "attacker" }),
    }),
  );
  expect(response.status).toBe(400);
  expect(mocks.save).not.toHaveBeenCalled();
});
