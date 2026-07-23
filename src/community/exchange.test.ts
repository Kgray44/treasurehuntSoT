import { describe, expect, it } from "vitest";
import {
  createInstallPlan,
  beginInstallOperation,
  commitInstallOperation,
  compareReleaseUpdate,
  resolveReleaseUpdate,
} from "./exchange";
import { sha256 } from "./package";

const bytes = new TextEncoder().encode("safe");
const manifest = {
  schemaVersion: 1 as const,
  packageId: "p",
  releaseId: "r",
  semanticVersion: "1.0.0",
  license: { key: "REMIX", version: 1 },
  attribution: [{ displayName: "Creator", contributionType: "ORIGINAL" }],
  items: [
    {
      id: "item",
      type: "CHRONICLE" as const,
      path: "items/item.json",
      checksum: sha256(bytes),
      mediaType: "application/json",
      byteLength: bytes.byteLength,
      dependencies: [],
    },
  ],
};
const input = {
  packageManifest: manifest,
  packageChecksum: "a".repeat(64),
  mode: "EDITABLE_COPY" as const,
  destinationRevision: "1",
  currentDestinationRevision: "1",
  license: {
    key: "REMIX",
    allowsModification: true,
    allowsPublicUse: true,
    allowsCommercialUse: true,
    requiresAttribution: true,
    shareAlike: false,
  },
};

describe("Community installation", () => {
  it("creates deterministic safe mappings and a retryable operation", () => {
    const plan = createInstallPlan(input);
    expect(createInstallPlan(input).id).toBe(plan.id);
    expect(plan.idMappings.item).toContain("item--");
    const pending = commitInstallOperation(beginInstallOperation(plan, "request"), false);
    expect(pending.status).toBe("FINALIZATION_RETRY_REQUIRED");
    expect(commitInstallOperation(pending, true).status).toBe("COMMITTED");
  });
  it("protects stale destinations and local edits from linked overwrite", () => {
    expect(() => createInstallPlan({ ...input, destinationRevision: "old" })).toThrow("destination changed");
    expect(() =>
      createInstallPlan({ ...input, mode: "LIBRARY_REFERENCE", localModificationChecksum: "changed" }),
    ).toThrow("Local edits");
  });
  it("reports updates without silently overwriting local work", () => {
    expect(
      compareReleaseUpdate({
        installedChecksum: "a",
        candidateChecksum: "b",
        installedVersion: "1.0.0",
        candidateVersion: "1.1.0",
        localModificationChecksum: "c",
      }),
    ).toMatchObject({ available: true, localEditProtected: true, recommendedModes: ["EDITABLE_COPY", "FORK"] });
  });
  it("makes preview nonmutating and never overwrites local edits during an update", () => {
    expect(createInstallPlan({ ...input, mode: "PREVIEW_SANDBOX" }).nonMutating).toBe(true);
    const comparison = compareReleaseUpdate({
      installedChecksum: "a",
      candidateChecksum: "b",
      installedVersion: "1.0.0",
      candidateVersion: "1.1.0",
      localModificationChecksum: "c",
    });
    expect(() => resolveReleaseUpdate({ comparison, action: "UPDATE" })).toThrow("Local edits");
    expect(resolveReleaseUpdate({ comparison, action: "FORK_CURRENT" })).toMatchObject({ createsFork: true });
  });
});
