import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ authorization: vi.fn(), inspect: vi.fn() }));
vi.mock("@/chronicle/studio-authorization", () => ({ requireOwnedStudioTale: mocks.authorization }));
vi.mock("@/drydock/historical-store", () => ({ inspectHistoricalDrydockCompatibility: mocks.inspect }));

import { GET } from "./route";

const context = { params: Promise.resolve({ taleId: "tale-1", versionId: "version-1" }) };

describe("historical Drydock compatibility route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authorization.mockResolvedValue({ session: { accountId: "creator-1" } });
    mocks.inspect.mockResolvedValue({
      compatibility: { status: "COMPATIBLE", sourceChecksum: "a".repeat(64) },
      migrationPreview: { mutatesPublishedSnapshot: false },
    });
  });

  it("does not reveal a foreign Chronicle version", async () => {
    mocks.authorization.mockResolvedValueOnce(null);
    expect((await GET(new Request("http://localhost/compatibility"), context)).status).toBe(404);
    expect(mocks.inspect).not.toHaveBeenCalled();
  });

  it("returns a private, non-destructive historical assessment", async () => {
    const response = await GET(new Request("http://localhost/compatibility"), context);
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect((await response.json()).migrationPreview.mutatesPublishedSnapshot).toBe(false);
    expect(mocks.inspect).toHaveBeenCalledWith("tale-1", "version-1");
  });
});
