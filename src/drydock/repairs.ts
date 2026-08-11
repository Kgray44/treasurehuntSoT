import { createHash } from "node:crypto";
import { canonicalJson } from "@/drydock/canonical";
import type { CanonicalDrydockBlock } from "@/drydock/contracts/model";
import { canonicalTargetMigrationPreview } from "@/drydock/contracts/parser";

export type DrydockRepairPreview = {
  kind: "CANONICAL_TARGET_MIRROR";
  classification: "SAFE_AUTOMATIC";
  issueCode: "DRYDOCK_LEGACY_NEXT_TARGET_CONFLICT";
  blockId: string;
  sourceChecksum: string;
  affected: { blockId: string; fieldPaths: readonly string[] };
  expectedIssueChanges: { resolved: readonly string[]; introduced: readonly string[] };
  description: string;
  before: Pick<CanonicalDrydockBlock, "configuration" | "nextBlockId">;
  after: Pick<CanonicalDrydockBlock, "configuration" | "nextBlockId">;
};
const checksum = (block: CanonicalDrydockBlock) => createHash("sha256").update(canonicalJson(block)).digest("hex");

export function previewCanonicalTargetRepair(block: CanonicalDrydockBlock): DrydockRepairPreview {
  const target = canonicalTargetMigrationPreview(block);
  return {
    kind: "CANONICAL_TARGET_MIRROR",
    classification: "SAFE_AUTOMATIC",
    issueCode: "DRYDOCK_LEGACY_NEXT_TARGET_CONFLICT",
    blockId: block.id,
    sourceChecksum: checksum(block),
    affected: { blockId: block.id, fieldPaths: ["nextBlockId", "configuration"] },
    expectedIssueChanges: { resolved: ["DRYDOCK_LEGACY_NEXT_TARGET_CONFLICT"], introduced: [] },
    description:
      "Synchronize legacy target mirrors to the existing canonical BlockConnection without changing the canonical edge.",
    before: { configuration: structuredClone(block.configuration), nextBlockId: block.nextBlockId },
    after: target,
  };
}

export function applyDrydockRepair(
  block: CanonicalDrydockBlock,
  preview: DrydockRepairPreview,
): { block: CanonicalDrydockBlock; undo: DrydockRepairPreview } {
  if (block.id !== preview.blockId || checksum(block) !== preview.sourceChecksum)
    throw new Error("Repair preview is stale for this authored source.");
  const repaired = {
    ...block,
    configuration: structuredClone(preview.after.configuration),
    nextBlockId: preview.after.nextBlockId,
  };
  return {
    block: repaired,
    undo: { ...preview, sourceChecksum: checksum(repaired), before: preview.after, after: preview.before },
  };
}
