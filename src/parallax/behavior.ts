import type { SpatialVersion } from "./contracts";
import type { DraftContent } from "./authoring";
import type { AnimationTrack } from "./studio-contracts";
import type { Transform } from "./contracts";
type Quaternion = Transform["rotation"];
export type SpatialInput = {
  trigger: "SCENE_ENTER" | "TIMER" | "INSPECT" | "PICK" | "PLACE";
  entityId?: string;
  atMs: number;
};
export const maximumSpatialInputs = 128;
export const initialSpatialInputs = (): SpatialInput[] => [
  { trigger: "SCENE_ENTER", atMs: 0 },
  { trigger: "TIMER", atMs: 0 },
];
/** Explicit rejection preserves all previous inputs and their delayed effects. */
export function appendSpatialInput(inputs: readonly SpatialInput[], input: SpatialInput): SpatialInput[] {
  if (inputs.length >= maximumSpatialInputs) throw new Error("Reset simulation before adding more interactions.");
  if (!Number.isFinite(input.atMs) || input.atMs < 0 || input.atMs > 60000)
    throw new Error("Simulation time must be between zero and sixty seconds.");
  return [...inputs, input];
}
function behaviorEvents(
  content: DraftContent | SpatialVersion,
  inputs: readonly SpatialInput[],
  nowMs: number,
  editor: boolean,
) {
  return (content.studio?.behaviors ?? [])
    .flatMap((b, index) =>
      inputs.flatMap((input, inputIndex) => {
        if (input.trigger !== b.trigger || (b.sourceEntityId && input.entityId !== b.sourceEntityId)) return [];
        const audience = content.studio?.layers.find((l) => l.entityId === b.targetEntityId)?.audience;
        const excluded = editor ? audience === "RUNTIME_ONLY" : audience === "EDITOR_ONLY";
        return [
          {
            behaviorId: b.id,
            entityId: b.targetEntityId,
            sourceEntityId: b.sourceEntityId,
            trigger: b.trigger,
            action: b.action,
            inputIndex,
            atMs: input.atMs + b.delayMs,
            index,
            status: excluded
              ? ("SUPPRESSED" as const)
              : input.atMs + b.delayMs <= nowMs
                ? ("APPLIED" as const)
                : ("WAITING" as const),
          },
        ];
      }),
    )
    .sort((a, b) => a.atMs - b.atMs || a.index - b.index);
}
function behaviorStates(
  content: DraftContent | SpatialVersion,
  events: ReturnType<typeof behaviorEvents>,
  editor: boolean,
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
  for (const event of events) {
    if (event.status !== "APPLIED") continue;
    const target = states[event.entityId];
    if (target) {
      if (event.action === "HIGHLIGHT") target.highlighted = true;
      else target.visible = event.action === "SHOW";
    }
  }
  return states;
}
/** Pure declarative spatial state; never executes content or emits progression. */
export function evaluateSpatialBehavior(
  content: DraftContent | SpatialVersion,
  inputs: readonly SpatialInput[],
  nowMs: number,
  editor = false,
) {
  return behaviorStates(content, behaviorEvents(content, inputs, nowMs, editor), editor);
}

/** Shortest-path, normalized quaternion interpolation. q and -q are the same orientation. */
function slerp(a: Quaternion, b: Quaternion, amount: number): Quaternion {
  let dot = a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w;
  const end = dot < 0 ? { x: -b.x, y: -b.y, z: -b.z, w: -b.w } : b;
  dot = Math.max(-1, Math.min(1, Math.abs(dot)));
  const angle = Math.acos(dot),
    sin = Math.sin(angle);
  const from = sin < 1e-6 ? 1 - amount : Math.sin((1 - amount) * angle) / sin;
  const to = sin < 1e-6 ? amount : Math.sin(amount * angle) / sin;
  const q = {
    x: a.x * from + end.x * to,
    y: a.y * from + end.y * to,
    z: a.z * from + end.z * to,
    w: a.w * from + end.w * to,
  };
  const norm = Math.hypot(q.x, q.y, q.z, q.w);
  return { x: q.x / norm, y: q.y / norm, z: q.z / norm, w: q.w / norm };
}

export function sampleAnimationTrack(track: AnimationTrack, nowMs: number) {
  const frames = track.keyframes;
  const right = frames.findIndex((f) => f.atMs > nowMs);
  if (right === 0) return null; // Preserve authored state until the first keyframe.
  const a = frames[right < 0 ? frames.length - 1 : right - 1];
  const b = right < 0 ? a : frames[right];
  let t = a === b ? 0 : (nowMs - a.atMs) / (b.atMs - a.atMs);
  if (track.interpolation === "STEP") t = 0;
  else if (track.interpolation === "EASE_IN_OUT") t = t * t * (3 - 2 * t);
  // The discriminant also narrows each keyframe's value.
  switch (track.property) {
    case "POSITION": {
      const left = a.value as Transform["position"],
        next = b.value as Transform["position"];
      return {
        value: {
          x: left.x + (next.x - left.x) * t,
          y: left.y + (next.y - left.y) * t,
          z: left.z + (next.z - left.z) * t,
        },
        atMs: a.atMs,
      };
    }
    case "ROTATION":
      return { value: slerp(a.value as Quaternion, b.value as Quaternion, t), atMs: a.atMs };
    case "SCALE":
      return { value: (a.value as number) + ((b.value as number) - (a.value as number)) * t, atMs: a.atMs };
    case "VISIBILITY":
      return { value: a.value as boolean, atMs: a.atMs };
  }
}

/** One pure scene evaluator shared by the Studio and canonical Lens runtime. */
export function evaluateSpatialScene(
  content: DraftContent | SpatialVersion,
  inputs: readonly SpatialInput[],
  nowMs: number,
  editor = false,
) {
  const events = behaviorEvents(content, inputs, nowMs, editor);
  const behavior = behaviorStates(content, events, editor);
  const states = Object.fromEntries(
    content.entities.map((entity) => [
      entity.id,
      {
        ...behavior[entity.id],
        transform: structuredClone(entity.transform),
        animated: false,
      },
    ]),
  );
  if (!editor)
    for (const track of content.studio?.animationTracks ?? []) {
      const state = states[track.entityId];
      if (!track.enabled || !state) continue;
      const sampled = sampleAnimationTrack(track, nowMs);
      if (!sampled) continue;
      state.animated = true;
      if (track.property === "POSITION") state.transform.position = sampled.value as Transform["position"];
      else if (track.property === "ROTATION") state.transform.rotation = sampled.value as Quaternion;
      else if (track.property === "SCALE") state.transform.scale = sampled.value as number;
      else {
        const layer = content.studio?.layers.find((l) => l.entityId === track.entityId);
        const lastEvent = events
          .filter((e) => e.entityId === track.entityId && e.status === "APPLIED" && e.action !== "HIGHLIGHT")
          .at(-1);
        // Visibility events win a tie; a later keyframe can deliberately supersede them.
        if ((!lastEvent || lastEvent.atMs < sampled.atMs) && layer?.audience !== "EDITOR_ONLY")
          state.visible = sampled.value as boolean;
      }
    }
  return { states, events };
}
