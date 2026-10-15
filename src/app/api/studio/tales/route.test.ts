import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
const { authorize, create } = vi.hoisted(() => ({ authorize: vi.fn(), create: vi.fn() }));
vi.mock("@/chronicle/studio-authorization", () => ({ requireStudioWorkspace: authorize }));
vi.mock("@/chronicle/studio-service", () => ({ createStudioTale: create, listStudioTales: vi.fn() }));
vi.mock("@/chronicle/api", () => ({
  apiError: (error: Error) => Response.json({ error: error.message }, { status: 400 }),
}));
afterEach(() => vi.resetAllMocks());
const request = (body: unknown) =>
  new Request("http://localhost/api/studio/tales", { method: "POST", body: JSON.stringify(body) });
describe("canonical manual Chronicle creation", () => {
  it("uses unique server addresses, default title and the authorized account", async () => {
    authorize.mockResolvedValue({ accountId: "owner" });
    create.mockResolvedValue({ id: "chronicle" });
    expect((await POST(request({ creationMode: "MANUAL", creatorId: "foreign", title: "ignored" }))).status).toBe(201);
    expect((await POST(request({ creationMode: "MANUAL" }))).status).toBe(201);
    expect(create.mock.calls[0][0]).toMatchObject({
      title: "Untitled Chronicle",
      creatorId: "owner",
      slug: expect.stringMatching(/^chronicle-[a-f0-9-]{36}$/),
    });
    expect(create.mock.calls[0][0].slug).not.toBe(create.mock.calls[1][0].slug);
  });
  it("refuses unavailable creation modes without creating a draft", async () => {
    authorize.mockResolvedValue({ accountId: "owner" });
    for (const creationMode of ["AI", "STORY", "TEMPLATE"])
      expect((await POST(request({ creationMode }))).status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });
  it("retains authorization and legacy creation requests", async () => {
    authorize.mockResolvedValue(null);
    expect((await POST(request({ creationMode: "MANUAL" }))).status).toBe(401);
    expect(create).not.toHaveBeenCalled();
    authorize.mockResolvedValue({ accountId: "owner" });
    create.mockResolvedValue({ id: "legacy" });
    expect(
      (await POST(request({ title: "Existing integration", slug: "legacy-integration", creatorId: "foreign" }))).status,
    ).toBe(201);
    expect(create).toHaveBeenCalledWith({
      title: "Existing integration",
      slug: "legacy-integration",
      creatorId: "owner",
    });
  });
});
