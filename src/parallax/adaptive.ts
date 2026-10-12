import { z } from "zod";
import {
  surfaceClassSchema,
  contextClassSchema,
  type SemanticRecipe,
  type AdaptiveContent,
  type placementPolicies,
} from "./adaptive-contracts";
import type { Transform } from "./contracts";
import { composeTransform } from "./transforms";
import { surfaceRotation as rotationForSurface } from "./surface-placement";
const point = z.strictObject({
  x: z.number().finite().min(-100).max(100),
  y: z.number().finite().min(-10).max(20),
  z: z.number().finite().min(-100).max(100),
});
export const candidateSchema = z.strictObject({
  id: z.string().regex(/^[A-Za-z0-9._:-]{1,96}$/),
  surface: surfaceClassSchema,
  context: z.array(contextClassSchema).max(7),
  region: z.enum(["CURRENT_ROOM", "ENTRANCE_REGION"]),
  position: point,
  placementOffset: point.optional(),
  normal: point,
  widthMeters: z.number().finite().positive().max(100),
  depthMeters: z.number().finite().positive().max(100),
  clearanceMeters: z.number().finite().min(0).max(100),
  reachMeters: z.number().finite().min(0).max(100),
  visibility: z.number().finite().min(0).max(1),
  confidence: z.number().finite().min(0).max(1),
  seatedReachable: z.boolean(),
  safe: z.boolean(),
  occluded: z.boolean(),
});
export const environmentEvidenceSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    frameId: z.string().regex(/^[A-Za-z0-9._:-]{1,96}$/),
    source: z.enum(["SIMULATED", "NATIVE_MEASURED"]),
    reliableTracking: z.boolean(),
    viewerPosition: point.optional(),
    candidates: z.array(candidateSchema).max(128),
  })
  .superRefine((e, c) => {
    if (new Set(e.candidates.map((x) => x.id)).size !== e.candidates.length)
      c.addIssue({ code: "custom", message: "PARALLAX_CANDIDATE_ID_DUPLICATE" });
    if (e.candidates.some((x) => Math.abs(Math.hypot(x.normal.x, x.normal.y, x.normal.z) - 1) > 0.001))
      c.addIssue({ code: "custom", message: "PARALLAX_CANDIDATE_NORMAL_INVALID" });
  });
export type EnvironmentEvidence = z.infer<typeof environmentEvidenceSchema>;
export type Candidate = z.infer<typeof candidateSchema>;
export type QualityBand = "HIGH_MATCH" | "ACCEPTABLE_SUBSTITUTE" | "LOW_CONFIDENCE_FALLBACK" | "NO_VALID_PLACEMENT";
export type ResolutionScope = {
  definitionId: string;
  versionId: string;
  versionChecksum: string;
  crewId: string;
  runId: string;
  actorId: string;
  lifecycleId: string;
  variant: number;
};
export type PlacementPolicy = (typeof placementPolicies)[number];
/** Stable non-secret selector. This is not a security digest or a credential. */
export function selectorHash(value: string): string {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}
export function resolutionIdentity(policy: PlacementPolicy, scope: ResolutionScope) {
  const lifetime =
    policy === "ADAPTIVE_PER_CREW"
      ? scope.crewId
      : policy === "ADAPTIVE_PER_RUN"
        ? scope.runId
        : policy === "ADAPTIVE_VARIANT"
          ? `${scope.runId}:${scope.variant}`
          : policy === "PERSONAL"
            ? `${scope.actorId}:${scope.lifecycleId}`
            : scope.lifecycleId;
  // JSON tuples keep delimiters in authorized IDs from colliding.
  const material = JSON.stringify([
    "parallax-resolution-v1",
    scope.definitionId,
    scope.versionId,
    scope.versionChecksum,
    policy,
    lifetime,
  ]);
  return {
    logicalIdentity: material,
    seed: selectorHash(material),
    scope:
      policy === "ADAPTIVE_PER_CREW"
        ? "CREW"
        : policy === "ADAPTIVE_VARIANT"
          ? "VARIANT"
          : policy === "ADAPTIVE_PER_RUN"
            ? "RUN"
            : policy === "PERSONAL"
              ? "PERSONAL"
              : "LIFECYCLE",
  };
}
export type Evaluation = {
  candidate: Candidate;
  accepted: boolean;
  score: number;
  quality: QualityBand;
  constraints: string[];
  transform: Transform;
};
function candidateTransform(
  recipe: SemanticRecipe,
  c: Candidate,
  width: number,
  viewer?: Candidate["position"],
): Transform {
  const p = { ...c.position };
  if (c.placementOffset && recipe.relativePlacement === "CENTER") {
    p.x += c.placementOffset.x;
    p.y += c.placementOffset.y;
    p.z += c.placementOffset.z;
  }
  // Rotate the authored +Z face onto the actual surface normal, including vertical walls.
  const n = c.normal;
  const surfaceRotation = rotationForSurface(n);
  const basis = (x: number, y: number) =>
    composeTransform(
      { position: { x: 0, y: 0, z: 0 }, rotation: surfaceRotation, scale: 1 },
      { position: { x, y, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 }, scale: 1 },
    ).position;
  const right = basis(1, 0),
    near = basis(0, -1);
  const offset = (v: Candidate["position"], amount: number) => {
    p.x += v.x * amount;
    p.y += v.y * amount;
    p.z += v.z * amount;
  };
  const inset = Math.max(0, c.widthMeters / 2 - width / 2 - recipe.minimumClearanceMeters);
  if (["LEFT", "RIGHT", "EDGE"].includes(recipe.relativePlacement))
    offset(right, (recipe.relativePlacement === "LEFT" ? -1 : 1) * inset);
  if (recipe.relativePlacement === "NEAR")
    offset(near, Math.max(0, c.depthMeters / 2 - width / 2 - recipe.minimumClearanceMeters));
  p.x += c.normal.x * 0.01;
  p.y += c.normal.y * 0.01;
  p.z += c.normal.z * 0.01;
  const yaw =
    recipe.orientation === "PLAYER_FACING" && viewer
      ? Math.atan2(viewer.x - p.x, viewer.z - p.z)
      : Math.atan2(n.x, n.z);
  return {
    position: p,
    scale: 1,
    rotation:
      recipe.orientation === "SURFACE" ||
      (recipe.orientation === "UPRIGHT" && recipe.preferredSurfaces.includes("WALL") && c.surface !== "WALL")
        ? surfaceRotation
        : { x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) },
  };
}
export function evaluateCandidate(
  recipe: SemanticRecipe,
  c: Candidate,
  width: number,
  reliableTracking: boolean,
  viewer?: Candidate["position"],
): Evaluation {
  const constraints: string[] = [];
  if (!c.safe || c.context.some((x) => ["WALKWAY", "STAIRS", "OBSTACLE", "PRIVATE_REGION"].includes(x)))
    constraints.push("UNSAFE_REGION");
  if (recipe.forbiddenSurfaces.includes(c.surface) || c.context.some((x) => recipe.forbiddenContext.includes(x)))
    constraints.push("FORBIDDEN_CONTEXT");
  const preferred = recipe.preferredSurfaces.includes(c.surface),
    alternate = recipe.alternateSurfaces.includes(c.surface);
  if (!preferred && !alternate) constraints.push("SURFACE_MISMATCH");
  if (
    c.widthMeters < width + recipe.minimumClearanceMeters * 2 ||
    c.depthMeters < width + recipe.minimumClearanceMeters * 2 ||
    c.clearanceMeters < recipe.minimumClearanceMeters
  )
    constraints.push("INSUFFICIENT_FREE_SPACE");
  if (c.reachMeters > recipe.maximumReachMeters || (recipe.seatedRequired && !c.seatedReachable))
    constraints.push("UNREACHABLE");
  if (c.position.y < recipe.minimumHeightMeters || c.position.y > recipe.maximumHeightMeters)
    constraints.push("HEIGHT_CONFLICT");
  if (recipe.searchRegion === "ENTRANCE_REGION" && c.region !== "ENTRANCE_REGION")
    constraints.push("OUTSIDE_SEARCH_REGION");
  if (c.visibility < recipe.minimumVisibility || (recipe.concealment === "NONE" && c.occluded))
    constraints.push("INSUFFICIENT_VISIBILITY");
  if (
    (["TABLE", "DESK", "SHELF", "FLOOR"].includes(c.surface) && c.normal.y < 0.9) ||
    (c.surface === "WALL" && Math.abs(c.normal.y) > 0.1)
  )
    constraints.push("ORIENTATION_INVALID");
  if (!reliableTracking || c.confidence < recipe.confidenceThreshold) constraints.push("LOW_CONFIDENCE");
  if (
    recipe.orientation === "PLAYER_FACING" &&
    (!viewer || Math.hypot(viewer.x - c.position.x, viewer.z - c.position.z) < 0.001)
  )
    constraints.push("VIEWER_CONTEXT_REQUIRED");
  const context = recipe.preferredContext.length
    ? recipe.preferredContext.filter((x) => c.context.includes(x)).length / recipe.preferredContext.length
    : 1;
  const score =
    Math.round(
      (0.45 * (preferred ? 1 : alternate ? 0.65 : 0) +
        0.2 * context +
        0.2 * c.confidence +
        0.1 * c.visibility +
        0.05 / (1 + Math.abs(c.position.y - recipe.preferredHeightMeters))) *
        1000,
    ) / 1000;
  const accepted = constraints.length === 0;
  return {
    candidate: c,
    accepted,
    score,
    quality: accepted
      ? preferred && score >= 0.8
        ? "HIGH_MATCH"
        : "ACCEPTABLE_SUBSTITUTE"
      : constraints.every((x) => x === "LOW_CONFIDENCE")
        ? "LOW_CONFIDENCE_FALLBACK"
        : "NO_VALID_PLACEMENT",
    constraints,
    transform: candidateTransform(recipe, c, width, viewer),
  };
}
export type SceneResolution = {
  schemaVersion: 1;
  evidenceFrameId: string;
  evidenceSource: EnvironmentEvidence["source"];
  seed: string;
  policy: PlacementPolicy;
  versionId: string;
  versionChecksum: string;
  status: "RESOLVED" | "GUIDED_FALLBACK";
  quality: QualityBand;
  placements: Record<
    string,
    {
      candidateId: string;
      surface: Candidate["surface"];
      transform: Transform;
      score: number;
      confidence: number;
      quality: QualityBand;
    }
  >;
  diagnostics: { entityId: string; candidateId?: string; constraints: string[] }[];
  nodesVisited: number;
  exhausted: boolean;
  physicalQualification: "NOT_ESTABLISHED";
};
export function resolveAdaptiveScene(
  content: {
    id: string;
    adaptive?: AdaptiveContent;
    placementPolicy: PlacementPolicy;
    entities: { id: string; widthMeters: number; transform: Transform }[];
  },
  rawEvidence: unknown,
  seed: string,
  checksum = "unpublished",
): SceneResolution {
  const a = content.adaptive;
  if (!a) throw new Error("PARALLAX_SEMANTIC_RECIPE_REQUIRED");
  const evidence = environmentEvidenceSchema.parse(rawEvidence);
  const sequential = new Set(a.revealOrder);
  if (
    content.entities.filter((e) => !sequential.has(e.id)).length + (sequential.size ? 1 : 0) >
    a.budget.maximumVisibleEntities
  )
    return {
      schemaVersion: 1,
      evidenceFrameId: evidence.frameId,
      evidenceSource: evidence.source,
      seed,
      policy: content.placementPolicy,
      versionId: content.id,
      versionChecksum: checksum,
      status: "GUIDED_FALLBACK",
      quality: "NO_VALID_PLACEMENT",
      placements: {},
      diagnostics: [{ entityId: "scene", constraints: ["PARALLAX_VISIBLE_BUDGET_EXCEEDED"] }],
      nodesVisited: 0,
      exhausted: false,
      physicalQualification: "NOT_ESTABLISHED",
    };
  const diagnostics: SceneResolution["diagnostics"] = [];
  const ranked = a.recipes
    .map((recipe) => {
      const entity = content.entities.find((e) => e.id === recipe.entityId);
      if (!entity) throw new Error("PARALLAX_RECIPE_ENTITY_MISSING");
      const evaluations = evidence.candidates.map((c) =>
        evaluateCandidate(
          recipe,
          c,
          entity.widthMeters * entity.transform.scale,
          evidence.reliableTracking,
          evidence.viewerPosition,
        ),
      );
      for (const r of evaluations.filter((x) => !x.accepted))
        diagnostics.push({ entityId: recipe.entityId, candidateId: r.candidate.id, constraints: r.constraints });
      const valid = evaluations
        .filter((x) => x.accepted)
        .sort((l, r) => {
          if (a.variation === "VALID_ALTERNATIVES" && l.quality === r.quality) {
            const cmp = selectorHash(`${seed}:${recipe.entityId}:${l.candidate.id}`).localeCompare(
              selectorHash(`${seed}:${recipe.entityId}:${r.candidate.id}`),
            );
            if (cmp) return cmp;
          }
          return r.score - l.score || l.candidate.id.localeCompare(r.candidate.id);
        })
        .slice(0, a.budget.maximumCandidatesPerEntity);
      return { recipe, valid };
    })
    .sort((l, r) => l.valid.length - r.valid.length || l.recipe.entityId.localeCompare(r.recipe.entityId));
  let nodesVisited = 0,
    exhausted = false;
  const selected = new Map<string, Evaluation>();
  const conflict = (id: string, next: Evaluation) => {
    for (const [otherId, other] of selected) {
      const distance = Math.hypot(
        next.transform.position.x - other.transform.position.x,
        next.transform.position.y - other.transform.position.y,
        next.transform.position.z - other.transform.position.z,
      );
      const rules = a.relationships.filter(
        (r) => (r.entityId === id && r.otherEntityId === otherId) || (r.otherEntityId === id && r.entityId === otherId),
      );
      for (const r of rules) {
        if (distance < r.minimumSeparationMeters || distance > r.maximumSeparationMeters) return "SEPARATION_CONFLICT";
        if (r.sameSurface && next.candidate.id !== other.candidate.id) return "SURFACE_RELATION_CONFLICT";
        if (r.sightlineRequired && (next.candidate.occluded || other.candidate.occluded)) return "SIGHTLINE_CONFLICT";
      }
      const left = content.entities.find((e) => e.id === id)!,
        right = content.entities.find((e) => e.id === otherId)!;
      if (distance < (left.widthMeters * left.transform.scale + right.widthMeters * right.transform.scale) / 2 + 0.05)
        return "ENTITY_OVERLAP";
    }
    return null;
  };
  const solve = (index: number): boolean => {
    if (index === ranked.length) return true;
    const { recipe, valid } = ranked[index];
    if (!valid.length) diagnostics.push({ entityId: recipe.entityId, constraints: ["NO_ACCEPTABLE_CANDIDATE"] });
    for (const next of valid) {
      if (++nodesVisited > a.budget.maximumNodes) {
        exhausted = true;
        return false;
      }
      const failure = conflict(recipe.entityId, next);
      if (failure) {
        if (diagnostics.length < 512)
          diagnostics.push({ entityId: recipe.entityId, candidateId: next.candidate.id, constraints: [failure] });
        continue;
      }
      selected.set(recipe.entityId, next);
      if (solve(index + 1)) return true;
      selected.delete(recipe.entityId);
      if (exhausted) return false;
    }
    return false;
  };
  const resolved = solve(0);
  const placements = resolved
    ? Object.fromEntries(
        [...selected]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([id, r]) => [
            id,
            {
              candidateId: r.candidate.id,
              surface: r.candidate.surface,
              transform: r.transform,
              score: r.score,
              confidence: r.candidate.confidence,
              quality: r.quality,
            },
          ]),
      )
    : {};
  const onlyConfidence =
    diagnostics.some((d) => d.constraints.includes("LOW_CONFIDENCE")) && ranked.some((r) => !r.valid.length);
  return {
    schemaVersion: 1,
    evidenceFrameId: evidence.frameId,
    evidenceSource: evidence.source,
    seed,
    policy: content.placementPolicy,
    versionId: content.id,
    versionChecksum: checksum,
    status: resolved ? "RESOLVED" : "GUIDED_FALLBACK",
    quality: resolved
      ? Object.values(placements).every((p) => p.quality === "HIGH_MATCH")
        ? "HIGH_MATCH"
        : "ACCEPTABLE_SUBSTITUTE"
      : onlyConfidence
        ? "LOW_CONFIDENCE_FALLBACK"
        : "NO_VALID_PLACEMENT",
    placements,
    diagnostics: diagnostics
      .sort((l, r) =>
        `${l.entityId}:${l.candidateId ?? ""}:${l.constraints}`.localeCompare(
          `${r.entityId}:${r.candidateId ?? ""}:${r.constraints}`,
        ),
      )
      .slice(0, 512),
    nodesVisited: Math.min(nodesVisited, a.budget.maximumNodes),
    exhausted,
    physicalQualification: "NOT_ESTABLISHED",
  };
}
/** Reuse only the same safe physical decision. Changed geometry falls back rather than rerolling. */
export function revalidateAdaptiveScene(
  content: Parameters<typeof resolveAdaptiveScene>[0],
  rawEvidence: unknown,
  prior: SceneResolution,
): SceneResolution | null {
  const evidence = environmentEvidenceSchema.parse(rawEvidence);
  if (
    !content.adaptive ||
    prior.status !== "RESOLVED" ||
    prior.versionId !== content.id ||
    prior.evidenceFrameId !== evidence.frameId ||
    prior.evidenceSource !== evidence.source
  )
    return null;
  const next = structuredClone(prior);
  for (const recipe of content.adaptive.recipes) {
    const p = prior.placements[recipe.entityId],
      entity = content.entities.find((e) => e.id === recipe.entityId);
    const candidate = evidence.candidates.find((c) => c.id === p?.candidateId);
    if (!p || !entity || !candidate) return null;
    const evaluated = evaluateCandidate(
      recipe,
      candidate,
      entity.widthMeters * entity.transform.scale,
      evidence.reliableTracking,
      evidence.viewerPosition,
    );
    if (!evaluated.accepted) return null;
    const position = evaluated.transform.position,
      rotation = evaluated.transform.rotation;
    if (
      Math.hypot(
        position.x - p.transform.position.x,
        position.y - p.transform.position.y,
        position.z - p.transform.position.z,
      ) > 0.001 ||
      Math.abs(
        rotation.x * p.transform.rotation.x +
          rotation.y * p.transform.rotation.y +
          rotation.z * p.transform.rotation.z +
          rotation.w * p.transform.rotation.w,
      ) < 0.999999
    )
      return null;
    next.placements[recipe.entityId] = {
      ...p,
      score: evaluated.score,
      confidence: candidate.confidence,
      quality: evaluated.quality,
    };
  }
  next.quality = Object.values(next.placements).every((p) => p.quality === "HIGH_MATCH")
    ? "HIGH_MATCH"
    : "ACCEPTABLE_SUBSTITUTE";
  return next;
}
/** Safe to retain as logical evidence: excludes physical poses, room/frame IDs and candidate identifiers. */
export function minimizedResolutionReceipt(resolution: SceneResolution) {
  return {
    schemaVersion: 1 as const,
    seed: resolution.seed,
    policy: resolution.policy,
    versionId: resolution.versionId,
    versionChecksum: resolution.versionChecksum,
    status: resolution.status,
    quality: resolution.quality,
    entities: Object.entries(resolution.placements).map(([entityId, p]) => ({
      entityId,
      surface: p.surface,
      quality: p.quality,
      confidenceBand: p.confidence >= 0.8 ? "HIGH" : p.confidence >= 0.5 ? "MODERATE" : "LOW",
      scoreBand: p.score >= 0.8 ? "HIGH_MATCH" : p.score >= 0.5 ? "ACCEPTABLE" : "WEAK",
    })),
    constraints: [...new Set(resolution.diagnostics.flatMap((d) => d.constraints))].sort(),
    exhausted: resolution.exhausted,
    physicalQualification: resolution.physicalQualification,
  };
}
/** Durable decisions are version/scope-bound. New evidence cannot silently reroll a scope. */
export class AdaptiveDecisionCache {
  private decisions = new Map<string, SceneResolution>();
  resolve(identity: string, create: () => SceneResolution) {
    const prior = this.decisions.get(identity);
    if (prior) return structuredClone(prior);
    const next = create();
    this.decisions.set(identity, structuredClone(next));
    return next;
  }
}
