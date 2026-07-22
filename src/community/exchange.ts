import { createHash, randomUUID } from "node:crypto";
import { CommunityError, stableJson } from "./domain";
import { assertDependencyGraph, type CommunityPackageManifest } from "./package";

export type InstallMode = "LINKED" | "EDITABLE_COPY" | "FORK" | "CURRENT_DRAFT";
export type LicenseSnapshot = {
  key: string;
  allowsModification: boolean;
  allowsPublicUse: boolean;
  allowsCommercialUse: boolean;
  requiresAttribution: boolean;
  shareAlike: boolean;
};
export type InstallPlanInput = {
  packageManifest: CommunityPackageManifest;
  packageChecksum: string;
  mode: InstallMode;
  destinationRevision: string;
  currentDestinationRevision: string;
  installedPackageChecksum?: string;
  localModificationChecksum?: string;
  license: LicenseSnapshot;
  destinationCommercial?: boolean;
};
export type InstallPlan = {
  id: string;
  mode: InstallMode;
  packageId: string;
  packageChecksum: string;
  destinationRevision: string;
  idMappings: Record<string, string>;
  obligations: string[];
  warnings: string[];
  assetReusePaths: string[];
};

export function assertLicenseCompatible(license: LicenseSnapshot, mode: InstallMode, commercial = false) {
  if (mode !== "LINKED" && !license.allowsModification)
    throw new CommunityError("COMMUNITY_LICENSE_INCOMPATIBLE", "This release does not allow modification or remixing.");
  if (commercial && !license.allowsCommercialUse)
    throw new CommunityError(
      "COMMUNITY_LICENSE_INCOMPATIBLE",
      "This release cannot be used in a commercial destination.",
    );
}
export function createInstallPlan(input: InstallPlanInput): InstallPlan {
  if (input.destinationRevision !== input.currentDestinationRevision)
    throw new CommunityError("COMMUNITY_DESTINATION_STALE", "The destination changed; review a new installation plan.");
  if (input.installedPackageChecksum === input.packageChecksum)
    throw new CommunityError("COMMUNITY_ALREADY_INSTALLED", "This exact package is already installed.");
  if (input.localModificationChecksum && input.mode === "LINKED")
    throw new CommunityError("COMMUNITY_LOCAL_EDIT_PROTECTED", "Local edits require an editable copy or tracked fork.");
  assertDependencyGraph(input.packageManifest.items);
  assertLicenseCompatible(input.license, input.mode, input.destinationCommercial);
  const idMappings = Object.fromEntries(
    input.packageManifest.items.map((item) => [
      item.id,
      `${item.id}--${createHash("sha256").update(`${input.packageChecksum}:${item.id}`).digest("hex").slice(0, 12)}`,
    ]),
  );
  const obligations = [
    ...(input.license.requiresAttribution ? ["Preserve package attribution."] : []),
    ...(input.license.shareAlike ? ["Publish compatible derivative terms."] : []),
  ];
  return {
    id: randomUUID(),
    mode: input.mode,
    packageId: input.packageManifest.packageId,
    packageChecksum: input.packageChecksum,
    destinationRevision: input.destinationRevision,
    idMappings,
    obligations,
    warnings: input.localModificationChecksum ? ["Local edits are preserved in a new derivative."] : [],
    assetReusePaths: input.packageManifest.items.map((item) => item.path),
  };
}
export type InstallOperation = {
  id: string;
  idempotencyKey: string;
  status: "PLANNED" | "COMMITTED" | "FINALIZATION_RETRY_REQUIRED";
  plan: InstallPlan;
  receiptChecksum?: string;
};
export function beginInstallOperation(plan: InstallPlan, requestId: string): InstallOperation {
  return {
    id: randomUUID(),
    idempotencyKey: createHash("sha256").update(`${requestId}:${plan.packageChecksum}:${plan.mode}`).digest("hex"),
    status: "PLANNED",
    plan,
  };
}
export function commitInstallOperation(operation: InstallOperation, finalizationSucceeded: boolean): InstallOperation {
  if (operation.status === "COMMITTED") return operation;
  if (!finalizationSucceeded) return { ...operation, status: "FINALIZATION_RETRY_REQUIRED" };
  const receiptChecksum = createHash("sha256")
    .update(
      stableJson({
        operation: operation.id,
        package: operation.plan.packageChecksum,
        mappings: operation.plan.idMappings,
      }),
    )
    .digest("hex");
  return { ...operation, status: "COMMITTED", receiptChecksum };
}
export function compareReleaseUpdate(input: {
  installedChecksum: string;
  candidateChecksum: string;
  localModificationChecksum?: string;
  installedVersion: string;
  candidateVersion: string;
}) {
  const available = input.installedChecksum !== input.candidateChecksum;
  return {
    available,
    localEditProtected: Boolean(input.localModificationChecksum),
    recommendedModes: input.localModificationChecksum
      ? (["EDITABLE_COPY", "FORK"] as InstallMode[])
      : (["LINKED", "EDITABLE_COPY", "FORK"] as InstallMode[]),
    changed: available ? ["packageChecksum", "semanticVersion"] : [],
    installedVersion: input.installedVersion,
    candidateVersion: input.candidateVersion,
  };
}
