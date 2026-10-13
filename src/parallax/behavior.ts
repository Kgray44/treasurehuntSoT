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

export type SpatialMotionOptions = { take?: number; motion?: "full" | "gentle" | "reduced"; assetKind?: string };
// One stable phase per take: scrubbing is reproducible, without per-frame randomness or resources.
function cinematicPhase(id: string, take: number) {
  let hash = take | 0;
  for (let i = 0; i < id.length; i++) hash = Math.imul(hash ^ id.charCodeAt(i), 16777619);
  return ((hash >>> 0) / 4294967296) * Math.PI * 2;
}
function multiplyRotation(a: Quaternion, b: Quaternion): Quaternion {
  return {
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
  };
}
export function sampleAnimationTrack(track: AnimationTrack, nowMs: number, options: SpatialMotionOptions = {}) {
  const frames = track.keyframes;
  const right = frames.findIndex((f) => f.atMs > nowMs);
  if (right === 0) return null; // Preserve authored state until the first keyframe.
  const a = frames[right < 0 ? frames.length - 1 : right - 1];
  const b = right < 0 ? a : frames[right];
  let t = a === b ? 0 : (nowMs - a.atMs) / (b.atMs - a.atMs);
  const progress = t;
  const cinematic = track.interpolation === "CINEMATIC";
  const phase = cinematicPhase(track.id, options.take ?? 0);
  const envelope =
    cinematic && a !== b && progress > 0 && progress < 1 && options.motion !== "reduced"
      ? Math.sin(Math.PI * progress) ** 2
      : 0;
  const strength = options.motion === "gentle" ? 0.5 : 1;
  const flutter = options.assetKind === "PARCHMENT" ? 0.06 : options.assetKind === "MARKER" ? 0.025 : 0;
  const angle = envelope * flutter * strength * Math.sin(progress * Math.PI * 6 + phase);
  const sway = { x: Math.sin(angle / 2), y: 0, z: 0, w: Math.cos(angle / 2) };
  if (cinematic) t = t * t * t * (t * (t * 6 - 15) + 10);
  else if (track.interpolation === "STEP") t = 0;
  else if (track.interpolation === "EASE_IN_OUT") t = t * t * (3 - 2 * t);
  // The discriminant also narrows each keyframe's value.
  switch (track.property) {
    case "POSITION": {
      const left = a.value as Transform["position"],
        next = b.value as Transform["position"];
      const dx = next.x - left.x,
        dy = next.y - left.y,
        dz = next.z - left.z;
      const distance = Math.hypot(dx, dy, dz);
      const horizontal = Math.hypot(dx, dz);
      // A bounded lateral arc; wall text keeps its exact line. Never drift stationary poses.
      const arc = options.assetKind === "TEXT" ? 0 : Math.min(0.03, distance * 0.08) * envelope * strength;
      const sideways = arc * Math.sin(phase + progress * Math.PI * 2) * 0.35;
      return {
        value: {
          x: left.x + dx * t + (horizontal > 1e-6 ? (-dz / horizontal) * sideways : arc),
          y: left.y + dy * t + (horizontal > 1e-6 ? arc : 0),
          z: left.z + dz * t + (horizontal > 1e-6 ? (dx / horizontal) * sideways : 0),
        },
        sway: distance > 0 ? sway : undefined,
        atMs: a.atMs,
      };
    }
    case "ROTATION":
      return { value: multiplyRotation(slerp(a.value as Quaternion, b.value as Quaternion, t), sway), atMs: a.atMs };
    case "SCALE":
    case "OPACITY":
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
  options: SpatialMotionOptions = {},
) {
  const events = behaviorEvents(content, inputs, nowMs, editor);
  const behavior = behaviorStates(content, events, editor);
  const states = Object.fromEntries(
    content.entities.map((entity) => [
      entity.id,
      {
        ...behavior[entity.id],
        transform: structuredClone(entity.transform),
        opacity: undefined as number | undefined,
        animated: false,
      },
    ]),
  );
  const sways: Record<string, Quaternion> = {};
  if (!editor)
    for (const track of content.studio?.animationTracks ?? []) {
      const state = states[track.entityId];
      if (!track.enabled || !state) continue;
      const entity = content.entities.find((entity) => entity.id === track.entityId)!;
      const sampled = sampleAnimationTrack(track, nowMs, { ...options, assetKind: entity.kind });
      if (!sampled) continue;
      state.animated = true;
      if (track.property === "POSITION") {
        state.transform.position = sampled.value as Transform["position"];
        if (sampled.sway) sways[track.entityId] = sampled.sway;
      } else if (track.property === "ROTATION") state.transform.rotation = sampled.value as Quaternion;
      else if (track.property === "SCALE") state.transform.scale = sampled.value as number;
      else if (track.property === "OPACITY") state.opacity = sampled.value as number;
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
  for (const [id, sway] of Object.entries(sways)) {
    // An explicit rotation track owns orientation; do not layer two wobble effects.
    if (
      !content.studio?.animationTracks?.some(
        (track) => track.entityId === id && track.enabled && track.property === "ROTATION",
      )
    )
      states[id].transform.rotation = multiplyRotation(states[id].transform.rotation, sway);
  }
  return { states, events };
}
