import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ authorization: vi.fn(), evidence: vi.fn() }));

vi.mock("@/chronicle/studio-authorization", () => ({ requireOwnedStudioTale: mocks.authorization }));
vi.mock("@/drydock/evidence-store", () => ({ getDrydockPublishingEvidence: mocks.evidence }));

import { GET } from "./route";

const context = { params: Promise.resolve({ taleId: "tale-1", versionId: "version-1" }) };

describe("Drydock publishing evidence route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authorization.mockResolvedValue({ session: { accountId: "creator-1" } });
    mocks.evidence.mockResolvedValue({
      evidenceId: "evidence-1",
      versionId: "version-1",
      publishedAt: "2026-08-13T00:00:00.000Z",
      evidence: { sourceChecksum: "a".repeat(64) },
    });
  });

  it("does not reveal whether foreign Chronicle evidence exists", async () => {
    mocks.authorization.mockResolvedValueOnce(null);
    const response = await GET(new Request("http://localhost/evidence"), context);
    expect(response.status).toBe(404);
    expect(mocks.evidence).not.toHaveBeenCalled();
  });

  it("returns only the owner-safe immutable projection with no-store semantics", async () => {
    const response = await GET(new Request("http://localhost/evidence"), context);
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await response.json()).toEqual({ evidence: await mocks.evidence.mock.results[0].value });
    expect(mocks.evidence).toHaveBeenCalledWith("tale-1", "version-1");
  });

  it("uses a 404 when the requested owned Version has no evidence", async () => {
    mocks.evidence.mockResolvedValueOnce(null);
    expect((await GET(new Request("http://localhost/evidence"), context)).status).toBe(404);
  });
});
