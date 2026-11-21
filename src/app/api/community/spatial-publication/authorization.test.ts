// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  workspace: vi.fn(),
  csrf: vi.fn(),
  licenses: vi.fn(),
  listings: vi.fn(),
  profileReady: vi.fn(),
  preflight: vi.fn(),
  publish: vi.fn(),
}));

vi.mock("@/chronicle/studio-authorization", () => ({ requireStudioWorkspace: mocks.workspace }));
vi.mock("@/platform/auth", () => ({ verifyPlayerCsrf: mocks.csrf }));
vi.mock("@/community/spatial-publication", async () => {
  const { z } = await import("zod");
  return {
    spatialPublicationInputSchema: z.unknown(),
    listSpatialPublicationLicenses: mocks.licenses,
    listOwnedSpatialPublications: mocks.listings,
    preflightSpatialPublication: mocks.preflight,
    publishSpatialToCommunity: mocks.publish,
  };
});
vi.mock("@/community/public-profile", () => ({ spatialCommunityProfileReady: mocks.profileReady }));
vi.mock("@/lib/db", () => ({ db: {} }));

import { GET as getLicenses } from "./licenses/route";
import { POST as preflight } from "./preflight/route";
import { POST as publish } from "./publish/route";

const base = "http://localhost/api/community/spatial-publication";
function post(path: string, body: unknown) {
  return new Request(`${base}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-csrf-token": "synthetic-csrf" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.csrf.mockResolvedValue(true);
});

describe("spatial publication Creator authorization", () => {
  it("refuses listing, review and submission when the Creator workspace is unavailable", async () => {
    mocks.workspace.mockResolvedValue(null);
    const responses = await Promise.all([
      getLicenses(new Request(`${base}/licenses?kind=ASSET&id=owned&revision=2`)),
      preflight(post("preflight", {})),
      publish(post("publish", {})),
    ]);
    for (const response of responses) {
      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ code: "COMMUNITY_ACCESS_DENIED" });
    }
    expect(mocks.licenses).not.toHaveBeenCalled();
    expect(mocks.listings).not.toHaveBeenCalled();
    expect(mocks.preflight).not.toHaveBeenCalled();
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it("also refuses mutation without CSRF after Creator authorization", async () => {
    mocks.workspace.mockResolvedValue({ accountId: "creator-1" });
    mocks.csrf.mockResolvedValue(false);
    expect((await preflight(post("preflight", {}))).status).toBe(403);
    expect((await publish(post("publish", {}))).status).toBe(403);
    expect(mocks.preflight).not.toHaveBeenCalled();
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it("passes the authorized account into publication review and submission", async () => {
    mocks.workspace.mockResolvedValue({ accountId: "creator-1" });
    mocks.preflight.mockResolvedValue({ reviewDigest: "b".repeat(64) });
    mocks.publish.mockResolvedValue({ listingId: "listing-1" });
    const publication = { source: { kind: "ASSET", id: "owned", revision: 2 } };
    const reviewed = await preflight(post("preflight", publication));
    const submitted = await publish(post("publish", { publication, reviewDigest: "b".repeat(64) }));
    expect(reviewed.status).toBe(200);
    expect(submitted.status).toBe(201);
    expect(mocks.preflight).toHaveBeenCalledWith("creator-1", publication);
    expect(mocks.publish).toHaveBeenCalledWith("creator-1", publication, "b".repeat(64));
  });
});
