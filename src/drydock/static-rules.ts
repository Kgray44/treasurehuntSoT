import type { CanonicalDrydockBlock } from "@/drydock/contracts/model";
import { getDrydockBlockContract } from "@/drydock/contracts/registry";
import { createDrydockIssue, type DrydockIssue } from "@/drydock/issues";

export type DrydockAssetSnapshot = {
  id: string;
  mediaType: string;
  roles: readonly string[];
  variants: readonly { processingState: string }[];
};
const at = (value: Record<string, unknown>, path: string) =>
  path
    .split(".")
    .reduce<unknown>(
      (current, key) =>
        current && typeof current === "object" ? (current as Record<string, unknown>)[key] : undefined,
      value,
    );

export function analyzeDrydockStaticRules(input: {
  blocks: readonly CanonicalDrydockBlock[];
  assets?: readonly DrydockAssetSnapshot[];
}): readonly DrydockIssue[] {
  const issues: DrydockIssue[] = [];
  if (!input.assets)
    return [
      createDrydockIssue({
        code: "DRYDOCK_ASSET_PROOF_INCOMPLETE",
        category: "ASSET",
        severity: "WARNING",
        ruleVersion: 1,
        location: {},
        message: "Full asset metadata was not supplied to this static survey.",
        remediation: "Run full validation from an immutable Studio snapshot including asset metadata.",
      }),
    ];
  const assets = new Map(input.assets.map((asset) => [asset.id, asset]));
  for (const block of input.blocks) {
    const contract = getDrydockBlockContract(block.blockType);
    if (!contract) continue;
    const source = {
      configuration: block.configuration,
      presentation: block.presentation,
      completion: block.completion,
    };
    for (const requirement of contract.assetRequirements) {
      const assetId = at(source, requirement.fieldPath);
      if (requirement.required && typeof assetId !== "string")
        issues.push(
          createDrydockIssue({
            code: "DRYDOCK_ASSET_REQUIRED_MISSING",
            category: "ASSET",
            severity: "ERROR",
            ruleVersion: 1,
            location: { blockId: block.id, blockType: block.blockType, fieldPath: requirement.fieldPath },
            message: "A required authored asset reference is missing.",
            remediation: "Select an asset meeting the block contract.",
          }),
        );
      if (typeof assetId !== "string") continue;
      const asset = assets.get(assetId);
      if (!asset) {
        issues.push(
          createDrydockIssue({
            code: "DRYDOCK_ASSET_REFERENCE_MISSING",
            category: "ASSET",
            severity: "ERROR",
            ruleVersion: 1,
            location: { blockId: block.id, blockType: block.blockType, fieldPath: requirement.fieldPath },
            message: "This asset reference is absent from the immutable snapshot.",
            remediation: "Choose an asset owned by this Chronicle.",
          }),
        );
        continue;
      }
      if (requirement.mediaTypes.length && !requirement.mediaTypes.includes(asset.mediaType as never))
        issues.push(
          createDrydockIssue({
            code: "DRYDOCK_ASSET_MEDIA_TYPE",
            category: "ASSET",
            severity: "ERROR",
            ruleVersion: 1,
            location: { blockId: block.id, blockType: block.blockType, fieldPath: requirement.fieldPath },
            message: "This asset media type is incompatible with the authored field.",
            remediation: "Choose a media type accepted by the block contract.",
          }),
        );
      if (requirement.playerSafe && asset.roles.includes("CAPTAIN_ONLY_REFERENCE"))
        issues.push(
          createDrydockIssue({
            code: "DRYDOCK_ASSET_PRIVACY",
            category: "PRIVACY",
            severity: "ERROR",
            ruleVersion: 1,
            location: { blockId: block.id, blockType: block.blockType, fieldPath: requirement.fieldPath },
            message: "Captain-only media cannot enter a player-safe authored surface.",
            remediation: "Use a player-safe asset or revise the authored surface.",
          }),
        );
      if (!asset.variants.some((variant) => variant.processingState === "READY"))
        issues.push(
          createDrydockIssue({
            code: "DRYDOCK_ASSET_NOT_READY",
            category: "ASSET",
            severity: "ERROR",
            ruleVersion: 1,
            location: { blockId: block.id, blockType: block.blockType, fieldPath: requirement.fieldPath },
            message: "This asset has no ready delivery variant.",
            remediation: "Wait for canonical asset processing or replace the reference.",
          }),
        );
    }
    for (const rule of contract.accessibilityRules) {
      const isProviderFallbackRule = rule.code === "DRYDOCK_ACCESS_PROVIDER_FALLBACK";
      const fallbackRequired =
        isProviderFallbackRule &&
        ["visionLocation", "visionObject", "externalWebhook"].includes(String(block.completion.mode ?? ""));
      const explicitlyDecorative =
        rule.code === "DRYDOCK_ACCESS_IMAGE_TEXT_ALTERNATIVE" && block.configuration.decorative === true;
      if (rule.required && !explicitlyDecorative && (!isProviderFallbackRule || fallbackRequired) && !at(source, rule.fieldPath ?? ""))
        issues.push(
          createDrydockIssue({
            code: rule.code,
            category: "ACCESSIBILITY",
            severity: "ERROR",
            ruleVersion: 1,
            location: { blockId: block.id, blockType: block.blockType, fieldPath: rule.fieldPath },
            message: rule.obligation,
            remediation: "Supply the required accessible equivalent before publication.",
          }),
        );
    }
  }
  return issues;
}
