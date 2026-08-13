import type { ValidationIssue } from "@/chronicle/types";
import type { Block } from "@/components/studio/studio-types";
import type { InspectorSectionId } from "@/studio/authoring/adapters";
import { sectionForFieldPath } from "@/studio/authoring/adapters";

export function issuesForContractBlock(block: Block, issues: readonly ValidationIssue[]): ValidationIssue[] {
  return issues.filter((issue) => issue.blockId === block.id);
}

export function issuesForContractPath(
  block: Block,
  fieldPath: string,
  issues: readonly ValidationIssue[],
): ValidationIssue[] {
  return issuesForContractBlock(block, issues).filter((issue) => {
    if (!issue.field) return false;
    const normalized = issue.field.replace(/^configuration\./, "");
    const expected = fieldPath.replace(/^configuration\./, "");
    return normalized === expected || normalized.startsWith(`${expected}.`) || expected.startsWith(`${normalized}.`);
  });
}

export function issueCountsBySection(
  block: Block,
  issues: readonly ValidationIssue[],
): Record<InspectorSectionId, number> {
  const counts: Record<InspectorSectionId, number> = {
    CONTENT: 0,
    BEHAVIOR: 0,
    COMPLETION: 0,
    PRESENTATION: 0,
    ACCESSIBILITY: 0,
    ADVANCED: 0,
  };
  for (const issue of issuesForContractBlock(block, issues)) counts[sectionForFieldPath(issue.field)] += 1;
  return counts;
}
