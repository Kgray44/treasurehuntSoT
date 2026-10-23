import type { SpatialVersion } from "./contracts";
import type { DraftContent } from "./authoring";
export type SpatialInput = {
  trigger: "SCENE_ENTER" | "TIMER" | "INSPECT" | "PICK" | "PLACE";
  entityId?: string;
  atMs: number;
};
type SpatialContent = DraftContent | SpatialVersion;
/** Static publication eligibility, not a claim about a client's current clock
 * or AR visibility. Include legal future SHOW targets so delayed content keeps
 * its asset and Guided meaning; editor-only, disabled and unreachable hidden
 * entities never become observation targets.
 */
export function runtimePresentableEntityIds(content: SpatialContent): Set<string> {
  const candidates = content.entities.filter(
    (e) =>
      e.element?.enabled !== false &&
      content.studio?.layers.find((l) => l.entityId === e.id)?.audience !== "EDITOR_ONLY",
  );
  const eligible = new Set(candidates.map((e) => e.id));
  const visible = new Set(
    candidates
      .filter((e) => content.studio?.layers.find((l) => l.entityId === e.id)?.visible !== false)
      .map((e) => e.id),
  );
  let changed = true;
  while (changed) {
    changed = false;
    for (const b of content.studio?.behaviors ?? []) {
      if (b.action !== "SHOW" || !eligible.has(b.targetEntityId) || visible.has(b.targetEntityId)) continue;
      const triggerable =
        b.trigger === "SCENE_ENTER" || b.trigger === "TIMER"
          ? !b.sourceEntityId
          : candidates.some(
              (e) =>
                visible.has(e.id) &&
                (!b.sourceEntityId || b.sourceEntityId === e.id) &&
                e.interactions.includes(b.trigger as "PICK" | "INSPECT" | "PLACE") &&
                content.studio?.layers.find((l) => l.entityId === e.id)?.selectable !== false,
            );
      if (triggerable) {
        visible.add(b.targetEntityId);
        changed = true;
      }
    }
  }
  return visible;
}
export function isRuntimeInteractionEligible(content: SpatialContent, entityId: string) {
  return (
    runtimePresentableEntityIds(content).has(entityId) &&
    content.studio?.layers.find((l) => l.entityId === entityId)?.selectable !== false
  );
}
/** Pure declarative spatial state; never executes content or emits progression. */
export function evaluateSpatialBehavior(
  content: DraftContent | SpatialVersion,
  inputs: readonly SpatialInput[],
  nowMs: number,
  editor = false,
) {
  const states = Object.fromEntries(
    content.entities.map((e) => {
      const layer = content.studio?.layers.find((l) => l.entityId === e.id);
      return [
        e.id,
        {
          visible:
            (layer?.visible ?? true) &&
            e.element?.enabled !== false &&
            (editor ? layer?.audience !== "RUNTIME_ONLY" : layer?.audience !== "EDITOR_ONLY"),
          highlighted: false,
          selectable: layer?.selectable ?? true,
        },
      ];
    }),
  );
  const events = (content.studio?.behaviors ?? [])
    .flatMap((b, index) =>
      inputs
        .filter(
          (i) =>
            i.trigger === b.trigger &&
            (!b.sourceEntityId || i.entityId === b.sourceEntityId) &&
            i.atMs + b.delayMs <= nowMs,
        )
        .map((i) => ({ b, at: i.atMs + b.delayMs, index })),
    )
    .sort((a, b) => a.at - b.at || a.index - b.index);
  for (const { b } of events) {
    const target = states[b.targetEntityId];
    const audience = content.studio?.layers.find((l) => l.entityId === b.targetEntityId)?.audience;
    const entity = content.entities.find((e) => e.id === b.targetEntityId);
    if (
      target &&
      entity?.element?.enabled !== false &&
      (editor ? audience !== "RUNTIME_ONLY" : audience !== "EDITOR_ONLY")
    ) {
      if (b.action === "HIGHLIGHT") target.highlighted = true;
      else target.visible = b.action === "SHOW";
    }
  }
  return states;
}
