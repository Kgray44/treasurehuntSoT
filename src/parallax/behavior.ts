import type { SpatialVersion } from "./contracts";
import type { DraftContent } from "./authoring";
export type SpatialInput = {
  trigger: "SCENE_ENTER" | "TIMER" | "INSPECT" | "PICK" | "PLACE";
  entityId?: string;
  atMs: number;
};
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
    if (target && (editor ? audience !== "RUNTIME_ONLY" : audience !== "EDITOR_ONLY")) {
      if (b.action === "HIGHLIGHT") target.highlighted = true;
      else target.visible = b.action === "SHOW";
    }
  }
  return states;
}
