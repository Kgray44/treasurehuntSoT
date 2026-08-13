import type { Block } from "@/components/studio/studio-types";

export type CanonicalStudioConnection = {
  targetBlockId: string;
  connectionType: string;
  label?: string | null;
  conditionExpression?: string | null;
  orderIndex?: number;
};

/**
 * The browser writes only canonical edges. `updateStudioDraft` is the sole
 * compatibility projection owner for legacy target mirrors.
 */
export function applyCanonicalTargetSelection(block: Block, connections: CanonicalStudioConnection[]): void {
  block.connections = connections;
}
