import { Readable } from "node:stream";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { db, requireWayfarerAccount, createPrivateProviderRuntime, parsePrivateContentConfiguration } = vi.hoisted(
  () => ({
    db: {
      chronicleMemory: { findFirst: vi.fn() },
      protectedMediaAssociation: { findFirst: vi.fn() },
    },
    requireWayfarerAccount: vi.fn(),
    createPrivateProviderRuntime: vi.fn(),
    parsePrivateContentConfiguration: vi.fn(),
  }),
);

vi.mock("@/lib/db", () => ({ db }));
vi.mock("@/wayfarer/http", () => ({ requireWayfarerAccount }));
vi.mock("@/private-content/providers", () => ({ createPrivateProviderRuntime }));
vi.mock("@/private-content/config", () => ({ parsePrivateContentConfiguration }));

import { GET } from "./route";

const context = {
  params: Promise.resolve({ recordId: "record-owner", memoryId: "memory-owner", mediaId: "media-owner" }),
};

describe("GET private Wakebook Memory media", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("collapses an anonymous request to the same neutral result as an absent private asset", async () => {
    requireWayfarerAccount.mockResolvedValue(null);

    const response = await GET(
      new Request("http://localhost/api/passport/voyages/record-owner/memories/memory-owner/media/media-owner"),
      context,
    );

    expect(response.status).toBe(404);
    expect(db.chronicleMemory.findFirst).not.toHaveBeenCalled();
  });

  it("opens only a clean, current owner association and never exposes the storage key", async () => {
    requireWayfarerAccount.mockResolvedValue({ account: { id: "account-owner", profile: { id: "profile-owner" } } });
    db.chronicleMemory.findFirst.mockResolvedValue({ id: "memory-owner" });
    db.protectedMediaAssociation.findFirst.mockResolvedValue({
      protectedMedia: {
        detectedMediaType: "image/png",
        byteLength: 2,
        scanState: "CLEAN",
        availabilityState: "AVAILABLE",
        withdrawnAt: null,
        archivedAt: null,
        sourceObject: {
          storageKey: "private/never-disclose.png",
          sha256: "checksum",
          byteLength: 2,
          scanStatus: "CLEAN",
          finalizedAt: new Date("2026-08-13T12:00:00.000Z"),
        },
      },
    });
    const read = vi.fn().mockResolvedValue(Readable.from([Buffer.from("ok")]));
    parsePrivateContentConfiguration.mockReturnValue({});
    createPrivateProviderRuntime.mockReturnValue({ storage: { read } });

    const response = await GET(
      new Request("http://localhost/api/passport/voyages/record-owner/memories/memory-owner/media/media-owner"),
      context,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("cross-origin-resource-policy")).toBe("same-site");
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(read).toHaveBeenCalledWith({
      key: "private/never-disclose.png",
      sha256: "checksum",
      byteLength: 2,
      mediaType: "image/png",
    });
    expect(await response.text()).toBe("ok");
    expect(response.headers.toString()).not.toContain("private/never-disclose.png");
  });
});
