import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  canonicalAccountForLegacyActor: vi.fn(),
  validateTaleDraft: vi.fn(),
  getStudioTale: vi.fn(),
  snapshotFromStudio: vi.fn(),
  publishedSourceChecksum: vi.fn(),
  getDrydockReadiness: vi.fn(),
  createEvidence: vi.fn(),
  isPublicationEligible: vi.fn(),
  transaction: vi.fn(),
  findFirst: vi.fn(),
  emit: vi.fn(),
  info: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    $transaction: mocks.transaction,
    publishedTaleVersion: { findFirst: mocks.findFirst },
  },
}));
vi.mock("@/wayfarer/accounts", () => ({ canonicalAccountForLegacyActor: mocks.canonicalAccountForLegacyActor }));
vi.mock("@/chronicle/validation", () => ({ validateTaleDraft: mocks.validateTaleDraft }));
vi.mock("@/chronicle/studio-service", () => ({ getStudioTale: mocks.getStudioTale }));
vi.mock("@/chronicle/snapshot", () => ({
  snapshotFromStudio: mocks.snapshotFromStudio,
  publishedSourceChecksum: mocks.publishedSourceChecksum,
}));
vi.mock("@/drydock/readiness-store", () => ({ getDrydockReadiness: mocks.getDrydockReadiness }));
vi.mock("@/drydock/publishing-evidence", () => ({ createDrydockPublishingEvidencePayload: mocks.createEvidence }));
vi.mock("@/drydock/reports", () => ({ isDrydockReportPublicationEligible: mocks.isPublicationEligible }));
vi.mock("@/lib/events", () => ({ eventBus: { emit: mocks.emit } }));
vi.mock("@/lib/logger", () => ({ logger: { info: mocks.info } }));

import { publishTale } from "@/chronicle/publishing";

const checksum = "a".repeat(64);
const publishedAt = new Date("2026-08-13T00:00:00.000Z");

beforeEach(() => {
  vi.clearAllMocks();
  mocks.canonicalAccountForLegacyActor.mockResolvedValue("account-1");
  mocks.isPublicationEligible.mockReturnValue(true);
  mocks.validateTaleDraft.mockResolvedValue({
    valid: true,
    autosaveVersion: 7,
    drydockReport: { sourceChecksum: checksum, status: "VALID", proof: { completeness: "COMPLETE" } },
  });
  mocks.getStudioTale.mockResolvedValue({ draft: { autosaveVersion: 7 } });
  mocks.snapshotFromStudio.mockReturnValue({ chapters: [], assets: [] });
  mocks.publishedSourceChecksum.mockReturnValue(checksum);
  mocks.getDrydockReadiness.mockResolvedValue({
    status: "VERIFIED",
    sourceChecksum: checksum,
    evidenceDraft: {
      schemaVersion: 1,
      sourceChecksum: checksum,
      schemaRegistryVersion: 2,
      ruleCatalogVersion: 1,
      validationRunId: "validation-1",
      requiredSuitePolicyVersion: "suite-v1",
      requiredScenarioSuiteIds: [],
      scenarioRunIds: [],
      coverageDigest: "b".repeat(64),
      compatibilityPolicyVersion: "compat-v1",
      compatibilityDigest: "c".repeat(64),
      externalEvidenceDigest: "d".repeat(64),
      waiverIds: [],
      draftDigest: "e".repeat(64),
    },
  });
  mocks.createEvidence.mockReturnValue({
    schemaVersion: 1,
    schemaRegistryVersion: 2,
    ruleCatalogVersion: 1,
    validationRunId: "validation-1",
    requiredSuitePolicyVersion: "suite-v1",
    compatibilityPolicyVersion: "compat-v1",
    compatibilityDigest: "c".repeat(64),
    externalEvidenceDigest: "d".repeat(64),
    digest: "f".repeat(64),
  });
});

describe("Phase 4 immutable publication race safety", () => {
  it("returns the existing version after a same-source uniqueness race without a second catalog event", async () => {
    const existing = {
      id: "published-1",
      versionNumber: 1,
      versionLabel: "1.0",
      checksum,
      publishedAt,
      drydockPublishingEvidence: { digest: "bound-evidence" },
    };
    mocks.transaction.mockRejectedValue({ code: "P2002" });
    mocks.findFirst.mockResolvedValue(existing);

    await expect(publishTale("tale-1", "creator-1", "", 7)).resolves.toEqual({
      id: "published-1",
      versionNumber: 1,
      versionLabel: "1.0",
      checksum,
      evidenceId: "bound-evidence",
      publishedAt: publishedAt.toISOString(),
    });
    expect(mocks.findFirst).toHaveBeenCalledWith({
      where: { taleId: "tale-1", checksum },
      include: { drydockPublishingEvidence: { select: { digest: true } } },
    });
    expect(mocks.emit).not.toHaveBeenCalled();
  });
});
