import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ authorization: vi.fn(), list: vi.fn(), record: vi.fn() }));
vi.mock("@/chronicle/studio-authorization", () => ({ requireOwnedStudioTale: mocks.authorization }));
vi.mock("@/drydock/external-evidence-store", () => ({
  listCurrentDrydockExternalEvidence: mocks.list,
  recordCurrentDrydockExternalEvidence: mocks.record,
}));
import { GET, POST } from "./route";
const context = { params: Promise.resolve({ taleId: "tale-1" }) };
const deviceLabReference = {
  kind: "LANDFALL_DEVICE_LAB_REFERENCE",
  sourceChecksum: "a".repeat(64),
  receiptChecksum: "b".repeat(64),
  sourceSha: "c".repeat(40),
  sourceTree: "d".repeat(40),
  fixtureHash: "e".repeat(64),
  scenarioId: "gps-perfect-walk",
  scenarioVersion: 2,
  target: "provider-simulation",
  deviceProfile: "primary-phone",
  providerFamily: "LOCATION",
  evidenceClass: "PROVIDER_SIMULATION_PROVEN",
  result: "PASS",
};
const referenceRequest = (body: unknown = deviceLabReference) =>
  new Request("http://localhost/external", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-csrf-token": "synthetic" },
    body: JSON.stringify(body),
  });

describe("Drydock external evidence route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authorization.mockResolvedValue({ session: { account: { roles: [{ role: "ADMINISTRATOR" }] } } });
    mocks.list.mockResolvedValue({ sourceChecksum: "a".repeat(64), evidence: [] });
    mocks.record.mockResolvedValue({ sourceChecksum: "a".repeat(64), evidence: { providerId: "landfall" } });
  });
  it("conceals a foreign Chronicle and never reads its evidence", async () => {
    mocks.authorization.mockResolvedValueOnce(null);
    expect((await GET(new Request("http://localhost/external"), context)).status).toBe(404);
    expect(mocks.list).not.toHaveBeenCalled();
  });
  it("returns private current-source safe summaries", async () => {
    const response = await GET(new Request("http://localhost/external"), context);
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(mocks.list).toHaveBeenCalledWith("tale-1");
  });
  it("requires an Administrator and strict evidence body", async () => {
    mocks.authorization.mockResolvedValueOnce({ session: { account: { roles: [{ role: "CREATOR" }] } } });
    expect((await POST(new Request("http://localhost/external", { method: "POST", body: "{}" }), context)).status).toBe(
      403,
    );
    const response = await POST(
      new Request("http://localhost/external", {
        method: "POST",
        body: JSON.stringify({
          providerId: "landfall",
          providerVersion: "adapter-v1",
          evidenceKind: "field-evidence",
          status: "PRESENT",
          safeSummary: "Authorized field reference",
        }),
      }),
      context,
    );
    expect(response.status).toBe(201);
    expect(mocks.record).toHaveBeenCalledWith(
      expect.objectContaining({ taleId: "tale-1", providerId: "landfall", safeSummary: "Authorized field reference" }),
    );
  });
  it("records bounded Device Lab metadata with current-source review still required", async () => {
    const response = await POST(referenceRequest(), context);
    expect(response.status).toBe(201);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(mocks.record).toHaveBeenCalledWith(
      expect.objectContaining({
        taleId: "tale-1",
        expectedSourceChecksum: deviceLabReference.sourceChecksum,
        status: "EXTERNAL_VALIDATION_REQUIRED",
      }),
    );
    expect(
      (await POST(referenceRequest({ ...deviceLabReference, evidenceClass: "FIELD_PROVEN" }), context)).status,
    ).toBe(400);
    expect(mocks.record).toHaveBeenCalledTimes(1);
  });
  it("keeps Device Lab authorization ahead of parsing and recording", async () => {
    mocks.authorization.mockResolvedValueOnce(null);
    expect((await POST(referenceRequest(), context)).status).toBe(404);
    mocks.authorization.mockResolvedValueOnce({ session: { account: { roles: [{ role: "CREATOR" }] } } });
    expect((await POST(referenceRequest({ privateData: "must not be processed" }), context)).status).toBe(403);
    expect(mocks.record).not.toHaveBeenCalled();
  });
});
