import { beforeEach, describe, expect, it, vi } from "vitest";
const store = vi.hoisted(() => ({ find: vi.fn(), create: vi.fn(), draft: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    taleDraft: { findFirst: store.draft },
    drydockExternalEvidenceReference: { findFirst: store.find, create: store.create },
  },
}));
vi.mock("@/chronicle/studio-service", () => ({ getStudioTale: async () => ({}) }));
vi.mock("@/chronicle/snapshot", () => ({
  snapshotFromStudio: (value: unknown) => value,
  publishedSourceChecksum: () => "a".repeat(64),
}));
import { recordCurrentDrydockExternalEvidence } from "@/drydock/external-evidence-store";
import { drydockDeviceLabReference } from "@/drydock/device-lab-reference";

beforeEach(() => {
  vi.clearAllMocks();
  store.draft.mockResolvedValue({ id: "draft" });
  store.find.mockResolvedValue(null);
  store.create.mockImplementation(async ({ data }: { data: unknown }) => data);
});
describe("Drydock current-source external evidence binding", () => {
  it("rejects stale Chronicle bindings before touching an evidence row", async () => {
    await expect(
      recordCurrentDrydockExternalEvidence({
        taleId: "tale",
        providerId: "landfall-device-lab",
        providerVersion: "v",
        evidenceKind: "DEVICE_LAB:gps-perfect-walk",
        safeSummary: "bounded synthetic proof",
        status: "EXTERNAL_VALIDATION_REQUIRED",
        expectedSourceChecksum: "b".repeat(64),
      }),
    ).rejects.toThrow("DRYDOCK_EXTERNAL_EVIDENCE_STALE_SOURCE");
    expect(store.draft).not.toHaveBeenCalled();
    expect(store.find).not.toHaveBeenCalled();
    expect(store.create).not.toHaveBeenCalled();
  });
  it("stores a typed Device Lab reference on the current draft with review still required", async () => {
    const input = drydockDeviceLabReference({
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
    });
    const result = await recordCurrentDrydockExternalEvidence({ taleId: "tale", ...input });
    expect(store.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        draftId: "draft",
        sourceChecksum: "a".repeat(64),
        sourceReference: input.sourceReference,
        status: "EXTERNAL_VALIDATION_REQUIRED",
      }),
    });
    expect(result.evidence.status).toBe("EXTERNAL_VALIDATION_REQUIRED");
    expect(result.sourceChecksum).toBe("a".repeat(64));
  });
});
