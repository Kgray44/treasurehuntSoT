// @sounding-line-registration owner=project-crossdeck suite=unit.crossdeck contracts=crossdeck.phase2.continuity
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CrossdeckError } from "@/crossdeck/contracts";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), read: vi.fn(), resolve: vi.fn(), surface: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { $transaction: (run: (tx: object) => unknown) => run({}) } }));
vi.mock("@/wayfarer/http", () => ({ requireWayfarerAccount: mocks.auth }));
vi.mock("@/crossdeck/sync-service", () => ({ createCrossdeckSyncService: () => ({ read: mocks.read }) }));
vi.mock("@/crossdeck/objects", () => ({ resolveCrossdeckObject: mocks.resolve }));
vi.mock("@/crossdeck/service", () => ({ surface: mocks.surface }));
import { GET } from "./route";
const ref = { family: "ARTIFACT", objectId: "relic", version: "v1" };
const request = () =>
  new Request(
    `https://voyagewright.test/api/crossdeck/view?voyage=voyage&surface=${crypto.randomUUID()}&family=ARTIFACT&object=relic&version=v1`,
  );
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ accountId: "account", id: "session" });
  mocks.read.mockResolvedValue({ presentations: [{ object: ref, context: {} }] });
  mocks.surface.mockResolvedValue({ role: "SHARED_CREW_DISPLAY" });
  mocks.resolve.mockResolvedValue({
    title: "Released relic",
    visibility: "CREW",
    block: { configuration: { text: "Read this", creatorNotes: "secret", answer: "secret", token: "secret" } },
  });
});
describe("approved shared-display projection", () => {
  it("requires current authority and a committed version-bound presentation", async () => {
    mocks.auth.mockResolvedValue(null);
    expect((await GET(request())).status).toBe(401);
    mocks.auth.mockResolvedValue({ accountId: "account", id: "session" });
    mocks.read.mockResolvedValue({ presentations: [{ object: { ...ref, version: "old" }, context: {} }] });
    expect((await GET(request())).status).toBe(403);
    expect(mocks.resolve).not.toHaveBeenCalled();
    mocks.read.mockRejectedValue(new CrossdeckError(403, "Revoked"));
    expect((await GET(request())).status).toBe(403);
  });
  it("rechecks crew policy and projects only approved reading fields without caching", async () => {
    const response = await GET(request());
    expect(response.headers.get("Cache-Control")).toBe("no-store, private");
    expect(await response.json()).toEqual({
      title: "Released relic",
      family: "ARTIFACT",
      text: "Read this",
      context: {},
    });
    mocks.resolve.mockResolvedValue({
      title: "Private",
      visibility: "PRIVATE",
      block: { configuration: { text: "secret" } },
    });
    expect((await GET(request())).status).toBe(403);
  });
  it("never exposes internal failures or malformed object queries", async () => {
    mocks.resolve.mockRejectedValue(new Error("secret-token"));
    expect(await (await GET(request())).text()).not.toContain("secret-token");
    expect((await GET(new Request("https://voyagewright.test/api/crossdeck/view"))).status).toBe(400);
  });
});
