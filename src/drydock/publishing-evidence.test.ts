import { describe, expect, it } from "vitest";
import {
  assertSafeDrydockPublishingEvidencePayload,
  createDrydockPublishingEvidencePayload,
  creatorPublishingEvidenceProjection,
} from "@/drydock/publishing-evidence";
import type { DrydockPublishingEvidenceDraft } from "@/drydock/readiness";

const draft: DrydockPublishingEvidenceDraft = {
  schemaVersion: 1,
  sourceChecksum: "a".repeat(64),
  schemaRegistryVersion: 2,
  ruleCatalogVersion: 1,
  validationRunId: "run-1",
  requiredSuitePolicyVersion: "suite-v1",
  requiredScenarioSuiteIds: ["baseline"],
  compatibilityPolicyVersion: "compat-v1",
  compatibilityDigest: "b".repeat(64),
  externalEvidenceDigest: "c".repeat(64),
  waiverIds: [],
  draftDigest: "d".repeat(64),
};

describe("Drydock publishing evidence", () => {
  it("creates deterministic safe evidence with stable list identities", () => {
    const first = createDrydockPublishingEvidencePayload({
      draft,
      scenarioRunIds: ["run-b", "run-a", "run-a"],
      coverageDigest: "e".repeat(64),
      platformVersion: "platform-v1",
      createdAt: "2026-08-13T00:00:00.000Z",
    });
    const second = createDrydockPublishingEvidencePayload({
      draft,
      scenarioRunIds: ["run-a", "run-b"],
      coverageDigest: "e".repeat(64),
      platformVersion: "platform-v1",
      createdAt: "2026-08-13T00:00:00.000Z",
    });
    expect(first).toEqual(second);
    expect(creatorPublishingEvidenceProjection(first)).not.toHaveProperty("acceptedAnswers");
  });

  it("rejects evidence that has been changed after its digest was created", () => {
    const payload = createDrydockPublishingEvidencePayload({
      draft,
      scenarioRunIds: [],
      coverageDigest: "e".repeat(64),
      platformVersion: "platform-v1",
      createdAt: "2026-08-13T00:00:00.000Z",
    });
    expect(() => assertSafeDrydockPublishingEvidencePayload({ ...payload, sourceChecksum: "z".repeat(64) })).toThrow(
      "DRYDOCK_EVIDENCE_DIGEST_MISMATCH",
    );
  });
});
