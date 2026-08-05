import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAccount: vi.fn(),
  download: vi.fn(),
}));

vi.mock("@/wayfarer/http", () => ({ requireWayfarerAccount: mocks.requireAccount }));
vi.mock("@/wayfarer/account-lifecycle", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/wayfarer/account-lifecycle")>()),
  downloadAccountExport: mocks.download,
}));

import { GET } from "./route";

describe("GET /api/account/data/export/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAccount.mockResolvedValue({ accountId: "account-1" });
    mocks.download.mockResolvedValue({ payload: '{"manifest":{"schemaVersion":1}}', checksum: "safe-checksum" });
  });

  it("homeport.owner-correction.round1.export-api scopes the download to the signed-in account and emits safe headers", async () => {
    const response = await GET(new Request("http://localhost/api/account/data/export/export-1"), {
      params: Promise.resolve({ id: "export-1" }),
    });
    expect(response.status).toBe(200);
    expect(mocks.download).toHaveBeenCalledWith("account-1", "export-1");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("x-voyagewright-checksum-sha256")).toBe("safe-checksum");
  });

  it("rejects unsafe identifiers without invoking storage", async () => {
    const response = await GET(new Request("http://localhost/api/account/data/export/bad"), {
      params: Promise.resolve({ id: "../foreign" }),
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      code: "WAYFARER_INVALID",
      error: "The export identifier is invalid.",
    });
    expect(mocks.download).not.toHaveBeenCalled();
  });
});
