import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ authorize: vi.fn(), get: vi.fn(), save: vi.fn() }));
vi.mock("@/chronicle/studio-authorization", () => ({ requireOwnedStudioTale: mocks.authorize }));
vi.mock("@/landfall/definition-store", () => ({
  getDraftLandfallDefinition: mocks.get,
  saveDraftLandfallDefinition: mocks.save,
}));

import { GET, PUT } from "./route";
import { landfallFixture } from "@/landfall/fixtures";

const context = { params: Promise.resolve({ taleId: "fixture-tale" }) };
describe("Landfall draft route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authorize.mockResolvedValue({ session: { accountId: "creator" } });
  });

  it("keeps private definitions unavailable without owner authorization", async () => {
    mocks.authorize.mockResolvedValue(null);
    const response = await GET(new Request("http://localhost/api/studio/tales/fixture-tale/landfall"), context);
    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(mocks.get).not.toHaveBeenCalled();
  });

  it("passes the writing request through the existing owner and CSRF guard", async () => {
    mocks.save.mockResolvedValue({ autosaveVersion: 2, definition: landfallFixture });
    const request = new Request("http://localhost/api/studio/tales/fixture-tale/landfall", {
      method: "PUT",
      body: JSON.stringify({ expectedAutosaveVersion: 1, definition: landfallFixture }),
    });
    const response = await PUT(request, context);
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(mocks.authorize).toHaveBeenCalledWith("fixture-tale", request);
    expect(mocks.save).toHaveBeenCalledWith("fixture-tale", landfallFixture, 1);
  });

  it("rejects oversized authored data before validation or persistence", async () => {
    const request = new Request("http://localhost/api/studio/tales/fixture-tale/landfall", {
      method: "PUT",
      body: JSON.stringify({ expectedAutosaveVersion: 1, definition: { unexpected: "x".repeat(1100 * 1024) } }),
    });
    const response = await PUT(request, context);
    expect(response.status).toBe(400);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(mocks.save).not.toHaveBeenCalled();
  });
});
