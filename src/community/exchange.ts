import { createHash } from "node:crypto";
import { CommunityError, stableJson } from "./domain";
import { assertDependencyGraph, type CommunityPackageManifest } from "./package";

export const installModes = [
  "LIBRARY_REFERENCE",
  "EDITABLE_COPY",
  "FORK",
  "IMPORT_INTO_DRAFT",
  "PREVIEW_SANDBOX",
] as const;
export type InstallMode = (typeof installModes)[number];
export const updateActions = ["KEEP_CURRENT", "UPDATE", "FORK_CURRENT", "IGNORE_VERSION"] as const;
export type UpdateAction = (typeof updateActions)[number];
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
  nonMutating: boolean;
};

export function assertLicenseCompatible(license: LicenseSnapshot, mode: InstallMode, commercial = false) {
  if (mode !== "LIBRARY_REFERENCE" && mode !== "PREVIEW_SANDBOX" && !license.allowsModification)
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
  if (input.localModificationChecksum && input.mode === "LIBRARY_REFERENCE")
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
  const mappingSeed = stableJson({
    packageChecksum: input.packageChecksum,
    mode: input.mode,
    destinationRevision: input.destinationRevision,
    idMappings,
  });
  return {
    id: createHash("sha256").update(mappingSeed).digest("hex").slice(0, 32),
    mode: input.mode,
    packageId: input.packageManifest.packageId,
    packageChecksum: input.packageChecksum,
    destinationRevision: input.destinationRevision,
    idMappings,
    obligations,
    warnings: input.localModificationChecksum ? ["Local edits are preserved in a new derivative."] : [],
    assetReusePaths: input.packageManifest.items.map((item) => item.path),
    nonMutating: input.mode === "PREVIEW_SANDBOX",
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
  const idempotencyKey = createHash("sha256").update(`${requestId}:${plan.packageChecksum}:${plan.mode}`).digest("hex");
  return {
    id: idempotencyKey.slice(0, 32),
    idempotencyKey,
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
      : (["LIBRARY_REFERENCE", "EDITABLE_COPY", "FORK"] as InstallMode[]),
    changed: available ? ["packageChecksum", "semanticVersion"] : [],
    installedVersion: input.installedVersion,
    candidateVersion: input.candidateVersion,
    allowedActions: input.localModificationChecksum
      ? (["KEEP_CURRENT", "FORK_CURRENT", "IGNORE_VERSION"] as UpdateAction[])
      : (["KEEP_CURRENT", "UPDATE", "FORK_CURRENT", "IGNORE_VERSION"] as UpdateAction[]),
  };
}

export function resolveReleaseUpdate(input: {
  comparison: ReturnType<typeof compareReleaseUpdate>;
  action: UpdateAction;
}) {
  if (!input.comparison.available && input.action !== "KEEP_CURRENT")
    throw new CommunityError("COMMUNITY_UPDATE_NOT_AVAILABLE", "There is no release update to apply.");
  if (input.comparison.localEditProtected && input.action === "UPDATE")
    throw new CommunityError(
      "COMMUNITY_LOCAL_EDIT_PROTECTED",
      "Local edits must be kept or forked; they cannot be overwritten.",
    );
  return {
    action: input.action,
    createsFork: input.action === "FORK_CURRENT",
    mutatesInstalledCopy: input.action === "UPDATE",
    preservesInstalledCopy: input.action !== "UPDATE",
  };
}
