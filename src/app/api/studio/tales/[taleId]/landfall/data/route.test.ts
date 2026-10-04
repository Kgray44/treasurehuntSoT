import { beforeEach, describe, expect, it, vi } from "vitest";
import { landfallFixture } from "@/landfall/fixtures";
const mocks = vi.hoisted(() => ({ authorize: vi.fn(), draft: vi.fn(), rate: vi.fn(), execute: vi.fn() }));
vi.mock("@/chronicle/studio-authorization", () => ({ requireOwnedStudioTale: mocks.authorize }));
vi.mock("@/landfall/definition-store", () => ({ getDraftLandfallDefinition: mocks.draft }));
vi.mock("@/lib/rate-limit", () => ({ consumeRateLimit: mocks.rate }));
vi.mock("@/landfall/remote-data-deployment-server", () => ({
  deployedLandfallRemoteData: {
    execute: mocks.execute,
    recipient: (operation: string) => (operation === "STATUS" ? null : "geo.example.test"),
  },
}));
import { POST } from "./route";
const definition = structuredClone(landfallFixture);
definition.worldspaces[0].privacyPolicy.classification = "PUBLIC_REAL_WORLD";
const draft = { draftId: "synthetic-draft", autosaveVersion: 4, definition };
const context = { params: Promise.resolve({ taleId: "synthetic-tale" }) };
const search = { operation: "SEARCH", consent: true, query: "Synthetic Square", limit: 5 };
const send = (input: unknown, overrides: Record<string, string> = {}) =>
  POST(
    new Request("https://example.test/lookup", {
      method: "POST",
      headers: {
        "x-csrf-token": "synthetic-csrf",
        "x-landfall-worldspace": "town",
        "x-landfall-draft-version": "4",
        "x-landfall-recipient": "geo.example.test",
        ...overrides,
      },
      body: JSON.stringify(input),
    }),
    context,
  );
beforeEach(() => {
  vi.clearAllMocks();
  mocks.authorize.mockResolvedValue({ session: { accountId: "synthetic-creator" } });
  mocks.draft.mockImplementation(async () => structuredClone(draft));
  mocks.rate.mockReturnValue({ allowed: true });
  mocks.execute.mockResolvedValue({ state: "NOT_CONFIGURED", canComplete: false });
});
describe("deliberate Creator text lookup", () => {
  it("uses the existing owner and CSRF guard before draft or provider work", async () => {
    mocks.authorize.mockResolvedValueOnce(null);
    expect((await send(search)).status).toBe(404);
    expect(mocks.authorize).toHaveBeenCalledWith("synthetic-tale", expect.any(Request));
    expect(mocks.draft).not.toHaveBeenCalled();
    expect(mocks.execute).not.toHaveBeenCalled();
  });
  it("bounds current saved public physical scope and the reviewed recipient", async () => {
    const cases: Record<string, string>[] = [
      { "x-landfall-draft-version": "3" },
      { "x-landfall-worldspace": "isles" },
      { "x-landfall-recipient": "other.example.test" },
    ];
    for (const overrides of cases) expect((await send(search, overrides)).status).toBe(409);
    const privateDraft = structuredClone(draft);
    privateDraft.definition.worldspaces[0].privacyPolicy.classification = "PRIVATE_REAL_WORLD";
    mocks.draft.mockResolvedValueOnce(privateDraft);
    expect((await send(search)).status).toBe(409);
    expect(mocks.execute).not.toHaveBeenCalled();
  });
  it("rejects implicit consent, coordinate sharing and destination overrides", async () => {
    for (const input of [
      { ...search, consent: false },
      { ...search, url: "https://private.example.test" },
      { ...search, proximity: { latitude: 40, longitude: -75 } },
      { operation: "REVERSE", consent: true, point: { latitude: 40, longitude: -75 } },
    ])
      expect((await send(input)).status).toBe(400);
    expect((await send({ ...search, query: "x".repeat(8193) })).status).toBe(413);
    expect(mocks.execute).not.toHaveBeenCalled();
  });
  it("returns private bounded output without saving and discards late draft/access changes", async () => {
    const response = await send(search);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ state: "NOT_CONFIGURED", canComplete: false });
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(mocks.execute).toHaveBeenCalledWith(search, expect.any(AbortSignal));
    mocks.draft.mockResolvedValueOnce(draft).mockResolvedValueOnce({ ...draft, autosaveVersion: 5 });
    expect((await send(search)).status).toBe(409);
    mocks.authorize.mockResolvedValueOnce({ session: { accountId: "synthetic-creator" } }).mockResolvedValueOnce(null);
    expect((await send(search)).status).toBe(404);
  });
  it("keeps rate failures readable and status checks free of remote queries", async () => {
    mocks.rate.mockReturnValueOnce({ allowed: false });
    expect((await send(search)).status).toBe(429);
    expect(mocks.execute).not.toHaveBeenCalled();
    mocks.execute.mockResolvedValueOnce({ state: "STATUS", services: [] });
    expect(await (await send({ operation: "STATUS" })).json()).toEqual({ state: "STATUS", services: [] });
    expect(mocks.draft).toHaveBeenCalledOnce();
  });
});
